import {
  ATLAS_AGENTS,
  ATLAS_LOCATIONS,
  ATLAS_WORKFLOWS,
  advanceAtlasWorld as advanceCoreAtlasWorld,
  atlasSnapshot as coreAtlasSnapshot,
  createAtlasWorld as createCoreAtlasWorld,
  requestWebMcpAction as requestCoreWebMcpAction,
  requestWebMcpWorkflow as requestCoreWebMcpWorkflow,
  resolveAtlasApproval as resolveCoreAtlasApproval,
  startAtlasWorkflow as startCoreAtlasWorkflow,
  workflowFor,
  type AtlasAgentState,
  type AtlasApproval,
  type AtlasEvent,
  type AtlasMessage,
  type AtlasTaskState as CoreAtlasTaskState,
  type AtlasWorldState as CoreAtlasWorldState,
  type ExternalAction,
  type GeoPoint,
  type StakeholderSide,
  type WorkflowId,
} from "./atlas-simulation.ts";

export { ATLAS_AGENTS, ATLAS_LOCATIONS, ATLAS_WORKFLOWS, workflowFor };
export type {
  AtlasAgentState,
  AtlasApproval,
  AtlasEvent,
  AtlasMessage,
  ExternalAction,
  GeoPoint,
  StakeholderSide,
  WorkflowId,
};

export type ScheduleHealth =
  | "queued"
  | "on_track"
  | "ahead"
  | "delayed"
  | "obstacle"
  | "exploring"
  | "waiting"
  | "done";

export type AtlasTaskRuntime = {
  health: ScheduleHealth;
  rateMultiplier: number;
  plannedStartAt?: number;
  etaAt?: number;
  remainingMs?: number;
  lastUpdatedAt: number;
  obstacleChecked?: boolean;
  obstacleLabel?: string;
  obstacleUntil?: number;
  obstacleDelayMs?: number;
  explorationChecked?: boolean;
  taskKind?: "workflow" | "opportunity";
  parentTaskId?: string;
  opportunityBasis?: string;
  opportunityResumed?: boolean;
};

export type AtlasTaskState = CoreAtlasTaskState & {
  runtime?: AtlasTaskRuntime;
};

export type AtlasSchedulerState = {
  exploreMode: boolean;
  createdAt: number;
  lastPlanAt: number;
  opportunitiesCreated: number;
  obstaclesCreated: number;
};

export type AtlasWorldState = Omit<CoreAtlasWorldState, "tasks"> & {
  tasks: AtlasTaskState[];
  scheduler?: AtlasSchedulerState;
};

const TRAVEL_DEGREES_PER_MS = 0.0000028;
const DEFAULT_TRAVEL_MS = 2_200;
const EXPLORE_TRIGGER_PROGRESS = 0.68;
const OBSTACLE_TRIGGER_PROGRESS = 0.34;

const AGENT_CONTEXT: Record<StakeholderSide, { resource: string; information: string; opportunity: string; detail: string }> = {
  user: { resource: "confirmed preferences", information: "nearby availability", opportunity: "Bundle a nearby compatible request", detail: "Reuse confirmed preferences to resolve another nearby low-cost request before returning to the main task." },
  customer: { resource: "acceptance criteria", information: "customer constraints", opportunity: "Resolve an adjacent customer question", detail: "Use the already-loaded customer constraints to close a small adjacent question with almost no extra context switching." },
  business: { resource: "current quote context", information: "merchant capacity", opportunity: "Bundle a compatible merchant request", detail: "Use the current commercial context to complete a compatible merchant-side request while the information is already hot." },
  supplier: { resource: "reserved material context", information: "live capacity picture", opportunity: "Consolidate a nearby supply request", detail: "Use the same stock and capacity information to answer a nearby supply request before the context becomes stale." },
  operations: { resource: "active fulfilment plan", information: "handoff windows", opportunity: "Merge a compatible handoff", detail: "Use the current fulfilment plan to absorb a compatible handoff with minimal incremental work." },
  finance: { resource: "current cost model", information: "payment terms", opportunity: "Reconcile an adjacent exposure", detail: "Reuse the active cost model to reconcile a small related exposure before returning to the main milestone." },
  logistics: { resource: "active route context", information: "nearby delivery windows", opportunity: "Bundle a nearby handoff", detail: "Use the current route and delivery-window information to complete a nearby compatible handoff." },
  support: { resource: "customer conversation context", information: "recent service history", opportunity: "Close a related support follow-up", detail: "Use the current customer context to close a related follow-up without another retrieval cycle." },
  quality: { resource: "active specification", information: "acceptance evidence", opportunity: "Verify an adjacent specification", detail: "Reuse the loaded acceptance evidence to verify one compatible adjacent specification." },
  market: { resource: "current demand sample", information: "local demand signals", opportunity: "Refresh a nearby demand signal", detail: "Use the current sample to refresh one nearby signal before returning to the primary analysis." },
};

const OBSTACLES: Record<StakeholderSide, string[]> = {
  user: ["preference ambiguity", "missing confirmation"],
  customer: ["customer reply pending", "constraint conflict"],
  business: ["merchant response pending", "quote dependency"],
  supplier: ["supplier reply pending", "stock variance"],
  operations: ["handoff window changed", "resource contention"],
  finance: ["payment term check", "margin input changed"],
  logistics: ["route congestion", "pickup window shifted"],
  support: ["customer response pending", "case history lookup"],
  quality: ["evidence mismatch", "specification clarification"],
  market: ["signal confidence dropped", "fresh sample pending"],
};

function cloneRuntimeWorld<T extends AtlasWorldState>(world: T): T {
  return JSON.parse(JSON.stringify(world)) as T;
}

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function nextRuntimeId(world: AtlasWorldState, prefix: string) {
  world.revision += 1;
  return `${prefix}-${world.revision.toString(36)}-${Math.floor(world.now).toString(36)}`;
}

function pushRuntimeEvent(world: AtlasWorldState, title: string, detail: string, agentId?: string, taskId?: string) {
  world.events = [
    { id: nextRuntimeId(world, "runtime"), title, detail, createdAt: world.now, agentId, taskId },
    ...world.events,
  ].slice(0, 90);
}

function pushRuntimeMessage(world: AtlasWorldState, fromAgentId: string, text: string) {
  world.messages = [
    ...world.messages,
    {
      id: nextRuntimeId(world, "schedule-message"),
      fromAgentId,
      toAgentId: "scheduler",
      text,
      createdAt: world.now,
      expiresAt: world.now + 4_600,
    },
  ].slice(-24);
}

function coordinateDistance(a: GeoPoint, b: GeoPoint) {
  const lonScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * lonScale, a.lat - b.lat);
}

function ensureScheduler(world: AtlasWorldState, previous?: AtlasWorldState) {
  world.scheduler = world.scheduler ?? previous?.scheduler ?? {
    exploreMode: true,
    createdAt: world.now,
    lastPlanAt: world.now,
    opportunitiesCreated: 0,
    obstaclesCreated: 0,
  };

  for (const task of world.tasks) {
    if (task.runtime) continue;
    const h = hash(task.id);
    const rateMultiplier = h % 6 === 0 ? 1.16 : h % 6 === 1 ? 0.94 : 1;
    task.runtime = {
      health: task.status === "queued" ? "queued" : task.status === "done" ? "done" : "on_track",
      rateMultiplier,
      lastUpdatedAt: world.now,
      taskKind: "workflow",
    };
  }
  return world;
}

function estimateTravelMs(world: AtlasWorldState, task: AtlasTaskState) {
  const agent = world.agents.find((candidate) => candidate.id === task.agentId);
  const destination = ATLAS_LOCATIONS[task.locationId]?.point;
  if (!agent || !destination) return DEFAULT_TRAVEL_MS;
  const distance = coordinateDistance(agent.position, destination);
  return Math.max(0, distance / TRAVEL_DEGREES_PER_MS);
}

function activeObstacle(task: AtlasTaskState, now: number) {
  return Boolean(task.runtime?.obstacleUntil && now < task.runtime.obstacleUntil);
}

function preAdjustWorkingClocks(world: AtlasWorldState, deltaMs: number) {
  for (const task of world.tasks) {
    if (task.status !== "working" || task.workStartedAt === undefined || !task.runtime) continue;
    if (activeObstacle(task, world.now)) {
      task.workStartedAt += deltaMs;
      continue;
    }
    const rate = task.runtime.rateMultiplier || 1;
    task.workStartedAt -= deltaMs * (rate - 1);
  }
}

function maybeResolveObstacles(world: AtlasWorldState) {
  for (const task of world.tasks) {
    const runtime = task.runtime;
    if (!runtime?.obstacleUntil || !runtime.obstacleLabel || world.now < runtime.obstacleUntil) continue;
    const agent = world.agents.find((candidate) => candidate.id === task.agentId);
    pushRuntimeEvent(world, "Obstacle cleared", `${agent?.name ?? "Agent"} cleared ${runtime.obstacleLabel}; ETA has been recalculated.`, task.agentId, task.id);
    pushRuntimeMessage(world, task.agentId, `Obstacle cleared → ${task.title}`);
    delete runtime.obstacleUntil;
    delete runtime.obstacleLabel;
    runtime.health = runtime.rateMultiplier > 1.05 ? "ahead" : runtime.rateMultiplier < 0.98 ? "delayed" : "on_track";
  }
}

function maybeCreateObstacle(world: AtlasWorldState) {
  const scheduler = world.scheduler;
  if (!scheduler) return;
  for (const task of world.tasks) {
    const runtime = task.runtime;
    if (!runtime || runtime.taskKind === "opportunity" || runtime.obstacleChecked || task.status !== "working" || task.progress < OBSTACLE_TRIGGER_PROGRESS) continue;
    runtime.obstacleChecked = true;
    const shouldTrigger = scheduler.obstaclesCreated === 0 || hash(`${task.id}-obstacle`) % 4 === 0;
    if (!shouldTrigger) continue;
    const agent = world.agents.find((candidate) => candidate.id === task.agentId);
    if (!agent) continue;
    const options = OBSTACLES[agent.side];
    const label = options[hash(task.id) % options.length];
    const delayMs = 1_100 + (hash(`${task.id}-delay`) % 1_900);
    runtime.obstacleLabel = label;
    runtime.obstacleDelayMs = delayMs;
    runtime.obstacleUntil = world.now + delayMs;
    runtime.health = "obstacle";
    scheduler.obstaclesCreated += 1;
    pushRuntimeEvent(world, "Live obstacle", `${agent.name}: ${label}. Current task is paused briefly and its ETA has moved by about ${Math.ceil(delayMs / 1000)}s.`, agent.id, task.id);
    pushRuntimeMessage(world, agent.id, `Obstacle → ${label} (+${Math.ceil(delayMs / 1000)}s)`);
    break;
  }
}

function opportunityFor(world: AtlasWorldState, task: AtlasTaskState) {
  const agent = world.agents.find((candidate) => candidate.id === task.agentId);
  if (!agent) return null;
  const context = AGENT_CONTEXT[agent.side];
  const duration = 1_000 + (hash(`${task.id}-opportunity`) % 1_500);
  return { agent, context, duration };
}

function maybeCreateOpportunity(world: AtlasWorldState) {
  const scheduler = world.scheduler;
  if (!scheduler?.exploreMode) return;

  for (const task of world.tasks) {
    const runtime = task.runtime;
    if (!runtime || runtime.taskKind === "opportunity" || runtime.explorationChecked || task.status !== "working" || task.progress < EXPLORE_TRIGGER_PROGRESS || task.progress > 0.94) continue;
    runtime.explorationChecked = true;
    const shouldExplore = scheduler.opportunitiesCreated === 0 || hash(`${task.id}-explore`) % 3 === 0;
    if (!shouldExplore) continue;
    const found = opportunityFor(world, task);
    if (!found) continue;

    const opportunityId = `explore-${task.id}-${scheduler.opportunitiesCreated + 1}`;
    const opportunity: AtlasTaskState = {
      id: opportunityId,
      title: found.context.opportunity,
      detail: found.context.detail,
      agentId: task.agentId,
      locationId: task.locationId,
      dependsOn: [],
      workMs: found.duration,
      status: "working",
      progress: 0,
      startedAt: world.now,
      workStartedAt: world.now,
      runtime: {
        health: "exploring",
        rateMultiplier: 1,
        lastUpdatedAt: world.now,
        taskKind: "opportunity",
        parentTaskId: task.id,
        opportunityBasis: `${found.context.resource} + ${found.context.information}`,
      },
    };

    task.status = "blocked";
    runtime.health = "exploring";
    runtime.parentTaskId = opportunityId;
    world.tasks.push(opportunity);
    found.agent.status = "working";
    found.agent.taskId = opportunity.id;
    scheduler.opportunitiesCreated += 1;
    pushRuntimeEvent(world, "Explore opportunity", `${found.agent.name} noticed a bounded side-task that can reuse ${found.context.resource} and ${found.context.information}. It will finish that first, then resume ${task.title}.`, found.agent.id, opportunity.id);
    pushRuntimeMessage(world, found.agent.id, `Explore → ${found.context.opportunity}`);
    break;
  }
}

function resumeParentsAfterOpportunity(world: AtlasWorldState) {
  for (const opportunity of world.tasks) {
    const runtime = opportunity.runtime;
    if (runtime?.taskKind !== "opportunity" || opportunity.status !== "done" || runtime.opportunityResumed || !runtime.parentTaskId) continue;
    const parent = world.tasks.find((candidate) => candidate.id === runtime.parentTaskId);
    const agent = world.agents.find((candidate) => candidate.id === opportunity.agentId);
    if (!parent || !agent || parent.status !== "blocked") {
      runtime.opportunityResumed = true;
      continue;
    }

    parent.status = "working";
    parent.workStartedAt = world.now - (parent.progress * parent.workMs);
    if (parent.runtime) parent.runtime.health = parent.runtime.rateMultiplier > 1.05 ? "ahead" : parent.runtime.rateMultiplier < 0.98 ? "delayed" : "on_track";
    agent.status = "working";
    agent.taskId = parent.id;
    delete agent.statusUntil;
    runtime.opportunityResumed = true;
    pushRuntimeEvent(world, "Primary task resumed", `${agent.name} finished ${opportunity.title} and resumed ${parent.title} from ${Math.round(parent.progress * 100)}%.`, agent.id, parent.id);
    pushRuntimeMessage(world, agent.id, `Resume → ${parent.title}`);
  }
}

function refreshSchedule(world: AtlasWorldState) {
  const scheduler = world.scheduler;
  if (!scheduler) return;
  const finishByTask = new Map<string, number>();
  const availableByAgent = new Map<string, number>();

  for (const task of world.tasks) {
    const runtime = task.runtime;
    if (!runtime) continue;
    runtime.lastUpdatedAt = world.now;

    if (task.status === "done") {
      runtime.health = "done";
      runtime.remainingMs = 0;
      runtime.etaAt = task.completedAt ?? world.now;
      finishByTask.set(task.id, runtime.etaAt);
      availableByAgent.set(task.agentId, Math.max(availableByAgent.get(task.agentId) ?? world.now, runtime.etaAt));
      continue;
    }

    const rate = Math.max(0.5, runtime.rateMultiplier || 1);
    if (task.status === "waiting_approval") {
      runtime.health = "waiting";
      runtime.remainingMs = undefined;
      runtime.etaAt = undefined;
      finishByTask.set(task.id, world.now + 5_000);
      availableByAgent.set(task.agentId, world.now + 5_000);
      continue;
    }

    if (task.status === "moving") {
      const remaining = estimateTravelMs(world, task) + (task.workMs / rate);
      runtime.remainingMs = remaining;
      runtime.etaAt = world.now + remaining;
      runtime.health = "on_track";
    } else if (task.status === "working") {
      const obstacleRemaining = runtime.obstacleUntil ? Math.max(0, runtime.obstacleUntil - world.now) : 0;
      const remaining = ((1 - task.progress) * task.workMs / rate) + obstacleRemaining;
      runtime.remainingMs = remaining;
      runtime.etaAt = world.now + remaining;
      if (runtime.taskKind === "opportunity") runtime.health = "exploring";
      else if (obstacleRemaining > 0) runtime.health = "obstacle";
      else if (task.progress > 0.22 && rate > 1.05) runtime.health = "ahead";
      else if (task.progress > 0.22 && rate < 0.98) runtime.health = "delayed";
      else runtime.health = "on_track";
    } else if (task.status === "blocked" && runtime.health === "exploring") {
      const activeOpportunity = world.tasks.find((candidate) => candidate.runtime?.taskKind === "opportunity" && candidate.runtime.parentTaskId === task.id && candidate.status !== "done");
      const opportunityRemaining = activeOpportunity?.runtime?.remainingMs ?? activeOpportunity?.workMs ?? 0;
      const remaining = opportunityRemaining + ((1 - task.progress) * task.workMs / rate);
      runtime.remainingMs = remaining;
      runtime.etaAt = world.now + remaining;
    } else if (task.status === "queued") {
      const dependencyReadyAt = task.dependsOn.reduce((latest, id) => Math.max(latest, finishByTask.get(id) ?? world.now), world.now);
      const agentReadyAt = availableByAgent.get(task.agentId) ?? world.now;
      const plannedStartAt = Math.max(world.now, dependencyReadyAt, agentReadyAt);
      const remaining = DEFAULT_TRAVEL_MS + (task.workMs / rate);
      runtime.plannedStartAt = plannedStartAt;
      runtime.remainingMs = Math.max(0, plannedStartAt - world.now) + remaining;
      runtime.etaAt = plannedStartAt + remaining;
      runtime.health = "queued";
    } else {
      runtime.remainingMs = undefined;
      runtime.etaAt = undefined;
    }

    const finish = runtime.etaAt ?? world.now + 5_000;
    finishByTask.set(task.id, finish);
    availableByAgent.set(task.agentId, Math.max(availableByAgent.get(task.agentId) ?? world.now, finish));
  }
  scheduler.lastPlanAt = world.now;
}

function formatSeconds(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return "—";
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function activeTaskForAgent(world: AtlasWorldState, agentId: string) {
  const agent = world.agents.find((candidate) => candidate.id === agentId);
  const byAgentTask = agent?.taskId ? world.tasks.find((task) => task.id === agent.taskId) : undefined;
  return byAgentTask ?? world.tasks.find((task) => task.agentId === agentId && ["moving", "working", "waiting_approval"].includes(task.status));
}

function scheduleDomUpdate(world: AtlasWorldState) {
  if (typeof document === "undefined") return;
  const snapshot = cloneRuntimeWorld(world);
  queueMicrotask(() => {
    for (const agent of snapshot.agents) {
      const task = activeTaskForAgent(snapshot, agent.id);
      if (!task?.runtime) continue;
      const marker = document.querySelector<HTMLElement>(`.animal-map-marker[data-agent-id="${agent.id}"]`);
      if (!marker) continue;
      const status = marker.querySelector<HTMLElement>(".animal-map-marker__status-text");
      const dialogue = marker.querySelector<HTMLElement>(".animal-map-marker__dialogue");
      const eta = formatSeconds(task.runtime.remainingMs);
      const progress = Math.round(task.progress * 100);

      if (status) {
        if (task.runtime.health === "obstacle") status.textContent = `obstacle · ${eta}`;
        else if (task.runtime.taskKind === "opportunity") status.textContent = `exploring · ${progress}% · ${eta}`;
        else if (task.status === "waiting_approval") status.textContent = "waiting · approval";
        else status.textContent = `${agent.status} · ${progress}% · ${eta}`;
      }

      if (dialogue) {
        if (task.runtime.health === "obstacle" && task.runtime.obstacleLabel) dialogue.textContent = `Obstacle → ${task.runtime.obstacleLabel} (+${formatSeconds(task.runtime.obstacleDelayMs)})`;
        else if (task.runtime.taskKind === "opportunity") dialogue.textContent = `Explore → ${task.title}`;
        else if (task.runtime.health === "ahead") dialogue.textContent = `Going well · ETA ${eta}`;
      }
    }
  });
}

export function adoptRuntimeWorld(next: CoreAtlasWorldState | AtlasWorldState, previous?: AtlasWorldState): AtlasWorldState {
  const world = next as AtlasWorldState;
  ensureScheduler(world, previous);
  refreshSchedule(world);
  scheduleDomUpdate(world);
  return world;
}

export function createAtlasWorld(now = Date.now()): AtlasWorldState {
  return adoptRuntimeWorld(createCoreAtlasWorld(now));
}

export function startAtlasWorkflow(current: AtlasWorldState, workflowId: WorkflowId): AtlasWorldState {
  const next = startCoreAtlasWorkflow(current as CoreAtlasWorldState, workflowId);
  const world = adoptRuntimeWorld(next, current);
  if (world.scheduler && current.scheduler) world.scheduler.exploreMode = current.scheduler.exploreMode;
  refreshSchedule(world);
  return world;
}

export function advanceAtlasWorld(current: AtlasWorldState, deltaMs: number): AtlasWorldState {
  const prepared = cloneRuntimeWorld(adoptRuntimeWorld(current));
  const safeDelta = Math.min(140, Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0));
  preAdjustWorkingClocks(prepared, safeDelta);
  const world = adoptRuntimeWorld(advanceCoreAtlasWorld(prepared as CoreAtlasWorldState, safeDelta), prepared);
  maybeResolveObstacles(world);
  resumeParentsAfterOpportunity(world);
  maybeCreateObstacle(world);
  maybeCreateOpportunity(world);
  refreshSchedule(world);
  scheduleDomUpdate(world);
  return world;
}

export function resolveAtlasApproval(current: AtlasWorldState, approvalId: string, approved: boolean): AtlasWorldState {
  return adoptRuntimeWorld(resolveCoreAtlasApproval(current as CoreAtlasWorldState, approvalId, approved), current);
}

export function requestWebMcpWorkflow(current: AtlasWorldState, workflowId: WorkflowId): AtlasWorldState {
  return adoptRuntimeWorld(requestCoreWebMcpWorkflow(current as CoreAtlasWorldState, workflowId), current);
}

export function requestWebMcpAction(current: AtlasWorldState, actionType: ExternalAction, agentId: string, reason: string): AtlasWorldState {
  return adoptRuntimeWorld(requestCoreWebMcpAction(current as CoreAtlasWorldState, actionType, agentId, reason), current);
}

export function setExploreMode(current: AtlasWorldState, enabled: boolean): AtlasWorldState {
  const world = cloneRuntimeWorld(adoptRuntimeWorld(current));
  if (!world.scheduler) ensureScheduler(world);
  if (world.scheduler) world.scheduler.exploreMode = enabled;
  pushRuntimeEvent(world, enabled ? "Explore Mode on" : "Explore Mode off", enabled ? "Agents may briefly take bounded high-value side-tasks that reuse resources or information already in context." : "Agents will stay strictly on the primary workflow path.");
  refreshSchedule(world);
  scheduleDomUpdate(world);
  return world;
}

export function taskScheduleForAgent(world: AtlasWorldState, agentId: string) {
  const task = activeTaskForAgent(world, agentId);
  return task ? {
    taskId: task.id,
    title: task.title,
    status: task.status,
    progress: Number(task.progress.toFixed(3)),
    health: task.runtime?.health ?? "on_track",
    etaAt: task.runtime?.etaAt ?? null,
    remainingMs: task.runtime?.remainingMs ?? null,
    eta: formatSeconds(task.runtime?.remainingMs),
    obstacle: task.runtime?.obstacleLabel ?? null,
    taskKind: task.runtime?.taskKind ?? "workflow",
    opportunityBasis: task.runtime?.opportunityBasis ?? null,
  } : null;
}

export function scheduledTaskRows(world: AtlasWorldState, limit = 8) {
  return world.tasks
    .filter((task) => task.runtime?.taskKind !== "opportunity" || task.status !== "done")
    .map((task) => ({
      id: task.id,
      title: task.title,
      agentId: task.agentId,
      status: task.status,
      health: task.runtime?.health ?? "queued",
      progress: Number(task.progress.toFixed(2)),
      etaAt: task.runtime?.etaAt ?? null,
      eta: formatSeconds(task.runtime?.remainingMs),
      taskKind: task.runtime?.taskKind ?? "workflow",
      parentTaskId: task.runtime?.parentTaskId ?? null,
      obstacle: task.runtime?.obstacleLabel ?? null,
    }))
    .sort((a, b) => {
      const activeA = ["moving", "working", "waiting_approval"].includes(a.status) ? 0 : a.status === "queued" ? 1 : 2;
      const activeB = ["moving", "working", "waiting_approval"].includes(b.status) ? 0 : b.status === "queued" ? 1 : 2;
      if (activeA !== activeB) return activeA - activeB;
      return (a.etaAt ?? Number.MAX_SAFE_INTEGER) - (b.etaAt ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, limit);
}

export function atlasSnapshot(world: AtlasWorldState) {
  const scheduled = adoptRuntimeWorld(cloneRuntimeWorld(world));
  const core = coreAtlasSnapshot(scheduled as CoreAtlasWorldState);
  const scheduleById = new Map(scheduled.tasks.map((task) => [task.id, task]));
  return {
    ...core,
    exploreMode: scheduled.scheduler?.exploreMode ?? true,
    tasks: core.tasks.map((task) => {
      const scheduledTask = scheduleById.get(task.id);
      return {
        ...task,
        taskKind: scheduledTask?.runtime?.taskKind ?? "workflow",
        scheduleHealth: scheduledTask?.runtime?.health ?? null,
        etaAt: scheduledTask?.runtime?.etaAt ?? null,
        etaSeconds: scheduledTask?.runtime?.remainingMs === undefined ? null : Math.max(0, Math.ceil(scheduledTask.runtime.remainingMs / 1000)),
        obstacle: scheduledTask?.runtime?.obstacleLabel ?? null,
        opportunityBasis: scheduledTask?.runtime?.opportunityBasis ?? null,
      };
    }),
    scheduler: {
      exploreMode: scheduled.scheduler?.exploreMode ?? true,
      opportunitiesCreated: scheduled.scheduler?.opportunitiesCreated ?? 0,
      obstaclesCreated: scheduled.scheduler?.obstaclesCreated ?? 0,
      active: scheduledTaskRows(scheduled, 10),
    },
  };
}

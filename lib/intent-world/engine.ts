import { createIntentAgents, INTENT_AGENT_BY_ID, INTENT_LOCATIONS } from "./catalog.ts";
import {
  type AsymptaAgentId,
  type IntentApproval,
  type IntentPlan,
  type IntentPlannerResponse,
  type IntentTaskState,
  type IntentWorldEvent,
  type IntentWorldMessage,
  type IntentWorldSnapshot,
  type IntentWorldState,
  type PlannerProvenance,
  type WorldPoint,
} from "./types.ts";
import { validateIntentPlan } from "./validation.ts";

const EVENT_LIMIT = 120;
const MESSAGE_LIMIT = 80;
const MOVEMENT_PERCENT_PER_MS = 0.018;
const ARRIVAL_DISTANCE = 0.42;
const SHARING_DURATION_MS = 1_150;

function eventId(state: IntentWorldState, prefix: string) {
  return `${prefix}-${state.revision + 1}-${state.events.length + 1}`;
}

function messageId(state: IntentWorldState) {
  return `message-${state.revision + 1}-${state.messages.length + 1}`;
}

function appendEvent(state: IntentWorldState, event: Omit<IntentWorldEvent, "id">) {
  state.events.push({ ...event, id: eventId(state, event.kind) });
  if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT);
}

function appendMessage(state: IntentWorldState, message: Omit<IntentWorldMessage, "id">) {
  state.messages.push({ ...message, id: messageId(state) });
  if (state.messages.length > MESSAGE_LIMIT) state.messages.splice(0, state.messages.length - MESSAGE_LIMIT);
}

function cloneWorld(world: IntentWorldState): IntentWorldState {
  return {
    ...world,
    plan: world.plan ? {
      ...world.plan,
      acceptanceCriteria: [...world.plan.acceptanceCriteria],
      tasks: world.plan.tasks.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    } : null,
    provenance: world.provenance ? { ...world.provenance } : null,
    agents: world.agents.map((agent) => ({
      ...agent,
      position: { ...agent.position },
      target: { ...agent.target },
    })),
    tasks: world.tasks.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    approvals: world.approvals.map((approval) => ({ ...approval })),
    messages: world.messages.map((message) => ({ ...message })),
    events: world.events.map((event) => ({ ...event })),
    validationErrors: [...world.validationErrors],
  };
}

function distance(a: WorldPoint, b: WorldPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveToward(point: WorldPoint, target: WorldPoint, maximumDistance: number) {
  const currentDistance = distance(point, target);
  if (currentDistance <= maximumDistance || currentDistance === 0) return { ...target };
  const ratio = maximumDistance / currentDistance;
  return {
    x: point.x + (target.x - point.x) * ratio,
    y: point.y + (target.y - point.y) * ratio,
  };
}

function dependencyMap(tasks: readonly IntentTaskState[]) {
  return new Map(tasks.map((task) => [task.id, task]));
}

function dependenciesComplete(task: IntentTaskState, tasksById: ReadonlyMap<string, IntentTaskState>) {
  return task.dependsOn.every((dependencyId) => tasksById.get(dependencyId)?.status === "completed");
}

function hasBlockedDependency(task: IntentTaskState, tasksById: ReadonlyMap<string, IntentTaskState>) {
  return task.dependsOn.some((dependencyId) => tasksById.get(dependencyId)?.status === "blocked");
}

function activeTaskForAgent(state: IntentWorldState, agentId: AsymptaAgentId) {
  return state.tasks.find((task) => task.agentId === agentId && ["moving", "working", "awaiting_approval"].includes(task.status));
}

function releaseSharingAgents(state: IntentWorldState) {
  for (const agent of state.agents) {
    if (agent.status === "sharing" && agent.statusUntil !== null && state.now >= agent.statusUntil) {
      agent.status = "idle";
      agent.statusUntil = null;
      agent.taskId = null;
    }
  }
}

function createApproval(state: IntentWorldState, task: IntentTaskState) {
  const existing = state.approvals.find((approval) => approval.taskId === task.id);
  if (existing) return existing;
  const approval: IntentApproval = {
    id: `approval-${task.id}`,
    taskId: task.id,
    agentId: task.agentId,
    title: task.title,
    detail: task.detail,
    consequence: task.consequence,
    actionType: task.actionType,
    status: "pending",
    requestedAt: state.now,
    resolvedAt: null,
  };
  state.approvals.push(approval);
  task.status = "awaiting_approval";
  task.approvalStatus = "pending";
  const agent = state.agents.find((candidate) => candidate.id === task.agentId);
  if (agent) {
    agent.status = "waiting";
    agent.taskId = task.id;
    agent.statusUntil = null;
  }
  appendEvent(state, {
    kind: "approval",
    title: "Human approval required",
    detail: `${task.title}: ${task.consequence}`,
    createdAt: state.now,
    taskId: task.id,
    agentId: task.agentId,
  });
  return approval;
}

function beginTask(state: IntentWorldState, task: IntentTaskState) {
  const agent = state.agents.find((candidate) => candidate.id === task.agentId);
  const location = INTENT_LOCATIONS[task.locationId];
  if (!agent || !location) return;

  task.status = "moving";
  task.startedAt ??= state.now;
  agent.target = { ...location.point };
  agent.status = "moving";
  agent.taskId = task.id;
  agent.statusUntil = null;
  appendEvent(state, {
    kind: "transition",
    title: `${agent.name} accepted a task`,
    detail: `${task.title} is moving to ${location.label}.`,
    createdAt: state.now,
    taskId: task.id,
    agentId: task.agentId,
  });
}

function scheduleReadyTasks(state: IntentWorldState) {
  const tasksById = dependencyMap(state.tasks);
  for (const task of state.tasks) {
    if (task.status !== "queued") continue;
    if (hasBlockedDependency(task, tasksById)) {
      task.status = "blocked";
      appendEvent(state, {
        kind: "validation",
        title: "Task blocked by dependency",
        detail: `${task.title} cannot start because an upstream task was declined or blocked.`,
        createdAt: state.now,
        taskId: task.id,
        agentId: task.agentId,
      });
      continue;
    }
    if (!dependenciesComplete(task, tasksById)) continue;
    if (activeTaskForAgent(state, task.agentId)) continue;
    const sharingAgent = state.agents.find((agent) => agent.id === task.agentId && agent.status === "sharing");
    if (sharingAgent) continue;

    if (task.requiresApproval && task.approvalStatus !== "approved") {
      createApproval(state, task);
      continue;
    }
    beginTask(state, task);
  }
}

function finishTask(state: IntentWorldState, task: IntentTaskState) {
  task.status = "completed";
  task.progress = 1;
  task.completedAt = state.now;
  const agent = state.agents.find((candidate) => candidate.id === task.agentId);
  if (agent) {
    agent.status = "sharing";
    agent.taskId = task.id;
    agent.statusUntil = state.now + SHARING_DURATION_MS;
  }

  appendEvent(state, {
    kind: "completion",
    title: task.title,
    detail: `Validated: ${task.validation}`,
    createdAt: state.now,
    taskId: task.id,
    agentId: task.agentId,
  });

  const dependents = state.tasks.filter((candidate) => candidate.dependsOn.includes(task.id));
  const recipients = new Set<AsymptaAgentId>(dependents.map((candidate) => candidate.agentId));
  if (recipients.size === 0 && task.agentId !== "agent-support") recipients.add("agent-support");
  for (const recipient of recipients) {
    appendMessage(state, {
      fromAgentId: task.agentId,
      toAgentId: recipient,
      kind: "handoff",
      text: `${task.title} completed. ${task.validation}`,
      createdAt: state.now,
    });
  }
}

function advanceActiveTasks(state: IntentWorldState, deltaMs: number) {
  const travelDistance = Math.max(0, deltaMs) * MOVEMENT_PERCENT_PER_MS;
  for (const task of state.tasks) {
    if (task.status !== "moving" && task.status !== "working") continue;
    const agent = state.agents.find((candidate) => candidate.id === task.agentId);
    if (!agent) continue;

    if (task.status === "moving") {
      agent.position = moveToward(agent.position, agent.target, travelDistance);
      if (distance(agent.position, agent.target) <= ARRIVAL_DISTANCE) {
        agent.position = { ...agent.target };
        agent.status = "working";
        task.status = "working";
        appendEvent(state, {
          kind: "transition",
          title: `${agent.name} started work`,
          detail: task.detail,
          createdAt: state.now,
          taskId: task.id,
          agentId: task.agentId,
        });
      }
      continue;
    }

    task.progress = Math.min(1, task.progress + Math.max(0, deltaMs) / Math.max(900, task.workMs));
    if (task.progress >= 1) finishTask(state, task);
  }
}

function derivePhase(state: IntentWorldState) {
  if (state.tasks.length === 0) return "idle" as const;
  if (state.tasks.every((task) => task.status === "completed")) return "completed" as const;
  if (state.tasks.some((task) => task.status === "blocked")) return "blocked" as const;
  const active = state.tasks.some((task) => task.status === "moving" || task.status === "working");
  const pending = state.approvals.some((approval) => approval.status === "pending");
  if (pending && !active) return "waiting_approval" as const;
  return "running" as const;
}

export function validateIntentWorldState(state: IntentWorldState): string[] {
  const errors: string[] = [];
  const taskIds = new Set<string>();
  const agentIds = new Set<string>();
  const tasksById = dependencyMap(state.tasks);

  for (const agent of state.agents) {
    if (agentIds.has(agent.id)) errors.push(`Duplicate agent: ${agent.id}`);
    agentIds.add(agent.id);
    if (!Number.isFinite(agent.position.x) || !Number.isFinite(agent.position.y)) errors.push(`Agent ${agent.id} has an invalid position.`);
  }

  const activePerAgent = new Map<AsymptaAgentId, number>();
  for (const task of state.tasks) {
    if (taskIds.has(task.id)) errors.push(`Duplicate task: ${task.id}`);
    taskIds.add(task.id);
    if (task.progress < 0 || task.progress > 1 || !Number.isFinite(task.progress)) errors.push(`Task ${task.id} has invalid progress.`);
    for (const dependency of task.dependsOn) {
      if (!tasksById.has(dependency)) errors.push(`Task ${task.id} has missing dependency ${dependency}.`);
    }
    if (task.status === "completed") {
      for (const dependency of task.dependsOn) {
        if (tasksById.get(dependency)?.status !== "completed") errors.push(`Task ${task.id} completed before dependency ${dependency}.`);
      }
      if (task.progress !== 1) errors.push(`Completed task ${task.id} must have progress 1.`);
    }
    if (["moving", "working", "awaiting_approval"].includes(task.status)) {
      activePerAgent.set(task.agentId, (activePerAgent.get(task.agentId) ?? 0) + 1);
    }
    if (task.status === "awaiting_approval" && task.approvalStatus !== "pending") {
      errors.push(`Task ${task.id} is awaiting approval without pending approval state.`);
    }
    if (task.requiresApproval && ["moving", "working", "completed"].includes(task.status) && task.approvalStatus !== "approved") {
      errors.push(`Approval-gated task ${task.id} advanced without approval.`);
    }
  }

  for (const [agentId, count] of activePerAgent) {
    if (count > 1) errors.push(`Agent ${agentId} has ${count} simultaneous active tasks.`);
  }

  for (const approval of state.approvals) {
    const task = tasksById.get(approval.taskId);
    if (!task) errors.push(`Approval ${approval.id} points to a missing task.`);
    if (approval.status === "pending" && task?.approvalStatus !== "pending") errors.push(`Approval ${approval.id} and task state disagree.`);
  }

  return errors;
}

function commitCandidate(previous: IntentWorldState, candidate: IntentWorldState) {
  candidate.phase = derivePhase(candidate);
  candidate.revision = previous.revision + 1;
  const errors = validateIntentWorldState(candidate);
  if (errors.length === 0) {
    candidate.validationErrors = [];
    return candidate;
  }

  const safe = cloneWorld(previous);
  safe.now = candidate.now;
  safe.revision = previous.revision + 1;
  safe.phase = "blocked";
  safe.validationErrors = errors;
  appendEvent(safe, {
    kind: "error",
    title: "State transition rejected",
    detail: errors.join(" "),
    createdAt: safe.now,
    taskId: null,
    agentId: null,
  });
  return safe;
}

export function createIntentWorld(now = 0): IntentWorldState {
  return {
    version: 1,
    revision: 0,
    now,
    phase: "idle",
    intent: null,
    plan: null,
    provenance: null,
    agents: createIntentAgents(),
    tasks: [],
    approvals: [],
    messages: [],
    events: [],
    validationErrors: [],
  };
}

export function startIntentWorld(
  previous: IntentWorldState,
  intent: string,
  planInput: IntentPlan,
  provenance: PlannerProvenance,
  now = previous.now,
): IntentWorldState {
  const validation = validateIntentPlan(planInput, intent);
  if (!validation.ok) {
    const safe = cloneWorld(previous);
    safe.now = now;
    safe.revision += 1;
    safe.phase = "blocked";
    safe.validationErrors = [validation.error];
    appendEvent(safe, {
      kind: "error",
      title: "Plan rejected",
      detail: validation.error,
      createdAt: now,
      taskId: null,
      agentId: null,
    });
    return safe;
  }

  const next: IntentWorldState = {
    version: 1,
    revision: previous.revision,
    now,
    phase: "running",
    intent,
    plan: validation.value,
    provenance: { ...provenance },
    agents: createIntentAgents(),
    tasks: validation.value.tasks.map((task) => ({
      ...task,
      dependsOn: [...task.dependsOn],
      status: "queued",
      progress: 0,
      approvalStatus: "none",
      startedAt: null,
      completedAt: null,
    })),
    approvals: [],
    messages: [],
    events: [],
    validationErrors: [],
  };
  appendEvent(next, {
    kind: "plan",
    title: validation.value.title,
    detail: `${validation.value.tasks.length} validated tasks created from the user's intention.`,
    createdAt: now,
    taskId: null,
    agentId: "agent-user",
  });
  appendMessage(next, {
    fromAgentId: "agent-user",
    toAgentId: validation.value.tasks[0]?.agentId ?? "agent-business",
    kind: "handoff",
    text: `Intent accepted: ${validation.value.summary}`,
    createdAt: now,
  });
  scheduleReadyTasks(next);
  return commitCandidate(previous, next);
}

export function advanceIntentWorld(previous: IntentWorldState, deltaMs: number): IntentWorldState {
  if (previous.phase === "idle" || previous.phase === "completed" || previous.phase === "blocked") return previous;
  const boundedDelta = Math.min(250, Math.max(0, deltaMs));
  if (boundedDelta === 0) return previous;

  const next = cloneWorld(previous);
  next.now += boundedDelta;
  releaseSharingAgents(next);
  advanceActiveTasks(next, boundedDelta);
  scheduleReadyTasks(next);
  return commitCandidate(previous, next);
}

export function resolveIntentApproval(previous: IntentWorldState, approvalId: string, approved: boolean): IntentWorldState {
  const next = cloneWorld(previous);
  const approval = next.approvals.find((candidate) => candidate.id === approvalId && candidate.status === "pending");
  if (!approval) return previous;
  const task = next.tasks.find((candidate) => candidate.id === approval.taskId);
  if (!task) return previous;

  approval.status = approved ? "approved" : "declined";
  approval.resolvedAt = next.now;
  task.approvalStatus = approved ? "approved" : "declined";
  task.status = approved ? "queued" : "blocked";
  const agent = next.agents.find((candidate) => candidate.id === approval.agentId);
  if (agent) {
    agent.status = "idle";
    agent.taskId = null;
    agent.statusUntil = null;
  }
  appendEvent(next, {
    kind: "approval",
    title: approved ? "Human approval granted" : "Human approval declined",
    detail: approved
      ? `${task.title} may continue inside the simulation.`
      : `${task.title} was stopped. No consequential action occurred.`,
    createdAt: next.now,
    taskId: task.id,
    agentId: task.agentId,
  });
  scheduleReadyTasks(next);
  return commitCandidate(previous, next);
}

export function intentWorldProgress(state: IntentWorldState) {
  if (state.tasks.length === 0) return 0;
  const total = state.tasks.reduce((sum, task) => sum + (task.status === "completed" ? 1 : task.progress), 0);
  return Math.min(1, Math.max(0, total / state.tasks.length));
}

export function intentWorldSnapshot(state: IntentWorldState): IntentWorldSnapshot {
  return {
    version: 1,
    revision: state.revision,
    phase: state.phase,
    intent: state.intent,
    plan: state.plan ? {
      id: state.plan.id,
      title: state.plan.title,
      summary: state.plan.summary,
      outcome: state.plan.outcome,
      acceptanceCriteria: [...state.plan.acceptanceCriteria],
    } : null,
    provenance: state.provenance ? { ...state.provenance } : null,
    progress: intentWorldProgress(state),
    agents: state.agents.map(({ id, name, role, organisation, side, status, taskId }) => ({ id, name, role, organisation, side, status, taskId })),
    tasks: state.tasks.map(({ id, title, detail, agentId, locationId, dependsOn, status, progress, requiresApproval, approvalStatus, actionType, validation }) => ({
      id,
      title,
      detail,
      agentId,
      locationId,
      dependsOn: [...dependsOn],
      status,
      progress,
      requiresApproval,
      approvalStatus,
      actionType,
      validation,
    })),
    pendingApprovals: state.approvals.filter((approval) => approval.status === "pending").map((approval) => ({ ...approval })),
    messages: state.messages.slice(-24).map((message) => ({ ...message })),
    events: state.events.slice(-30).map((event) => ({ ...event })),
    validationErrors: [...state.validationErrors],
    simulationDisclosure: "All agents, organisations, tools, approvals, payments, orders, messages, and fulfilment shown here are simulated unless a confirmed live connector result explicitly says otherwise.",
  };
}

export function renderIntentWorldToText(state: IntentWorldState) {
  const snapshot = intentWorldSnapshot(state);
  const lines = [
    `Asympta World — ${snapshot.phase}`,
    `Intent: ${snapshot.intent ?? "none"}`,
    `Plan: ${snapshot.plan?.title ?? "none"}`,
    `Progress: ${Math.round(snapshot.progress * 100)}%`,
    `Provider: ${snapshot.provenance?.provider ?? "none"} / ${snapshot.provenance?.model ?? "none"}`,
    "Tasks:",
    ...snapshot.tasks.map((task) => `- [${task.status}] ${task.title} — ${task.agentId} — ${Math.round(task.progress * 100)}%${task.requiresApproval ? ` — approval:${task.approvalStatus}` : ""}`),
    "Pending approvals:",
    ...(snapshot.pendingApprovals.length
      ? snapshot.pendingApprovals.map((approval) => `- ${approval.title}: ${approval.consequence}`)
      : ["- none"]),
    `Disclosure: ${snapshot.simulationDisclosure}`,
  ];
  return lines.join("\n");
}

export function plannerResponseToWorld(
  previous: IntentWorldState,
  intent: string,
  response: IntentPlannerResponse,
) {
  return response.result.ready
    ? startIntentWorld(previous, intent, response.result.plan, response.provenance, previous.now)
    : previous;
}

export function agentName(agentId: AsymptaAgentId) {
  return INTENT_AGENT_BY_ID[agentId].name;
}

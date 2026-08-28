import { cellFor } from "./geography.ts";
import { poeticAreaForCell } from "../poetic-geography.ts";
import { classifyScenario, scenarioFor } from "./scenarios.ts";
import {
  WORLD_ZONES,
  type AgentMessage,
  type AgentTask,
  type InformationPacket,
  type LivingAgent,
  type LivingWorldState,
  type Locale,
  type LocalizedText,
  type LocationContext,
  type LocationSource,
  type Point,
  type ScenarioId,
  type ToolRun,
  type WorldEvent,
  type WorldEventType,
  type WorldSnapshot,
} from "./types.ts";

const STEP_MS = 60;
const EVENT_LIMIT = 180;
const MESSAGE_LIFETIME_MS = 3_600;
const PACKET_LIFETIME_MS = 3_900;
const AGENT_SPEED_PER_MS = 0.0088;
const ARRIVAL_DISTANCE = 0.82;

const text = (en: string, zh: string): LocalizedText => ({
  en,
  "zh-Hant": zh,
});

function cloneWorld(world: LivingWorldState): LivingWorldState {
  return JSON.parse(JSON.stringify(world)) as LivingWorldState;
}

function nextId(world: LivingWorldState, prefix: string) {
  world.revision += 1;
  return `${prefix}-${world.seed.toString(36)}-${world.revision.toString(36)}`;
}

function emit(
  world: LivingWorldState,
  type: WorldEventType,
  title: LocalizedText,
  detail?: LocalizedText,
  refs: Pick<WorldEvent, "agentId" | "taskId"> = {},
) {
  const event: WorldEvent = {
    id: nextId(world, "event"),
    type,
    title,
    detail,
    createdAt: world.now,
    ...refs,
  };
  world.events = [event, ...world.events].slice(0, EVENT_LIMIT);
  return event;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function jitteredPoint(point: Point, index: number): Point {
  const offsetX = ((index * 7) % 5) - 2;
  const offsetY = ((index * 11) % 5) - 2;
  return { x: point.x + offsetX * 0.9, y: point.y + offsetY * 0.72 };
}

const SPAWN_ARC: Point[] = [
  { x: 16, y: 67 },
  { x: 9, y: 81 },
  { x: 18, y: 84 },
  { x: 28, y: 82 },
  { x: 37, y: 76 },
];

const CITY_SPAWNS: Record<string, Point> = {
  "order-conductor": { x: 12, y: 70 },
  "order-receiver": { x: 34, y: 45 },
  "order-merchandiser": { x: 36, y: 47 },
  "order-warehouse": { x: 44, y: 68 },
  "order-procurement": { x: 35, y: 43 },
  "order-supplier": { x: 70, y: 29 },
  "order-workshop": { x: 51.5, y: 73.5 },
  "order-quality": { x: 43, y: 22 },
  "order-fulfilment": { x: 46, y: 70 },
  "order-finance": { x: 58, y: 49 },
  "order-carrier": { x: 87, y: 59 },
  "order-support": { x: 24, y: 25 },
};

function taskDestination(task: AgentTask): Point {
  if (task.zone === "human") {
    return task.kind === "report" ? { x: 13, y: 69 } : { x: 12, y: 70 };
  }
  return WORLD_ZONES[task.zone].point;
}

function coordinatorId(world: LivingWorldState) {
  const synthesis = world.tasks.find((task) => task.kind === "synthesis");
  return synthesis?.agentId ?? world.agents[0]?.id ?? "coordinator";
}

function convergenceSlot(world: LivingWorldState, agentId: string): Point {
  if (agentId === coordinatorId(world)) return WORLD_ZONES.convergence.point;
  const specialists = world.agents.filter((agent) => agent.id !== coordinatorId(world));
  const index = Math.max(0, specialists.findIndex((agent) => agent.id === agentId));
  const count = Math.max(1, specialists.length);
  const angle = -Math.PI * 0.84 + (index / Math.max(1, count - 1)) * Math.PI * 1.68;
  const radiusX = count > 7 ? 13.5 : 10;
  const radiusY = count > 7 ? 15 : 12.5;
  return {
    x: WORLD_ZONES.convergence.point.x + Math.cos(angle) * radiusX,
    y: WORLD_ZONES.convergence.point.y + Math.sin(angle) * radiusY,
  };
}

function cityStreetWaypoint(agent: LivingAgent, target: Point): Point {
  const horizontalFirst = [...agent.id].reduce((total, char) => total + char.charCodeAt(0), 0) % 2 === 0;
  const dx = Math.abs(target.x - agent.position.x);
  const dy = Math.abs(target.y - agent.position.y);
  if (horizontalFirst && dx > 1.1) return { x: target.x, y: agent.position.y };
  if (!horizontalFirst && dy > 1.1) return { x: agent.position.x, y: target.y };
  if (dx > 1.1) return { x: target.x, y: agent.position.y };
  if (dy > 1.1) return { x: agent.position.x, y: target.y };
  return target;
}

function moveAgent(agent: LivingAgent, target: Point, deltaMs: number) {
  const finalRemaining = distance(agent.position, target);
  agent.target = target;
  if (finalRemaining <= ARRIVAL_DISTANCE) {
    agent.position = { ...target };
    return true;
  }

  const waypoint = finalRemaining <= 2.2 ? target : cityStreetWaypoint(agent, target);
  const dx = waypoint.x - agent.position.x;
  const dy = waypoint.y - agent.position.y;
  const segmentRemaining = Math.hypot(dx, dy);
  if (segmentRemaining <= ARRIVAL_DISTANCE) {
    agent.position = { ...waypoint };
    return distance(agent.position, target) <= ARRIVAL_DISTANCE;
  }

  const travel = Math.min(segmentRemaining, AGENT_SPEED_PER_MS * deltaMs);
  const nextX = agent.position.x + (dx / segmentRemaining) * travel;
  const nextY = agent.position.y + (dy / segmentRemaining) * travel;
  agent.facing = nextX < agent.position.x ? "left" : "right";
  agent.position = { x: nextX, y: nextY };
  return distance(agent.position, target) <= ARRIVAL_DISTANCE;
}

export function locationContextForCoordinates(
  lat: number,
  lng: number,
  source: LocationSource,
  now = Date.now(),
): LocationContext {
  const cell = cellFor(lat, lng);
  const poetic = poeticAreaForCell(cell.id);
  return {
    source,
    cellId: cell.id,
    groupId: poetic.id,
    worldName: poetic.name,
    areaName: poetic.cellName,
    updatedAt: now,
  };
}

export function demoLocation(now = Date.now()): LocationContext {
  return locationContextForCoordinates(22.3193, 114.1694, "demo", now);
}

export function createLivingWorld(
  seed = 2_026_0827,
  now = Date.now(),
  location = demoLocation(now),
): LivingWorldState {
  return {
    version: 1,
    revision: 0,
    seed,
    now,
    phase: "idle",
    tasks: [],
    agents: [],
    toolRuns: [],
    messages: [],
    packets: [],
    events: [],
    approval: { status: "none" },
    location,
  };
}

function spawnAgents(world: LivingWorldState, scenarioId: ScenarioId) {
  const scenario = scenarioFor(scenarioId);
  return scenario.agents.map<LivingAgent>((profile, index) => {
    const base = CITY_SPAWNS[profile.id] ?? SPAWN_ARC[index] ?? {
      x: 10 + ((index - SPAWN_ARC.length) % 8) * 9.5,
      y: 84 - Math.floor((index - SPAWN_ARC.length) / 8) * 8,
    };
    const position = jitteredPoint(base, index);
    return {
      id: profile.id,
      profile,
      status: "waiting",
      position,
      target: position,
      thought: text("Ready when useful", "有需要時準備工作"),
      facing: index % 2 === 0 ? "right" : "left",
    };
  });
}

function instantiateTasks(scenarioId: ScenarioId): AgentTask[] {
  return scenarioFor(scenarioId).tasks.map((task) => ({
    ...task,
    dependencies: [...task.dependencies],
    status: "queued",
    progress: 0,
    approvalStatus: task.requiresApproval ? "none" : undefined,
  }));
}

export function startHumanNeed(
  current: LivingWorldState,
  input: string,
  preferredScenario?: ScenarioId,
) {
  const world = createLivingWorld(current.seed, current.now, current.location);
  const scenarioId = classifyScenario(input, preferredScenario);
  const scenario = scenarioFor(scenarioId);
  const cleanInput = input.trim() || scenario.prompt.en;
  world.scenarioId = scenarioId;
  world.phase = "understanding";
  world.need = {
    id: nextId(world, "need"),
    category: scenario.category,
    scenarioId,
    text: cleanInput.slice(0, 320),
    status: "understanding",
    createdAt: world.now,
  };
  world.agents = spawnAgents(world, scenarioId);
  world.tasks = instantiateTasks(scenarioId);
  emit(
    world,
    "need_created",
    text("A human need entered the world", "一項人的需要進入世界"),
    text(cleanInput, cleanInput),
  );
  emit(
    world,
    "need_classified",
    text(`${scenario.label.en} need understood`, `已理解${scenario.label["zh-Hant"]}需要`),
    text(
      `${scenario.agents.length} useful agents · ${scenario.services.length} services available`,
      `${scenario.agents.length} 個有用 Agent · ${scenario.services.length} 項可用服務`,
    ),
  );
  for (const task of world.tasks) {
    emit(world, "task_created", task.title, undefined, {
      taskId: task.id,
      agentId: task.agentId,
    });
  }
  return world;
}

export function startScenario(current: LivingWorldState, scenarioId: ScenarioId) {
  const scenario = scenarioFor(scenarioId);
  return startHumanNeed(current, scenario.prompt.en, scenarioId);
}

function dependenciesComplete(world: LivingWorldState, task: AgentTask) {
  return task.dependencies.every(
    (dependency) => world.tasks.find((candidate) => candidate.id === dependency)?.status === "done",
  );
}

function dependenciesConverged(world: LivingWorldState, task: AgentTask) {
  if (task.kind !== "synthesis") return true;
  return task.dependencies.every((dependency) => {
    const dependencyTask = world.tasks.find((candidate) => candidate.id === dependency);
    const agent = dependencyTask
      ? world.agents.find((candidate) => candidate.id === dependencyTask.agentId)
      : undefined;
    return agent
      ? distance(agent.position, convergenceSlot(world, agent.id)) <= 1.4
      : false;
  });
}

function agentHasActiveTask(world: LivingWorldState, agentId: string, exceptTaskId?: string) {
  return world.tasks.some(
    (task) =>
      task.agentId === agentId &&
      task.id !== exceptTaskId &&
      (task.status === "moving" || task.status === "working"),
  );
}

function addMessage(
  world: LivingWorldState,
  fromId: string,
  toId: string,
  messageText: LocalizedText,
  type: AgentMessage["type"] = "result",
) {
  const message: AgentMessage = {
    id: nextId(world, "message"),
    fromId,
    toId,
    type,
    text: messageText,
    createdAt: world.now,
    expiresAt: world.now + MESSAGE_LIFETIME_MS,
  };
  const packet: InformationPacket = {
    id: nextId(world, "packet"),
    fromId,
    toId,
    text: messageText,
    createdAt: world.now,
    expiresAt: world.now + PACKET_LIFETIME_MS,
  };
  world.messages = [...world.messages, message].slice(-16);
  world.packets = [...world.packets, packet].slice(-16);
  emit(world, "agent_message", messageText, text("Information exchanged", "已交換資訊"), {
    agentId: fromId,
  });
}

function requestTaskApproval(world: LivingWorldState, task: AgentTask, agent: LivingAgent) {
  task.approvalStatus = "pending";
  world.approval = {
    status: "pending",
    kind: "task",
    actionId: `task:${task.id}`,
    taskId: task.id,
    requestedAt: world.now,
  };
  world.phase = "waiting_for_human";
  if (world.need) world.need.status = "waiting_for_human";
  agent.status = "waiting";
  agent.thought = task.approvalLabel ?? text("Waiting for your approval", "等待你的批准");
  addMessage(
    world,
    agent.id,
    "human",
    task.approvalLabel ?? text("Your approval is required", "需要你的批准"),
    "approval",
  );
  emit(
    world,
    "human_approval_required",
    text("The world paused before a consequential handoff", "世界在重要交接前暫停"),
    task.approvalLabel ?? task.title,
    { agentId: agent.id, taskId: task.id },
  );
}

function beginReadyTasks(world: LivingWorldState) {
  if (world.approval.status === "pending" && world.approval.kind === "task") return;

  for (const task of world.tasks) {
    if (task.status !== "queued") continue;
    if (!dependenciesComplete(world, task) || !dependenciesConverged(world, task)) continue;
    if (agentHasActiveTask(world, task.agentId, task.id)) continue;
    const agent = world.agents.find((candidate) => candidate.id === task.agentId);
    if (!agent) continue;

    if (task.requiresApproval && task.approvalStatus !== "approved") {
      if (task.approvalStatus !== "declined") requestTaskApproval(world, task, agent);
      return;
    }

    if (
      task.requiresApproval &&
      task.approvalStatus === "approved" &&
      world.approval.kind === "task" &&
      world.approval.taskId === task.id
    ) {
      world.approval = { status: "none" };
    }

    task.status = "moving";
    task.startedAt = world.now;
    task.progress = 0;
    agent.status = "moving";
    agent.taskId = task.id;
    agent.target = taskDestination(task);
    agent.thought = task.thought;
    emit(
      world,
      "agent_assigned",
      text(`${agent.profile.name} joined`, `${agent.profile.name} 加入工作`),
      task.title,
      { agentId: agent.id, taskId: task.id },
    );
    emit(
      world,
      "agent_moving",
      text(`${agent.profile.name} is moving with purpose`, `${agent.profile.name} 正前往工作位置`),
      WORLD_ZONES[task.zone].label,
      { agentId: agent.id, taskId: task.id },
    );
    if (task.kind === "synthesis") {
      world.phase = "converging";
      if (world.need) world.need.status = "converging";
    } else if (task.kind === "report") {
      world.phase = "reporting";
    } else if (task.kind !== "interpret") {
      world.phase = "coordinating";
      if (world.need) world.need.status = "working";
    }
  }
}

function startToolRun(world: LivingWorldState, task: AgentTask, agent: LivingAgent) {
  if (!world.scenarioId || !task.toolId || task.toolRunId) return;
  const service = scenarioFor(world.scenarioId).services.find((candidate) => candidate.id === task.toolId);
  if (!service) return;
  const run: ToolRun = {
    id: nextId(world, "tool"),
    toolId: service.id,
    agentId: agent.id,
    taskId: task.id,
    mode: service.mode,
    status: "running",
    startedAt: world.now,
    completesAt: world.now + service.latencyMs,
  };
  world.toolRuns = [...world.toolRuns, run].slice(-32);
  task.toolRunId = run.id;
  emit(
    world,
    "tool_requested",
    text(`${agent.profile.name} reached ${service.name.en}`, `${agent.profile.name} 連接${service.name["zh-Hant"]}`),
    text(
      `${service.mode.toUpperCase()} · ${service.description.en}`,
      `${service.mode.toUpperCase()} · ${service.description["zh-Hant"]}`,
    ),
    { agentId: agent.id, taskId: task.id },
  );
}

function completeToolRuns(world: LivingWorldState) {
  if (!world.scenarioId) return;
  const scenario = scenarioFor(world.scenarioId);
  for (const run of world.toolRuns) {
    if (run.status !== "running" || world.now < run.completesAt) continue;
    const service = scenario.services.find((candidate) => candidate.id === run.toolId);
    if (!service) continue;
    run.status = "succeeded";
    run.completedAt = world.now;
    run.result = service.result;
    emit(
      world,
      "tool_result",
      text(`${service.name.en} returned`, `${service.name["zh-Hant"]}已回傳`),
      text(
        `${service.mode.toUpperCase()} · ${service.result.en}`,
        `${service.mode.toUpperCase()} · ${service.result["zh-Hant"]}`,
      ),
      { agentId: run.agentId, taskId: run.taskId },
    );
  }
}

function toolReady(world: LivingWorldState, task: AgentTask) {
  if (!task.toolId) return true;
  const run = world.toolRuns.find((candidate) => candidate.id === task.toolRunId);
  return run?.status === "succeeded";
}

function dependentRecipients(world: LivingWorldState, task: AgentTask) {
  const recipients = world.tasks
    .filter((candidate) => candidate.dependencies.includes(task.id))
    .map((candidate) => candidate.agentId)
    .filter((id) => id !== task.agentId);
  return [...new Set(recipients)];
}

function completeTask(world: LivingWorldState, task: AgentTask, agent: LivingAgent) {
  task.status = "done";
  task.progress = 1;
  task.completedAt = world.now;
  agent.taskId = undefined;
  agent.lastOutput = task.completion;
  if (task.kind === "specialist") {
    agent.status = "sharing";
    agent.target = convergenceSlot(world, agent.id);
    agent.thought = text("Sharing what I found", "分享找到的資訊");
    const recipients = dependentRecipients(world, task);
    const targets = recipients.length ? recipients : [coordinatorId(world)];
    for (const recipient of targets) addMessage(world, agent.id, recipient, task.completion, "result");
  } else if (task.kind === "interpret") {
    agent.status = "returning";
    agent.target = convergenceSlot(world, agent.id);
    agent.thought = text("Delegating useful work", "分派有用工作");
    if (world.scenarioId) {
      const specialists = scenarioFor(world.scenarioId).tasks.filter(
        (candidate) => candidate.kind === "specialist",
      ).length;
      addMessage(
        world,
        agent.id,
        "team",
        text(`${specialists} focused tasks`, `${specialists} 項專注任務`),
        "delegation",
      );
    }
  } else if (task.kind === "synthesis") {
    agent.status = "waiting";
    agent.thought = task.completion;
    emit(world, "result_candidate", task.completion, text("Evidence converged", "證據已匯合"), {
      agentId: agent.id,
      taskId: task.id,
    });
  } else if (task.kind === "report") {
    agent.status = "done";
    agent.thought = task.completion;
    if (world.scenarioId) world.result = scenarioFor(world.scenarioId).result;
    world.phase = "ready";
    if (world.need) world.need.status = "ready";
    emit(
      world,
      "result_candidate",
      text("One useful outcome is ready", "一個有用結果已準備"),
      task.completion,
      { agentId: agent.id, taskId: task.id },
    );
  }
}

function updateTasks(world: LivingWorldState, deltaMs: number) {
  for (const task of world.tasks) {
    if (task.status !== "moving" && task.status !== "working") continue;
    const agent = world.agents.find((candidate) => candidate.id === task.agentId);
    if (!agent) continue;
    const destination = taskDestination(task);
    if (task.status === "moving") {
      const arrived = moveAgent(agent, destination, deltaMs);
      if (!arrived) continue;
      task.status = "working";
      task.workStartedAt = world.now;
      agent.status = "working";
      agent.thought = task.thought;
      emit(world, "agent_working", task.title, task.thought, {
        agentId: agent.id,
        taskId: task.id,
      });
    }
    if (task.status !== "working") continue;
    const proposed = Math.min(1, task.progress + deltaMs / task.durationMs);
    if (task.toolId && proposed >= 0.18 && !task.toolRunId) startToolRun(world, task, agent);
    task.progress = task.toolId && !toolReady(world, task) ? Math.min(0.44, proposed) : proposed;
    if (task.progress >= 1 && toolReady(world, task)) completeTask(world, task, agent);
  }
}

function nextTaskForAgent(world: LivingWorldState, agentId: string) {
  return world.tasks.find((task) => task.agentId === agentId && task.status !== "done");
}

function settleUnassignedAgents(world: LivingWorldState, deltaMs: number) {
  for (const agent of world.agents) {
    if (agent.taskId || agentHasActiveTask(world, agent.id)) continue;
    const next = nextTaskForAgent(world, agent.id);
    const completedSpecialist = world.tasks.find(
      (task) => task.agentId === agent.id && task.kind === "specialist" && task.status === "done",
    );
    const completedInterpret = world.tasks.find(
      (task) => task.agentId === agent.id && task.kind === "interpret" && task.status === "done",
    );
    if (completedSpecialist || completedInterpret) {
      const arrived = moveAgent(agent, convergenceSlot(world, agent.id), deltaMs);
      agent.status = arrived ? "done" : completedSpecialist ? "sharing" : "returning";
      if (arrived) {
        agent.thought = completedSpecialist?.completion ?? text("Waiting for the team", "等待團隊");
      }
      continue;
    }
    if (next?.status === "queued") {
      agent.status = "waiting";
      agent.thought = next.approvalStatus === "declined"
        ? text("Held by the human", "由人暫停")
        : text("Waiting for useful context", "等待有用情境");
    }
  }
}

function expireTransientState(world: LivingWorldState) {
  world.messages = world.messages.filter((message) => message.expiresAt > world.now);
  world.packets = world.packets.filter((packet) => packet.expiresAt > world.now);
  if (world.celebrationUntil && world.celebrationUntil <= world.now) {
    world.celebrationUntil = undefined;
  }
}

function advanceChunk(world: LivingWorldState, deltaMs: number) {
  world.now += deltaMs;
  expireTransientState(world);
  if (world.approval.status === "pending" && world.approval.kind === "task") return;
  completeToolRuns(world);
  beginReadyTasks(world);
  if (world.approval.status === "pending" && world.approval.kind === "task") return;
  updateTasks(world, deltaMs);
  settleUnassignedAgents(world, deltaMs);
  beginReadyTasks(world);
}

export function advanceLivingWorld(current: LivingWorldState, deltaMs: number) {
  const world = cloneWorld(current);
  const bounded = Math.max(0, Math.min(deltaMs, 120_000));
  let remaining = bounded;
  while (remaining > 0) {
    const step = Math.min(STEP_MS, remaining);
    advanceChunk(world, step);
    remaining -= step;
    if (world.approval.status === "pending" && world.approval.kind === "task") break;
  }
  return world;
}

export function setWorldLocation(current: LivingWorldState, location: LocationContext) {
  const world = cloneWorld(current);
  world.location = location;
  world.now = Math.max(world.now, location.updatedAt);
  emit(
    world,
    "location_changed",
    text(`Local world · ${location.worldName.en}`, `所在地世界 · ${location.worldName["zh-Hant"]}`),
    text(location.areaName.en, location.areaName["zh-Hant"]),
  );
  return world;
}

export function resetLivingWorld(current: LivingWorldState) {
  const world = createLivingWorld(current.seed, current.now, current.location);
  emit(world, "world_reset", text("World reset", "世界已重設"));
  return world;
}

export function chooseResult(current: LivingWorldState, actionId: string) {
  const world = cloneWorld(current);
  if (!world.result || !world.need) return world;
  const action = [world.result.primaryAction, world.result.secondaryAction].find(
    (candidate) => candidate.id === actionId,
  );
  if (!action) return world;
  if (action.consequential) {
    world.approval = {
      status: "pending",
      kind: "result",
      actionId,
      requestedAt: world.now,
    };
    world.phase = "waiting_for_human";
    world.need.status = "waiting_for_human";
    addMessage(
      world,
      coordinatorId(world),
      "human",
      text("Your approval is required", "需要你的批准"),
      "approval",
    );
    emit(
      world,
      "human_approval_required",
      text("This action needs you", "這項行動需要你"),
      action.label,
    );
    return world;
  }
  world.phase = "completed";
  world.need.status = "completed";
  world.need.completedAt = world.now;
  world.celebrationUntil = world.now + 2_800;
  emit(world, "need_completed", text("Need completed", "需要已完成"), action.label);
  return world;
}

export function resolveApproval(current: LivingWorldState, approved: boolean) {
  const world = cloneWorld(current);
  if (world.approval.status !== "pending" || !world.need) return world;

  if (world.approval.kind === "task" && world.approval.taskId) {
    const task = world.tasks.find((candidate) => candidate.id === world.approval.taskId);
    if (!task) return world;
    task.approvalStatus = approved ? "approved" : "declined";
    world.approval = {
      ...world.approval,
      status: approved ? "approved" : "declined",
      resolvedAt: world.now,
    };
    if (!approved) {
      world.phase = "waiting_for_human";
      world.need.status = "waiting_for_human";
      emit(
        world,
        "human_approval_required",
        text("Consequential handoff remains on hold", "重要交接繼續暫停"),
        task.approvalLabel ?? task.title,
        { agentId: task.agentId, taskId: task.id },
      );
      return world;
    }
    world.phase = "coordinating";
    world.need.status = "working";
    emit(
      world,
      "human_approved",
      text("You approved the simulated handoff", "你已批准模擬交接"),
      task.approvalLabel ?? task.title,
      { agentId: task.agentId, taskId: task.id },
    );
    return world;
  }

  world.approval = {
    ...world.approval,
    status: approved ? "approved" : "declined",
    resolvedAt: world.now,
  };
  if (!approved) {
    world.phase = "ready";
    world.need.status = "ready";
    emit(world, "human_approval_required", text("Action kept on hold", "行動繼續暫停"));
    return world;
  }
  emit(
    world,
    "human_approved",
    text("You approved the action", "你已批准行動"),
    text("Approval recorded in demo mode", "已在示範模式記錄批准"),
  );
  world.phase = "completed";
  world.need.status = "completed";
  world.need.completedAt = world.now;
  world.celebrationUntil = world.now + 2_800;
  emit(
    world,
    "action_completed",
    text("Demo handoff completed · nothing was sent", "示範交接已完成 · 沒有發送任何內容"),
    text(
      "A live connected service would execute only after this approval.",
      "只有連接真實服務後，才會在批准後執行。",
    ),
  );
  emit(world, "need_completed", text("Need completed", "需要已完成"));
  return world;
}

export function exchangeAgentInformation(
  current: LivingWorldState,
  fromId: string,
  toId: string,
  messageText: string,
) {
  const world = cloneWorld(current);
  const clean = messageText.trim().slice(0, 180);
  if (!clean) return world;
  addMessage(world, fromId, toId, text(clean, clean), "info");
  return world;
}

export function worldSnapshot(world: LivingWorldState, locale: Locale): WorldSnapshot {
  const agentName = (id: string) =>
    world.agents.find((agent) => agent.id === id)?.profile.name ?? id;
  return {
    coordinateSystem: "World percentages: origin is top-left; x increases right, y increases down.",
    phase: world.phase,
    location: {
      source: world.location.source,
      worldName: world.location.worldName[locale],
      areaName: world.location.areaName[locale],
    },
    need: world.need
      ? {
          text: world.need.text,
          status: world.need.status,
          scenario: world.need.scenarioId,
        }
      : null,
    agents: world.agents.map((agent) => ({
      id: agent.id,
      name: agent.profile.name,
      species: agent.profile.species,
      role: agent.profile.role[locale],
      status: agent.status,
      thought: agent.thought[locale],
      x: Number(agent.position.x.toFixed(2)),
      y: Number(agent.position.y.toFixed(2)),
    })),
    tasks: world.tasks.map((task) => ({
      id: task.id,
      title: task.title[locale],
      status: task.status,
      progress: Number(task.progress.toFixed(3)),
      dependencies: [...task.dependencies],
      requiresApproval: Boolean(task.requiresApproval),
      approvalStatus: task.approvalStatus,
    })),
    activeMessages: world.messages.map((message) => ({
      from: agentName(message.fromId),
      to: agentName(message.toId),
      type: message.type,
      text: message.text[locale],
    })),
    toolRuns: world.toolRuns.map((run) => ({
      tool: run.toolId,
      mode: run.mode,
      status: run.status,
    })),
    resultReady: Boolean(world.result),
    approval: world.approval.status,
  };
}

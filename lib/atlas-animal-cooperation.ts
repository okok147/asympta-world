import * as canonical from "./atlas-canonical-world.ts";
import {
  createRuntimeIntent,
  executeRuntimeIntent,
  publishRuntimeInformation,
  type RuntimeHistoryEvent,
} from "./agentic-world-runtime.ts";

export * from "./atlas-canonical-world.ts";

export type SimulationSpeed = 1 | 2 | 3 | 4 | 5;

type AnimalCooperationWorld = canonical.AtlasWorldState & {
  simulationSpeed?: number;
  cooperationProjection?: {
    eventIds: string[];
  };
};

const COOPERATION_EVENT_TYPES = new Set([
  "workflow_started",
  "supplier_capacity_shock",
  "information_discovered",
  "information_sent",
  "alternative_selected",
  "intent_rejected",
  "payment_transferred",
  "shipment_released",
  "delivery_arrived",
  "customer_update",
  "autonomous_status_need",
  "commitment_violated",
  "escalation_requested",
  "escalation_resolved",
  "escalation_unresolved",
]);

const RUNTIME_ENTITY_TO_AGENT: Record<string, string> = {
  "supplier-primary": "agent-supplier",
  "supplier-alternate": "agent-supplier",
  "agent-customer": "agent-customer",
  "agent-business": "agent-business",
  "agent-logistics": "agent-logistics",
  "agent-operations": "agent-operations",
  "agent-finance": "agent-finance",
  "agent-market": "agent-market",
  "agent-support": "agent-support",
  "agent-quality": "agent-quality",
  "agent-user": "agent-user",
};

const FALLBACK_TARGET: Record<string, string> = {
  alternative_selected: "agent-operations",
  intent_rejected: "agent-operations",
  supplier_capacity_shock: "agent-operations",
  autonomous_status_need: "agent-customer",
  workflow_started: "agent-customer",
};

const COOPERATION_COPY: Record<string, string> = {
  workflow_started: "I received the need — coordinating the world around it.",
  supplier_capacity_shock: "Supply changed — I’m alerting operations.",
  information_discovered: "I found new information — sharing it now.",
  information_sent: "Here is the information you need for the next step.",
  alternative_selected: "The first option failed — I found another path.",
  intent_rejected: "This path is blocked — I’m asking for another route.",
  payment_transferred: "Payment confirmed — the next stakeholder can continue.",
  shipment_released: "Shipment released — handing over to delivery.",
  delivery_arrived: "Delivery arrived — the handoff is complete.",
  customer_update: "Here’s the latest update so you know what’s happening.",
  autonomous_status_need: "The customer needs an update — I’m taking care of it.",
  commitment_violated: "A commitment slipped — recovery coordination is starting.",
  escalation_requested: "I’m stuck on this path — escalating it instead of restarting.",
  escalation_resolved: "I found a workable higher-level path — continue from where you stopped.",
  escalation_unresolved: "I checked the higher-level options, but this still needs another capability or a person.",
};

const ESCALATION_WORK_MS = 2_600;
const DEMO_STUCK_TASK_ID = "sr-supplier";
const ALTERNATE_SUPPLIER = "supplier-alternate";
const MAX_ADVANCE_CHUNK_MS = 140;

function normalizedSimulationSpeed(value: number | undefined): SimulationSpeed {
  const rounded = Math.round(Number.isFinite(value) ? Number(value) : 1);
  return Math.max(1, Math.min(5, rounded)) as SimulationSpeed;
}

export function atlasSimulationSpeed(current: canonical.AtlasWorldState) {
  return normalizedSimulationSpeed((current as AnimalCooperationWorld).simulationSpeed);
}

export function setAtlasSimulationSpeed(current: canonical.AtlasWorldState, speed: number) {
  const world = JSON.parse(JSON.stringify(current)) as AnimalCooperationWorld;
  world.simulationSpeed = normalizedSimulationSpeed(speed);
  canonical.persistAtlasWorld(world);
  return world;
}

function visibleAgentId(world: canonical.AtlasWorldState, entityId: string | undefined) {
  if (!entityId) return null;
  if (world.agents.some((agent) => agent.id === entityId)) return entityId;
  const mapped = RUNTIME_ENTITY_TO_AGENT[entityId];
  return mapped && world.agents.some((agent) => agent.id === mapped) ? mapped : null;
}

function cooperationText(event: RuntimeHistoryEvent) {
  return COOPERATION_COPY[event.type] ?? event.title;
}

function cooperationPair(world: canonical.AtlasWorldState, event: RuntimeHistoryEvent) {
  const fromAgentId = visibleAgentId(world, event.actorId);
  let toAgentId = visibleAgentId(world, event.targetId);

  if (!toAgentId) toAgentId = visibleAgentId(world, FALLBACK_TARGET[event.type]);
  if (fromAgentId && toAgentId && fromAgentId === toAgentId) {
    toAgentId = visibleAgentId(world, FALLBACK_TARGET[event.type] ?? "agent-operations");
  }
  if (!fromAgentId || !toAgentId || fromAgentId === toAgentId) return null;
  return { fromAgentId, toAgentId };
}

function nextEscalationRuntimeId(world: canonical.AtlasWorldState, prefix: string) {
  world.runtime.revision += 1;
  return `${prefix}-${world.runtime.seed.toString(36)}-${world.runtime.revision.toString(36)}`;
}

function appendEscalationHistory(
  world: canonical.AtlasWorldState,
  type: "escalation_requested" | "escalation_resolved" | "escalation_unresolved",
  title: string,
  detail: string,
  actorId: string,
  targetId: string,
  taskId: string,
  causeIds: string[] = [],
) {
  const event: RuntimeHistoryEvent = {
    id: nextEscalationRuntimeId(world, "cause"),
    type,
    title,
    detail,
    createdAt: world.now,
    actorId,
    targetId,
    intentId: `task:${taskId}`,
    causeIds,
    visibility: "participants",
  };
  world.runtime.history.push(event);
  if (world.runtime.history.length > 360) world.runtime.history.splice(0, world.runtime.history.length - 360);
  return event;
}

function pushEscalationWorldEvent(
  world: canonical.AtlasWorldState,
  title: string,
  detail: string,
  agentId: string,
  taskId: string,
) {
  world.revision += 1;
  world.events = [
    {
      id: `escalation-event-${world.revision.toString(36)}-${Math.floor(world.now).toString(36)}`,
      title,
      detail,
      createdAt: world.now,
      agentId,
      taskId,
    },
    ...world.events,
  ].slice(0, 120);
}

function escalationResolver(agentId: string) {
  if (["agent-supplier", "agent-finance", "agent-support", "agent-customer", "agent-market"].includes(agentId)) {
    return { agentId: "agent-business", locationId: "otemachi" };
  }
  return { agentId: "agent-operations", locationId: "shinagawa" };
}

function hasEscalationRequest(world: canonical.AtlasWorldState, taskId: string) {
  return world.runtime.history.some((event) => event.type === "escalation_requested" && event.intentId === `task:${taskId}`);
}

function escalationRequest(world: canonical.AtlasWorldState, taskId: string) {
  return [...world.runtime.history].reverse().find((event) => event.type === "escalation_requested" && event.intentId === `task:${taskId}`);
}

function hasEscalationResolution(world: canonical.AtlasWorldState, taskId: string) {
  return world.runtime.history.some((event) => ["escalation_resolved", "escalation_unresolved"].includes(event.type) && event.intentId === `task:${taskId}`);
}

function createEscalationTask(world: canonical.AtlasWorldState, blockedTask: canonical.AtlasTaskState) {
  if (blockedTask.id.startsWith("escalation-") || hasEscalationRequest(world, blockedTask.id)) return;
  if (blockedTask.approvalStatus === "declined") return;

  const resolver = escalationResolver(blockedTask.agentId);
  const higherAgent = world.agents.find((agent) => agent.id === resolver.agentId);
  const stuckAgent = world.agents.find((agent) => agent.id === blockedTask.agentId);
  const destination = canonical.ATLAS_LOCATIONS[resolver.locationId]?.point;
  if (!higherAgent || !stuckAgent || !destination) return;

  const escalationTaskId = `escalation-${blockedTask.id}`;
  world.tasks.push({
    id: escalationTaskId,
    title: `Escalate: ${blockedTask.title}`,
    detail: `Higher-level coordination is resolving the blocked path without resetting the workflow. ${blockedTask.blockingReason ?? ""}`.trim(),
    agentId: resolver.agentId,
    locationId: resolver.locationId,
    dependsOn: [],
    workMs: ESCALATION_WORK_MS,
    status: "moving",
    progress: 0,
    startedAt: world.now,
  });
  higherAgent.status = "moving";
  higherAgent.taskId = escalationTaskId;
  higherAgent.target = { ...destination };
  stuckAgent.status = "waiting";
  stuckAgent.taskId = blockedTask.id;
  world.phase = "running";
  world.revision += 1;

  appendEscalationHistory(
    world,
    "escalation_requested",
    "Stuck task escalated",
    `${blockedTask.title} is blocked in place. ${resolver.agentId} is taking a higher-level resolution task; no workflow, money or completed work was reset.`,
    blockedTask.agentId,
    resolver.agentId,
    blockedTask.id,
  );
  pushEscalationWorldEvent(
    world,
    "Higher agent escalation",
    `${blockedTask.title} is stuck. ${higherAgent.name} is resolving it without restarting the world.`,
    resolver.agentId,
    escalationTaskId,
  );
  canonical.persistAtlasWorld(world);
}

function injectDemonstrationStuck(world: canonical.AtlasWorldState) {
  if (world.workflowId !== "service-recovery") return;
  const task = world.tasks.find((candidate) => candidate.id === DEMO_STUCK_TASK_ID);
  if (!task || task.status !== "working" || task.progress < 0.42 || hasEscalationRequest(world, task.id)) return;

  task.status = "blocked";
  task.blockingReason = "The ordinary replacement-supplier path cannot meet the promised recovery window; a higher coordinator must choose the alternate route.";
  const agent = world.agents.find((candidate) => candidate.id === task.agentId);
  if (agent) {
    agent.status = "waiting";
    agent.taskId = task.id;
  }
  world.revision += 1;
  createEscalationTask(world, task);
}

function alternateSupplierCanCover(world: canonical.AtlasWorldState) {
  const order = world.runtime.orders.at(-1);
  const quantity = Math.max(1, order?.quantity ?? 1);
  const stock = world.runtime.inventories.find((item) => item.ownerId === ALTERNATE_SUPPLIER && item.resourceId === (order?.resourceId ?? "material-unit"));
  const capacity = world.runtime.capacities.find((item) => item.ownerId === ALTERNATE_SUPPLIER && item.capacityId === "fulfilment");
  const inventoryAvailable = stock ? Math.max(0, stock.onHand - stock.reserved) : 0;
  const capacityAvailable = capacity ? Math.max(0, capacity.total - capacity.reserved) : 0;
  return inventoryAvailable >= quantity && capacityAvailable >= quantity;
}

function reserveAlternateSupply(world: canonical.AtlasWorldState, actorId: string, reason: string) {
  if (!alternateSupplierCanCover(world)) return false;
  const order = world.runtime.orders.at(-1);
  if (!order) return false;
  const priorStatus = order.status;
  const priorPaymentAmount = order.paymentAmount;
  const intent = createRuntimeIntent(world.runtime, actorId, "reserve_capacity", {
    targetId: ALTERNATE_SUPPLIER,
    resourceId: order.resourceId,
    quantity: order.quantity,
    priority: 1,
    reason,
  });
  const executed = executeRuntimeIntent(world.runtime, intent);
  world.runtime = executed.world;
  if (!executed.result.ok) return false;

  const updatedOrder = world.runtime.orders.at(-1);
  if (updatedOrder && priorStatus === "paid") {
    updatedOrder.status = "paid";
    updatedOrder.paymentAmount = priorPaymentAmount;
    updatedOrder.updatedAt = world.runtime.clock.now;
  }
  return true;
}

function resolveDemoSupplierEscalation(world: canonical.AtlasWorldState, blockedTask: canonical.AtlasTaskState, request: RuntimeHistoryEvent) {
  if (!alternateSupplierCanCover(world)) return false;
  const order = world.runtime.orders.at(-1);
  if (order) order.supplierId = ALTERNATE_SUPPLIER;

  world.runtime = publishRuntimeInformation(world.runtime, {
    subject: "recovery-escalation",
    value: "Higher-level coordinator selected the existing alternate supplier route; the original recovery task can continue from its blocked point.",
    sourceId: "agent-business",
    recipientIds: [blockedTask.agentId, "agent-operations"],
    confidence: 0.98,
    freshnessMs: 45_000,
    visibility: "participants",
    causalEventId: request.id,
  });
  return true;
}

function resolveCapacityEscalation(world: canonical.AtlasWorldState, blockedTask: canonical.AtlasTaskState) {
  if (blockedTask.actionType !== "reserve_capacity") return false;
  return reserveAlternateSupply(world, blockedTask.agentId, `Higher-agent escalation for ${blockedTask.id}`);
}

function resolveShipmentEscalation(world: canonical.AtlasWorldState, blockedTask: canonical.AtlasTaskState, resolverId: string, request: RuntimeHistoryEvent) {
  if (blockedTask.actionType !== "release_shipment" || blockedTask.approvalStatus !== "approved") return false;
  let order = world.runtime.orders.at(-1);
  if (!order || order.status !== "paid") return false;

  if (!order.reservationId) {
    const reserved = reserveAlternateSupply(world, resolverId, `Higher-agent prerequisite repair for ${blockedTask.id}`);
    if (!reserved) return false;
    order = world.runtime.orders.at(-1);
  }
  if (!order || order.status !== "paid" || !order.reservationId) return false;

  const shipment = createRuntimeIntent(world.runtime, blockedTask.agentId, "release_shipment", {
    targetId: order.buyerId,
    resourceId: order.resourceId,
    quantity: order.quantity,
    priority: 1,
    reason: `Resume already-approved shipment after higher-agent prerequisite repair for ${blockedTask.id}`,
  });
  const executed = executeRuntimeIntent(world.runtime, shipment);
  world.runtime = executed.world;
  if (!executed.result.ok) return false;

  blockedTask.runtimeIntentId = executed.result.intent.id;
  world.runtime = publishRuntimeInformation(world.runtime, {
    subject: `task:${blockedTask.id}:shipment-recovery`,
    value: "The higher agent repaired the missing supplier reservation and resumed the already-approved shipment without restarting the workflow.",
    sourceId: resolverId,
    recipientIds: [blockedTask.agentId, "agent-business", "agent-customer"],
    confidence: 1,
    freshnessMs: 45_000,
    visibility: "participants",
    causalEventId: request.id,
  });
  return true;
}

function resumeBlockedTask(world: canonical.AtlasWorldState, blockedTask: canonical.AtlasTaskState) {
  const stuckAgent = world.agents.find((agent) => agent.id === blockedTask.agentId);
  const preservedProgress = Math.max(0, Math.min(0.99, blockedTask.progress));
  blockedTask.status = "working";
  blockedTask.workStartedAt = world.now - preservedProgress * Math.max(1, blockedTask.workMs);
  delete blockedTask.blockingReason;
  if (stuckAgent) {
    stuckAgent.status = "working";
    stuckAgent.taskId = blockedTask.id;
  }
  world.phase = "running";
}

function resolveCompletedEscalations(world: canonical.AtlasWorldState) {
  const completed = world.tasks.filter((task) => task.id.startsWith("escalation-") && task.status === "done");
  for (const escalationTask of completed) {
    const blockedTaskId = escalationTask.id.slice("escalation-".length);
    const blockedTask = world.tasks.find((task) => task.id === blockedTaskId && task.status === "blocked");
    if (!blockedTask || hasEscalationResolution(world, blockedTaskId)) continue;
    const request = escalationRequest(world, blockedTaskId);
    if (!request) continue;

    const resolverId = escalationTask.agentId;
    const solved = blockedTaskId === DEMO_STUCK_TASK_ID
      ? resolveDemoSupplierEscalation(world, blockedTask, request)
      : resolveCapacityEscalation(world, blockedTask)
        || resolveShipmentEscalation(world, blockedTask, resolverId, request);

    if (solved) {
      resumeBlockedTask(world, blockedTask);
      const resolved = appendEscalationHistory(
        world,
        "escalation_resolved",
        "Higher agent resolved the stuck path",
        `${resolverId} selected a workable alternative. ${blockedTask.title} resumes at ${Math.round(blockedTask.progress * 100)}% instead of restarting.`,
        resolverId,
        blockedTask.agentId,
        blockedTask.id,
        [request.id],
      );
      pushEscalationWorldEvent(
        world,
        "Escalation resolved",
        `${blockedTask.title} continues from its previous progress; the world and fund ledger were preserved.`,
        resolverId,
        blockedTask.id,
      );
      world.runtime = publishRuntimeInformation(world.runtime, {
        subject: `task:${blockedTask.id}:escalation-resolved`,
        value: "Higher-agent escalation resolved the blockage; continue the original task without reset.",
        sourceId: resolverId,
        recipientIds: [blockedTask.agentId],
        confidence: 1,
        freshnessMs: 35_000,
        visibility: "participants",
        causalEventId: resolved.id,
      });
      canonical.persistAtlasWorld(world);
      continue;
    }

    escalationTask.status = "blocked";
    escalationTask.blockingReason = "Higher agent could not find a safe executable alternative with current resources and permissions.";
    const resolver = world.agents.find((agent) => agent.id === resolverId);
    if (resolver) resolver.status = "waiting";
    world.phase = "blocked";
    appendEscalationHistory(
      world,
      "escalation_unresolved",
      "Escalation needs another capability",
      `${resolverId} inspected the stuck state but no safe alternative is currently executable. The world remains preserved and blocked rather than resetting.`,
      resolverId,
      blockedTask.agentId,
      blockedTask.id,
      [request.id],
    );
    canonical.persistAtlasWorld(world);
  }
}

function escalateOperationalBlocks(world: canonical.AtlasWorldState) {
  const blocked = world.tasks.find((task) =>
    task.status === "blocked"
    && !task.id.startsWith("escalation-")
    && task.approvalStatus !== "declined"
    && Boolean(task.blockingReason),
  );
  if (blocked) createEscalationTask(world, blocked);
}

function applyStuckEscalation(current: canonical.AtlasWorldState) {
  const world = JSON.parse(JSON.stringify(current)) as AnimalCooperationWorld;
  injectDemonstrationStuck(world);
  escalateOperationalBlocks(world);
  resolveCompletedEscalations(world);
  return world;
}

export function projectWorldCooperationToAnimals(current: canonical.AtlasWorldState) {
  const world = JSON.parse(JSON.stringify(current)) as AnimalCooperationWorld;
  const projected = new Set(world.cooperationProjection?.eventIds ?? []);
  const recent = world.runtime.history.slice(-32);

  for (const event of recent) {
    if (!COOPERATION_EVENT_TYPES.has(event.type) || projected.has(event.id)) continue;
    const pair = cooperationPair(world, event);
    if (!pair) continue;

    world.messages.push({
      id: `runtime-cooperation:${event.id}`,
      fromAgentId: pair.fromAgentId,
      toAgentId: pair.toAgentId,
      text: cooperationText(event),
      createdAt: world.now,
      expiresAt: world.now + 5_800,
    });
    projected.add(event.id);
  }

  world.cooperationProjection = { eventIds: [...projected].slice(-128) };
  if (world.messages.length > 24) world.messages.splice(0, world.messages.length - 24);
  return world;
}

export function advanceAtlasWorld(
  current: Parameters<typeof canonical.advanceAtlasWorld>[0],
  deltaMs: number,
) {
  const speed = atlasSimulationSpeed(current as canonical.AtlasWorldState);
  let world = JSON.parse(JSON.stringify(current)) as AnimalCooperationWorld;
  world.simulationSpeed = speed;
  let remaining = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0) * speed;

  while (remaining > 0) {
    const step = Math.min(MAX_ADVANCE_CHUNK_MS, remaining);
    world = applyStuckEscalation(canonical.advanceAtlasWorld(world, step)) as AnimalCooperationWorld;
    world.simulationSpeed = speed;
    remaining -= step;
  }

  return projectWorldCooperationToAnimals(world);
}

export function startAtlasWorkflow(
  current: Parameters<typeof canonical.startAtlasWorkflow>[0],
  workflowId: Parameters<typeof canonical.startAtlasWorkflow>[1],
) {
  const speed = atlasSimulationSpeed(current as canonical.AtlasWorldState);
  const next = canonical.startAtlasWorkflow(current, workflowId) as AnimalCooperationWorld;
  next.simulationSpeed = speed;
  return projectWorldCooperationToAnimals(next);
}

export function resolveAtlasApproval(
  current: Parameters<typeof canonical.resolveAtlasApproval>[0],
  approvalId: string,
  approved: boolean,
) {
  const speed = atlasSimulationSpeed(current as canonical.AtlasWorldState);
  const next = applyStuckEscalation(canonical.resolveAtlasApproval(current, approvalId, approved)) as AnimalCooperationWorld;
  next.simulationSpeed = speed;
  return projectWorldCooperationToAnimals(next);
}

export function atlasSnapshot(current: Parameters<typeof canonical.atlasSnapshot>[0]) {
  return {
    ...canonical.atlasSnapshot(current),
    simulationSpeed: atlasSimulationSpeed(current as canonical.AtlasWorldState),
  };
}

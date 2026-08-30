import * as canonical from "./atlas-canonical-world.ts";
import type { RuntimeHistoryEvent } from "./agentic-world-runtime.ts";

export * from "./atlas-canonical-world.ts";

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
};

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
  let fromAgentId = visibleAgentId(world, event.actorId);
  let toAgentId = visibleAgentId(world, event.targetId);

  if (!toAgentId) toAgentId = visibleAgentId(world, FALLBACK_TARGET[event.type]);
  if (fromAgentId && toAgentId && fromAgentId === toAgentId) {
    toAgentId = visibleAgentId(world, FALLBACK_TARGET[event.type] ?? "agent-operations");
  }
  if (!fromAgentId || !toAgentId || fromAgentId === toAgentId) return null;
  return { fromAgentId, toAgentId };
}

export function projectWorldCooperationToAnimals(current: canonical.AtlasWorldState) {
  const world = JSON.parse(JSON.stringify(current)) as canonical.AtlasWorldState;
  const known = new Set(world.messages.map((message) => message.id));
  const recent = world.runtime.history.slice(-24);

  for (const event of recent) {
    if (!COOPERATION_EVENT_TYPES.has(event.type)) continue;
    const id = `runtime-cooperation:${event.id}`;
    if (known.has(id)) continue;
    const pair = cooperationPair(world, event);
    if (!pair) continue;

    world.messages.push({
      id,
      fromAgentId: pair.fromAgentId,
      toAgentId: pair.toAgentId,
      text: cooperationText(event),
      createdAt: world.now,
      expiresAt: world.now + 5_800,
    });
    known.add(id);
  }

  if (world.messages.length > 24) world.messages.splice(0, world.messages.length - 24);
  return world;
}

export function advanceAtlasWorld(
  current: Parameters<typeof canonical.advanceAtlasWorld>[0],
  deltaMs: number,
) {
  return projectWorldCooperationToAnimals(canonical.advanceAtlasWorld(current, deltaMs));
}

export function startAtlasWorkflow(
  current: Parameters<typeof canonical.startAtlasWorkflow>[0],
  workflowId: Parameters<typeof canonical.startAtlasWorkflow>[1],
) {
  return projectWorldCooperationToAnimals(canonical.startAtlasWorkflow(current, workflowId));
}

export function resolveAtlasApproval(
  current: Parameters<typeof canonical.resolveAtlasApproval>[0],
  approvalId: string,
  approved: boolean,
) {
  return projectWorldCooperationToAnimals(canonical.resolveAtlasApproval(current, approvalId, approved));
}

import { entityCenter, structuredCloneSafe, WORLD_HEIGHT, WORLD_WIDTH } from "./catalog.js";
import { sanitizeRef, validateWorldInvariants } from "./validation.js";

const timestamp = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function positionFor(ref) {
  const hash = hashText(ref);
  return {
    x: 240 + (hash % Math.max(1, WORLD_WIDTH - 520)),
    y: 180 + (Math.floor(hash / 97) % Math.max(1, WORLD_HEIGHT - 390)),
  };
}

function makeEvent(type, title, detail, meta = {}) {
  return {
    id: uid("event"),
    type,
    title,
    detail,
    at: timestamp(),
    ...meta,
  };
}

function markActivity(world, entityId, tone = "mint") {
  if (!entityId) return;
  world.activity[entityId] = {
    tone,
    intensity: 1,
    at: Date.now(),
  };
}

export function beginTask(world, intent, taskId = uid("task")) {
  const next = structuredCloneSafe(world);
  const task = {
    id: taskId,
    intent: String(intent).trim(),
    status: "running",
    startedAt: timestamp(),
    completedAt: null,
    summary: "",
  };
  next.tasks[taskId] = task;
  next.activeTaskId = taskId;
  next.updatedAt = timestamp();
  return { state: next, task };
}

export function markTaskBlocked(world, reason) {
  const next = structuredCloneSafe(world);
  const task = next.activeTaskId ? next.tasks[next.activeTaskId] : null;
  if (task) {
    task.status = "blocked";
    task.blockedAt = timestamp();
    task.reason = String(reason);
  }
  next.updatedAt = timestamp();
  return next;
}

export function cancelTask(world) {
  const next = structuredCloneSafe(world);
  const task = next.activeTaskId ? next.tasks[next.activeTaskId] : null;
  if (task) {
    task.status = "cancelled";
    task.completedAt = timestamp();
  }
  for (const agent of Object.values(next.agents)) agent.status = "idle";
  next.activeTaskId = null;
  next.updatedAt = timestamp();
  return next;
}

function evaluateCondition(world, subjectRef, condition) {
  const normalized = String(condition).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const order = world.orders[subjectRef];
  const reservation = world.reservations[subjectRef];
  const entity = world.entities[subjectRef];
  const agent = world.agents[subjectRef];

  if (normalized.includes("delivered")) return { passed: order?.status === "delivered", actual: order?.status ?? "missing" };
  if (normalized.includes("prepared")) return { passed: order?.status === "prepared", actual: order?.status ?? "missing" };
  if (normalized.includes("transit")) return { passed: order?.status === "in_transit", actual: order?.status ?? "missing" };
  if (normalized.includes("reservation") || normalized.includes("reserved")) {
    return { passed: reservation?.status === "active", actual: reservation?.status ?? "missing" };
  }
  if (normalized.includes("message")) {
    const message = world.messages.find((item) => item.to === subjectRef || item.from === subjectRef || item.id === subjectRef);
    return { passed: Boolean(message), actual: message ? "message_found" : "missing" };
  }
  if (normalized.includes("available") || normalized.includes("exists")) {
    return { passed: Boolean(entity || agent || order || reservation), actual: entity?.id ?? agent?.id ?? order?.id ?? reservation?.id ?? "missing" };
  }
  if (normalized.includes("state_consistent") || normalized.includes("consistent")) {
    const invariants = validateWorldInvariants(world);
    return { passed: invariants.ok, actual: invariants.ok ? "consistent" : invariants.errors.join("; ") };
  }
  return {
    passed: Boolean(entity || agent || order || reservation || world.evidence.find((item) => item.subjectRef === subjectRef)),
    actual: entity || agent || order || reservation ? "subject_present" : "subject_missing",
  };
}

export function applyAction(world, action) {
  const beforeRevision = world.revision;
  const next = structuredCloneSafe(world);
  const params = action.params;
  let event;

  next.revision = beforeRevision + 1;
  next.updatedAt = timestamp();

  switch (action.type) {
    case "discover_entity": {
      const id = sanitizeRef(params.entityRef, "entity");
      const position = positionFor(id);
      const entity = {
        id,
        name: String(params.name).slice(0, 80),
        nameZh: String(params.nameZh ?? params.name).slice(0, 80),
        kind: sanitizeRef(params.entityType, "service"),
        x: Number.isFinite(Number(params.x)) ? Math.max(100, Math.min(WORLD_WIDTH - 260, Number(params.x))) : position.x,
        y: Number.isFinite(Number(params.y)) ? Math.max(120, Math.min(WORLD_HEIGHT - 220, Number(params.y))) : position.y,
        width: 190,
        height: 128,
        hue: ["mint", "sky", "amber", "lavender", "clay"][hashText(id) % 5],
        capabilities: [String(params.capability).slice(0, 80)],
        discovered: true,
      };
      next.entities[id] = entity;
      next.resources[id] = {};
      const agentId = `${id}-agent`;
      const center = entityCenter(entity);
      next.agents[agentId] = {
        id: agentId,
        name: String(params.agentName ?? `${entity.name} agent`).slice(0, 80),
        role: `${entity.name} agent`,
        roleZh: `${entity.nameZh}代理`,
        location: id,
        x: center.x,
        y: center.y,
        color: "#27484a",
        accent: "#b5ead6",
        status: "available",
        discovered: true,
      };
      markActivity(next, id, "mint");
      event = makeEvent("discovery", `Discovered ${entity.name}`, `Registered ${entity.name} with capability “${params.capability}”.`, { entityId: id, actorId: agentId });
      break;
    }
    case "inspect_entity": {
      const entity = next.entities[params.entityId];
      const evidence = {
        id: uid("evidence"),
        kind: "inspection",
        subjectRef: entity.id,
        passed: true,
        statement: `${entity.name} is available with ${entity.capabilities.length} capabilities.`,
        snapshot: {
          capabilities: entity.capabilities,
          resources: next.resources[entity.id] ?? {},
        },
        at: timestamp(),
      };
      next.evidence.push(evidence);
      markActivity(next, entity.id, "sky");
      event = makeEvent("inspection", `Inspected ${entity.name}`, evidence.statement, { entityId: entity.id, evidenceId: evidence.id });
      break;
    }
    case "move_agent": {
      const agent = next.agents[params.agentId];
      const destination = next.entities[params.destinationEntityId];
      const center = entityCenter(destination);
      agent.location = destination.id;
      agent.x = center.x + ((hashText(agent.id) % 60) - 30);
      agent.y = center.y + 18;
      agent.status = "moving";
      markActivity(next, destination.id, "sky");
      event = makeEvent("movement", `${agent.name} moved`, `${agent.name} arrived at ${destination.name}.`, { actorId: agent.id, entityId: destination.id });
      break;
    }
    case "send_message": {
      const sender = next.agents[params.fromAgentId];
      const recipient = next.entities[params.toEntityId] ?? next.agents[params.toEntityId];
      const message = {
        id: uid("message"),
        from: sender.id,
        to: recipient.id,
        intent: String(params.intent).slice(0, 220),
        payload: params.payload && typeof params.payload === "object" ? params.payload : {},
        status: "received",
        at: timestamp(),
      };
      next.messages.push(message);
      sender.status = "coordinating";
      const entityId = next.entities[recipient.id] ? recipient.id : recipient.location;
      markActivity(next, entityId, "lavender");
      event = makeEvent("communication", `${sender.name} contacted ${recipient.name}`, message.intent, { actorId: sender.id, entityId, messageId: message.id });
      break;
    }
    case "request_quote": {
      const seller = next.entities[params.sellerEntityId];
      const quantity = Number(params.quantity);
      const base = 8 + (hashText(`${params.item}:${seller.id}`) % 37);
      const amount = Math.round((base * quantity + Number.EPSILON) * 100) / 100;
      const quote = {
        id: uid("quote"),
        buyerAgentId: params.buyerAgentId,
        sellerEntityId: seller.id,
        item: String(params.item).slice(0, 100),
        quantity,
        currency: String(params.currency ?? "HKD").slice(0, 8),
        amount,
        withinBudget: params.maxBudget === undefined ? true : amount <= Number(params.maxBudget),
        status: "offered",
        at: timestamp(),
      };
      next.quotes[quote.id] = quote;
      markActivity(next, seller.id, "amber");
      event = makeEvent("quote", `${seller.name} returned a quote`, `${quote.quantity} × ${quote.item} · ${quote.currency} ${quote.amount}.`, { entityId: seller.id, quoteId: quote.id });
      break;
    }
    case "reserve_resource": {
      const ownerId = params.ownerEntityId;
      const item = sanitizeRef(params.item, "resource").replace(/-/g, "_");
      const quantity = Number(params.quantity);
      if (!next.resources[ownerId]) next.resources[ownerId] = {};
      if (!next.resources[ownerId][item]) {
        next.resources[ownerId][item] = { available: Math.max(10, quantity * 3), reserved: 0, unit: String(params.unit ?? "unit") };
      }
      next.resources[ownerId][item].reserved += quantity;
      const reservation = {
        id: params.reservationRef,
        ownerEntityId: ownerId,
        item,
        quantity,
        status: "active",
        at: timestamp(),
      };
      next.reservations[reservation.id] = reservation;
      markActivity(next, ownerId, "amber");
      event = makeEvent("reservation", `Reserved ${params.item}`, `${quantity} ${next.resources[ownerId][item].unit} reserved at ${next.entities[ownerId].name}.`, { entityId: ownerId, reservationId: reservation.id });
      break;
    }
    case "create_order": {
      const order = {
        id: params.orderRef,
        buyerAgentId: params.buyerAgentId,
        sellerEntityId: params.sellerEntityId,
        item: String(params.item).slice(0, 100),
        quantity: Number(params.quantity),
        destinationEntityId: params.destinationEntityId ?? "home",
        status: "confirmed",
        createdAt: timestamp(),
        updatedAt: timestamp(),
      };
      next.orders[order.id] = order;
      markActivity(next, order.sellerEntityId, "mint");
      event = makeEvent("order", `Order ${order.id} confirmed`, `${order.quantity} × ${order.item} requested from ${next.entities[order.sellerEntityId].name}.`, { entityId: order.sellerEntityId, orderId: order.id });
      break;
    }
    case "prepare_order": {
      const order = next.orders[params.orderRef];
      order.status = "prepared";
      order.preparedBy = params.byEntityId;
      order.updatedAt = timestamp();
      markActivity(next, params.byEntityId, "amber");
      event = makeEvent("preparation", `Order ${order.id} prepared`, `${next.entities[params.byEntityId].name} completed preparation.`, { entityId: params.byEntityId, orderId: order.id });
      break;
    }
    case "handoff_order": {
      const order = next.orders[params.orderRef];
      const courier = next.agents[params.courierAgentId];
      order.status = "in_transit";
      order.courierAgentId = courier.id;
      order.updatedAt = timestamp();
      courier.location = order.sellerEntityId;
      const seller = next.entities[order.sellerEntityId];
      const center = entityCenter(seller);
      courier.x = center.x;
      courier.y = center.y + 22;
      courier.status = "delivering";
      markActivity(next, order.sellerEntityId, "sky");
      event = makeEvent("handoff", `${courier.name} collected order ${order.id}`, `Custody transferred to the courier with a recorded handoff.`, { actorId: courier.id, entityId: order.sellerEntityId, orderId: order.id });
      break;
    }
    case "deliver_order": {
      const order = next.orders[params.orderRef];
      const destination = next.entities[params.destinationEntityId];
      const courier = next.agents[order.courierAgentId];
      order.status = "delivered";
      order.destinationEntityId = destination.id;
      order.deliveredAt = timestamp();
      order.updatedAt = timestamp();
      if (courier) {
        const center = entityCenter(destination);
        courier.location = destination.id;
        courier.x = center.x + 35;
        courier.y = center.y + 25;
        courier.status = "arrived";
      }
      markActivity(next, destination.id, "mint");
      event = makeEvent("delivery", `Order ${order.id} delivered`, `Delivery reached ${destination.name}; world state now records the outcome.`, { actorId: courier?.id, entityId: destination.id, orderId: order.id });
      break;
    }
    case "verify_condition": {
      const result = evaluateCondition(next, params.subjectRef, params.condition);
      const evidence = {
        id: uid("evidence"),
        kind: "verification",
        subjectRef: params.subjectRef,
        condition: params.condition,
        passed: result.passed,
        actual: result.actual,
        statement: result.passed ? `Verified: ${params.condition}.` : `Verification failed: ${params.condition}.`,
        at: timestamp(),
      };
      next.evidence.push(evidence);
      event = makeEvent("verification", result.passed ? "State verified" : "Verification failed", evidence.statement, { evidenceId: evidence.id, entityId: next.entities[params.subjectRef] ? params.subjectRef : undefined });
      break;
    }
    case "complete_task": {
      const taskId = next.activeTaskId;
      const task = next.tasks[taskId];
      task.status = "completed";
      task.summary = String(params.summary).slice(0, 400);
      task.completedAt = timestamp();
      for (const agent of Object.values(next.agents)) agent.status = "idle";
      next.activeTaskId = null;
      event = makeEvent("completion", "Task completed", task.summary, { taskId });
      break;
    }
    default:
      throw new Error(`Unsupported action: ${action.type}`);
  }

  next.events.push(event);
  if (next.events.length > 120) next.events = next.events.slice(-120);
  return { state: next, event };
}

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export const ACTION_TYPES = Object.freeze([
  "discover_entity",
  "inspect_entity",
  "move_agent",
  "send_message",
  "request_quote",
  "reserve_resource",
  "create_order",
  "prepare_order",
  "handoff_order",
  "deliver_order",
  "verify_condition",
  "complete_task",
]);

const ACTION_SET = new Set(ACTION_TYPES);

const requiredByType = {
  discover_entity: ["entityRef", "name", "entityType", "capability"],
  inspect_entity: ["entityId"],
  move_agent: ["agentId", "destinationEntityId"],
  send_message: ["fromAgentId", "toEntityId", "intent"],
  request_quote: ["buyerAgentId", "sellerEntityId", "item", "quantity"],
  reserve_resource: ["ownerEntityId", "item", "quantity", "reservationRef"],
  create_order: ["orderRef", "buyerAgentId", "sellerEntityId", "item", "quantity"],
  prepare_order: ["orderRef", "byEntityId"],
  handoff_order: ["orderRef", "courierAgentId"],
  deliver_order: ["orderRef", "destinationEntityId"],
  verify_condition: ["subjectRef", "condition"],
  complete_task: ["summary"],
};

export function sanitizeRef(value, prefix = "ref") {
  const cleaned = String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function checkRequired(params, keys) {
  const errors = [];
  for (const key of keys) {
    if (!(key in params) || params[key] === null || params[key] === "") {
      errors.push(`Missing required parameter: ${key}`);
    }
  }
  return errors;
}

function checkStringBounds(params) {
  const errors = [];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 600) {
      errors.push(`Parameter ${key} is longer than 600 characters`);
    }
  }
  return errors;
}

export function validatePlan(plan) {
  const errors = [];
  if (!isPlainObject(plan)) return { ok: false, errors: ["Plan must be an object"] };
  if (!isNonEmptyString(plan.objective)) errors.push("Plan objective is required");
  if (!Array.isArray(plan.steps)) errors.push("Plan steps must be an array");
  if (Array.isArray(plan.steps) && (plan.steps.length < 1 || plan.steps.length > 14)) {
    errors.push("Plan must contain between 1 and 14 steps");
  }

  const ids = new Set();
  for (const [index, step] of (plan.steps ?? []).entries()) {
    if (!isPlainObject(step)) {
      errors.push(`Step ${index + 1} must be an object`);
      continue;
    }
    if (!isNonEmptyString(step.id)) errors.push(`Step ${index + 1} needs an id`);
    if (ids.has(step.id)) errors.push(`Duplicate step id: ${step.id}`);
    ids.add(step.id);
    if (!isNonEmptyString(step.title)) errors.push(`Step ${index + 1} needs a title`);
    if (!isPlainObject(step.action)) {
      errors.push(`Step ${index + 1} needs an action object`);
      continue;
    }
    if (!ACTION_SET.has(step.action.type)) {
      errors.push(`Step ${index + 1} uses unsupported action: ${step.action.type}`);
    }
    if (!isPlainObject(step.action.params)) {
      errors.push(`Step ${index + 1} action params must be an object`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateAction(action, world) {
  const errors = [];
  const checks = [];
  if (!isPlainObject(action)) return { ok: false, errors: ["Action must be an object"], checks };
  if (!ACTION_SET.has(action.type)) return { ok: false, errors: [`Unsupported action type: ${action.type}`], checks };
  if (!isPlainObject(action.params)) return { ok: false, errors: ["Action params must be an object"], checks };

  const params = action.params;
  errors.push(...checkRequired(params, requiredByType[action.type] ?? []));
  errors.push(...checkStringBounds(params));
  if (errors.length > 0) return { ok: false, errors, checks };

  const entityExists = (id) => Boolean(world.entities[id]);
  const agentExists = (id) => Boolean(world.agents[id]);
  const orderExists = (id) => Boolean(world.orders[id]);

  switch (action.type) {
    case "discover_entity": {
      const ref = sanitizeRef(params.entityRef, "entity");
      checks.push({ name: "entity_ref_safe", passed: ref === params.entityRef || ref.length > 0 });
      if (world.entities[ref]) errors.push(`Entity ref already exists: ${ref}`);
      if (!isNonEmptyString(params.capability)) errors.push("Capability is required");
      break;
    }
    case "inspect_entity":
      checks.push({ name: "entity_exists", passed: entityExists(params.entityId) });
      if (!entityExists(params.entityId)) errors.push(`Unknown entity: ${params.entityId}`);
      break;
    case "move_agent":
      checks.push({ name: "agent_exists", passed: agentExists(params.agentId) });
      checks.push({ name: "destination_exists", passed: entityExists(params.destinationEntityId) });
      if (!agentExists(params.agentId)) errors.push(`Unknown agent: ${params.agentId}`);
      if (!entityExists(params.destinationEntityId)) errors.push(`Unknown destination: ${params.destinationEntityId}`);
      break;
    case "send_message":
      checks.push({ name: "sender_exists", passed: agentExists(params.fromAgentId) });
      checks.push({ name: "recipient_exists", passed: entityExists(params.toEntityId) || agentExists(params.toEntityId) });
      if (!agentExists(params.fromAgentId)) errors.push(`Unknown sender agent: ${params.fromAgentId}`);
      if (!entityExists(params.toEntityId) && !agentExists(params.toEntityId)) errors.push(`Unknown message recipient: ${params.toEntityId}`);
      break;
    case "request_quote":
      checks.push({ name: "buyer_exists", passed: agentExists(params.buyerAgentId) });
      checks.push({ name: "seller_exists", passed: entityExists(params.sellerEntityId) });
      if (!agentExists(params.buyerAgentId)) errors.push(`Unknown buyer agent: ${params.buyerAgentId}`);
      if (!entityExists(params.sellerEntityId)) errors.push(`Unknown seller: ${params.sellerEntityId}`);
      if (!isPositiveNumber(params.quantity)) errors.push("Quote quantity must be positive");
      if (params.maxBudget !== undefined && !isPositiveNumber(params.maxBudget)) errors.push("maxBudget must be positive when provided");
      break;
    case "reserve_resource": {
      const resource = world.resources[params.ownerEntityId]?.[params.item];
      checks.push({ name: "owner_exists", passed: entityExists(params.ownerEntityId) });
      checks.push({ name: "quantity_positive", passed: isPositiveNumber(params.quantity) });
      if (!entityExists(params.ownerEntityId)) errors.push(`Unknown resource owner: ${params.ownerEntityId}`);
      if (!isPositiveNumber(params.quantity)) errors.push("Reservation quantity must be positive");
      if (resource && resource.available - resource.reserved < Number(params.quantity)) {
        errors.push(`Insufficient ${params.item} at ${params.ownerEntityId}`);
      }
      if (world.reservations[params.reservationRef]) errors.push(`Reservation ref already exists: ${params.reservationRef}`);
      break;
    }
    case "create_order":
      checks.push({ name: "buyer_exists", passed: agentExists(params.buyerAgentId) });
      checks.push({ name: "seller_exists", passed: entityExists(params.sellerEntityId) });
      if (!agentExists(params.buyerAgentId)) errors.push(`Unknown buyer agent: ${params.buyerAgentId}`);
      if (!entityExists(params.sellerEntityId)) errors.push(`Unknown seller entity: ${params.sellerEntityId}`);
      if (!isPositiveNumber(params.quantity)) errors.push("Order quantity must be positive");
      if (world.orders[params.orderRef]) errors.push(`Order ref already exists: ${params.orderRef}`);
      break;
    case "prepare_order": {
      const order = world.orders[params.orderRef];
      checks.push({ name: "order_exists", passed: Boolean(order) });
      if (!orderExists(params.orderRef)) errors.push(`Unknown order: ${params.orderRef}`);
      if (!entityExists(params.byEntityId)) errors.push(`Unknown preparing entity: ${params.byEntityId}`);
      if (order && !["confirmed", "reserved"].includes(order.status)) errors.push(`Order ${params.orderRef} is not ready to prepare`);
      break;
    }
    case "handoff_order": {
      const order = world.orders[params.orderRef];
      checks.push({ name: "order_prepared", passed: order?.status === "prepared" });
      if (!order) errors.push(`Unknown order: ${params.orderRef}`);
      if (order && order.status !== "prepared") errors.push(`Order ${params.orderRef} must be prepared before handoff`);
      if (!agentExists(params.courierAgentId)) errors.push(`Unknown courier agent: ${params.courierAgentId}`);
      break;
    }
    case "deliver_order": {
      const order = world.orders[params.orderRef];
      checks.push({ name: "order_in_transit", passed: order?.status === "in_transit" });
      if (!order) errors.push(`Unknown order: ${params.orderRef}`);
      if (order && order.status !== "in_transit") errors.push(`Order ${params.orderRef} must be in transit before delivery`);
      if (!entityExists(params.destinationEntityId)) errors.push(`Unknown delivery destination: ${params.destinationEntityId}`);
      break;
    }
    case "verify_condition":
      checks.push({ name: "condition_declared", passed: isNonEmptyString(params.condition) });
      break;
    case "complete_task": {
      const task = world.activeTaskId ? world.tasks[world.activeTaskId] : null;
      checks.push({ name: "active_task_exists", passed: Boolean(task) });
      if (!task) errors.push("There is no active task to complete");
      if (task && task.status !== "running") errors.push(`Task is ${task.status}, not running`);
      break;
    }
    default:
      break;
  }

  return { ok: errors.length === 0, errors, checks };
}

export function verifyTransition(action, before, after, event) {
  const evidence = [];
  const revisionAdvanced = after.revision === before.revision + 1;
  evidence.push({ name: "revision_advanced_once", passed: revisionAdvanced, expected: before.revision + 1, actual: after.revision });
  if (!revisionAdvanced) return { ok: false, evidence };

  const params = action.params;
  switch (action.type) {
    case "discover_entity": {
      const ref = sanitizeRef(params.entityRef, "entity");
      evidence.push({ name: "entity_created", passed: Boolean(after.entities[ref]), actual: ref });
      break;
    }
    case "inspect_entity":
      evidence.push({ name: "inspection_recorded", passed: after.evidence.length === before.evidence.length + 1 });
      break;
    case "move_agent":
      evidence.push({ name: "agent_relocated", passed: after.agents[params.agentId]?.location === params.destinationEntityId });
      break;
    case "send_message":
      evidence.push({ name: "message_recorded", passed: after.messages.length === before.messages.length + 1 });
      break;
    case "request_quote":
      evidence.push({ name: "quote_created", passed: Object.keys(after.quotes).length === Object.keys(before.quotes).length + 1 });
      break;
    case "reserve_resource":
      evidence.push({ name: "reservation_active", passed: after.reservations[params.reservationRef]?.status === "active" });
      break;
    case "create_order":
      evidence.push({ name: "order_confirmed", passed: after.orders[params.orderRef]?.status === "confirmed" });
      break;
    case "prepare_order":
      evidence.push({ name: "order_prepared", passed: after.orders[params.orderRef]?.status === "prepared" });
      break;
    case "handoff_order":
      evidence.push({ name: "order_in_transit", passed: after.orders[params.orderRef]?.status === "in_transit" });
      break;
    case "deliver_order":
      evidence.push({ name: "order_delivered", passed: after.orders[params.orderRef]?.status === "delivered" });
      break;
    case "verify_condition":
      evidence.push({ name: "condition_evaluated", passed: after.evidence.length === before.evidence.length + 1 });
      evidence.push({ name: "condition_passed", passed: Boolean(after.evidence.at(-1)?.passed) });
      break;
    case "complete_task": {
      const task = after.activeTaskId ? after.tasks[after.activeTaskId] : Object.values(after.tasks).at(-1);
      evidence.push({ name: "task_completed", passed: task?.status === "completed" });
      break;
    }
    default:
      evidence.push({ name: "known_transition", passed: false });
  }

  evidence.push({ name: "event_emitted", passed: Boolean(event?.id && event?.type) });
  return { ok: evidence.every((item) => item.passed), evidence };
}

export function validateWorldInvariants(world) {
  const errors = [];
  if (!Number.isInteger(world.revision) || world.revision < 0) errors.push("World revision must be a non-negative integer");
  for (const agent of Object.values(world.agents)) {
    if (!world.entities[agent.location]) errors.push(`Agent ${agent.id} has an unknown location ${agent.location}`);
  }
  for (const [entityId, items] of Object.entries(world.resources)) {
    if (!world.entities[entityId]) errors.push(`Resources belong to unknown entity ${entityId}`);
    for (const [item, stock] of Object.entries(items)) {
      if (stock.available < 0 || stock.reserved < 0 || stock.reserved > stock.available) {
        errors.push(`Invalid resource balance ${entityId}/${item}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

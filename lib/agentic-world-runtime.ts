export type RuntimeAction =
  | "reserve_capacity"
  | "authorize_payment"
  | "release_shipment"
  | "send_customer_update"
  | "transfer_inventory"
  | "send_information"
  | "create_commitment"
  | "schedule_task";

export type RuntimeVisibility = "public" | "private" | "participants";
export type RuntimeOrderStatus =
  | "draft"
  | "quoted"
  | "accepted"
  | "reserved"
  | "paid"
  | "preparing"
  | "ready"
  | "in_transit"
  | "delivered"
  | "completed"
  | "failed";

export type RuntimeIntent = {
  id: string;
  actorId: string;
  action: RuntimeAction;
  targetId?: string;
  resourceId?: string;
  quantity?: number;
  amount?: number;
  parameters?: Record<string, unknown>;
  createdAt: number;
  priority: number;
  reason?: string;
};

export type RuntimeValidationResult = {
  allowed: boolean;
  reason: string;
  missingRequirements: string[];
  possibleAlternatives: string[];
};

export type RuntimeIntentResult = {
  ok: boolean;
  intent: RuntimeIntent;
  validation: RuntimeValidationResult;
  adaptedFrom?: string;
  selectedTargetId?: string;
  eventIds: string[];
};

export type RuntimeClock = {
  now: number;
  wallEpochMs: number;
  speed: number;
  paused: boolean;
};

export type RuntimeAccount = {
  ownerId: string;
  currency: "JPY";
  balance: number;
};

export type RuntimeInventory = {
  ownerId: string;
  resourceId: string;
  onHand: number;
  reserved: number;
  inTransit: number;
};

export type RuntimeCapacity = {
  ownerId: string;
  capacityId: string;
  total: number;
  reserved: number;
  unit: string;
};

export type RuntimeReservation = {
  id: string;
  holderId: string;
  ownerId: string;
  resourceId: string;
  quantity: number;
  createdAt: number;
  expiresAt?: number;
  purpose: string;
  status: "active" | "released" | "consumed" | "expired";
};

export type RuntimeCommitment = {
  id: string;
  debtorId: string;
  creditorId: string;
  obligation: string;
  deadline: number;
  status: "proposed" | "accepted" | "active" | "fulfilled" | "violated" | "cancelled";
  penalty?: number;
  source: string;
  createdAt: number;
  resolvedAt?: number;
};

export type RuntimeContract = {
  id: string;
  partyIds: string[];
  terms: string[];
  commitmentIds: string[];
  effectiveAt: number;
  expiresAt?: number;
  status: "draft" | "active" | "fulfilled" | "violated" | "cancelled";
};

export type RuntimeInformation = {
  id: string;
  subject: string;
  value: string;
  sourceId: string;
  recipientIds: string[];
  createdAt: number;
  confidence: number;
  freshnessMs: number;
  visibility: RuntimeVisibility;
  staleAt: number;
  causalEventId?: string;
};

export type RuntimeRelationship = {
  fromId: string;
  toId: string;
  kind: "customer" | "supplier" | "partner" | "employer" | "employee" | "courier" | "trusted" | "untrusted";
  trust: number;
  reputation: number;
  successfulInteractions: number;
  failedInteractions: number;
};

export type RuntimeMemory = {
  agentId: string;
  entries: Array<{
    id: string;
    kind: "interaction" | "price" | "reliability" | "failure" | "commitment" | "observation";
    subject: string;
    summary: string;
    createdAt: number;
    salience: number;
  }>;
};

export type RuntimeScheduledEvent = {
  id: string;
  type:
    | "supplier_capacity_shock"
    | "market_discovery"
    | "delivery_arrival"
    | "scheduled_intent"
    | "commitment_deadline"
    | "autonomy_tick";
  scheduledAt: number;
  createdAt: number;
  actorId?: string;
  targetId?: string;
  payload: Record<string, unknown>;
  status: "scheduled" | "processed" | "cancelled";
};

export type RuntimeHistoryEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  createdAt: number;
  actorId?: string;
  targetId?: string;
  intentId?: string;
  causeIds: string[];
  visibility: RuntimeVisibility;
};

export type RuntimeOrder = {
  id: string;
  workflowId: string;
  buyerId: string;
  sellerId: string;
  supplierId?: string;
  courierId: string;
  resourceId: string;
  quantity: number;
  unitPrice: number;
  status: RuntimeOrderStatus;
  createdAt: number;
  updatedAt: number;
  reservationId?: string;
  paymentAmount?: number;
};

export type RuntimeMetrics = {
  completedTransactions: number;
  failedIntents: number;
  successfulIntents: number;
  resourceShortages: number;
  commitmentViolations: number;
  totalEconomicValueTransferred: number;
  messagesSent: number;
  alternativePlansTriggered: number;
  completedDeliveries: number;
};

export type AgenticWorldRuntimeState = {
  version: 1;
  revision: number;
  seed: number;
  clock: RuntimeClock;
  accounts: RuntimeAccount[];
  inventories: RuntimeInventory[];
  capacities: RuntimeCapacity[];
  reservations: RuntimeReservation[];
  commitments: RuntimeCommitment[];
  contracts: RuntimeContract[];
  information: RuntimeInformation[];
  relationships: RuntimeRelationship[];
  memories: RuntimeMemory[];
  eventQueue: RuntimeScheduledEvent[];
  history: RuntimeHistoryEvent[];
  orders: RuntimeOrder[];
  metrics: RuntimeMetrics;
  lastAutonomyAt: number;
};

export type RuntimeObservation = {
  now: number;
  agentId: string;
  ownAccount: RuntimeAccount | null;
  ownInventory: RuntimeInventory[];
  ownCapacity: RuntimeCapacity[];
  orders: RuntimeOrder[];
  commitments: RuntimeCommitment[];
  information: Array<RuntimeInformation & { stale: boolean }>;
  relationships: RuntimeRelationship[];
  memories: RuntimeMemory["entries"];
};

export type RuntimeSupplierCandidate = {
  id: string;
  price: number;
  available: number;
  capacity: number;
  reputation: number;
  relationship: number;
  distance: number;
  risk: number;
};

export type RuntimeSupplierChoice = RuntimeSupplierCandidate & {
  score: number;
  explanation: string[];
};

const HISTORY_LIMIT = 360;
const INFORMATION_LIMIT = 220;
const MEMORY_LIMIT = 48;
const DEFAULT_SEED = 2_026_0830;
const PRIMARY_SUPPLIER = "supplier-primary";
const ALTERNATE_SUPPLIER = "supplier-alternate";
const BUYER = "agent-customer";
const SELLER = "agent-business";
const COURIER = "agent-logistics";
const MATERIAL = "material-unit";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextId(world: AgenticWorldRuntimeState, prefix: string) {
  world.revision += 1;
  return `${prefix}-${world.seed.toString(36)}-${world.revision.toString(36)}`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function deterministicNoise(seed: number, salt: number) {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

function account(world: AgenticWorldRuntimeState, ownerId: string) {
  return world.accounts.find((item) => item.ownerId === ownerId);
}

function inventory(world: AgenticWorldRuntimeState, ownerId: string, resourceId: string) {
  return world.inventories.find((item) => item.ownerId === ownerId && item.resourceId === resourceId);
}

function capacity(world: AgenticWorldRuntimeState, ownerId: string, capacityId = "fulfilment") {
  return world.capacities.find((item) => item.ownerId === ownerId && item.capacityId === capacityId);
}

function relationship(world: AgenticWorldRuntimeState, fromId: string, toId: string) {
  return world.relationships.find((item) => item.fromId === fromId && item.toId === toId);
}

function currentOrder(world: AgenticWorldRuntimeState) {
  return [...world.orders].reverse().find((item) => !["completed", "failed"].includes(item.status)) ?? world.orders.at(-1);
}

function pushHistory(
  world: AgenticWorldRuntimeState,
  type: string,
  title: string,
  detail: string,
  options: Partial<Pick<RuntimeHistoryEvent, "actorId" | "targetId" | "intentId" | "causeIds" | "visibility">> = {},
) {
  const event: RuntimeHistoryEvent = {
    id: nextId(world, "cause"),
    type,
    title,
    detail,
    createdAt: world.clock.now,
    causeIds: options.causeIds ? [...options.causeIds] : [],
    visibility: options.visibility ?? "participants",
    actorId: options.actorId,
    targetId: options.targetId,
    intentId: options.intentId,
  };
  world.history.push(event);
  if (world.history.length > HISTORY_LIMIT) world.history.splice(0, world.history.length - HISTORY_LIMIT);
  return event;
}

function addMemory(
  world: AgenticWorldRuntimeState,
  agentId: string,
  kind: RuntimeMemory["entries"][number]["kind"],
  subject: string,
  summary: string,
  salience = 0.5,
) {
  let memory = world.memories.find((item) => item.agentId === agentId);
  if (!memory) {
    memory = { agentId, entries: [] };
    world.memories.push(memory);
  }
  memory.entries.push({
    id: nextId(world, "memory"),
    kind,
    subject,
    summary,
    createdAt: world.clock.now,
    salience: clamp01(salience),
  });
  if (memory.entries.length > MEMORY_LIMIT) memory.entries.splice(0, memory.entries.length - MEMORY_LIMIT);
}

export function publishRuntimeInformation(
  current: AgenticWorldRuntimeState,
  input: {
    subject: string;
    value: string;
    sourceId: string;
    recipientIds?: string[];
    confidence?: number;
    freshnessMs?: number;
    visibility?: RuntimeVisibility;
    causalEventId?: string;
  },
) {
  const world = clone(current);
  const createdAt = world.clock.now;
  const info: RuntimeInformation = {
    id: nextId(world, "info"),
    subject: input.subject,
    value: input.value,
    sourceId: input.sourceId,
    recipientIds: [...(input.recipientIds ?? [])],
    createdAt,
    confidence: clamp01(input.confidence ?? 0.9),
    freshnessMs: Math.max(1, input.freshnessMs ?? 60_000),
    visibility: input.visibility ?? "participants",
    staleAt: createdAt + Math.max(1, input.freshnessMs ?? 60_000),
    causalEventId: input.causalEventId,
  };
  world.information.push(info);
  if (world.information.length > INFORMATION_LIMIT) world.information.splice(0, world.information.length - INFORMATION_LIMIT);
  const recipients = new Set([input.sourceId, ...info.recipientIds]);
  for (const recipient of recipients) addMemory(world, recipient, "observation", info.subject, info.value, info.confidence);
  world.metrics.messagesSent += Math.max(1, info.recipientIds.length);
  return world;
}

function scheduleEvent(
  world: AgenticWorldRuntimeState,
  type: RuntimeScheduledEvent["type"],
  scheduledAt: number,
  payload: Record<string, unknown>,
  actorId?: string,
  targetId?: string,
) {
  const event: RuntimeScheduledEvent = {
    id: nextId(world, "scheduled"),
    type,
    scheduledAt,
    createdAt: world.clock.now,
    actorId,
    targetId,
    payload: { ...payload },
    status: "scheduled",
  };
  world.eventQueue.push(event);
  world.eventQueue.sort((a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id));
  return event;
}

function baseAccounts(): RuntimeAccount[] {
  return [
    { ownerId: BUYER, currency: "JPY", balance: 250_000 },
    { ownerId: "agent-user", currency: "JPY", balance: 120_000 },
    { ownerId: SELLER, currency: "JPY", balance: 60_000 },
    { ownerId: PRIMARY_SUPPLIER, currency: "JPY", balance: 42_000 },
    { ownerId: ALTERNATE_SUPPLIER, currency: "JPY", balance: 36_000 },
    { ownerId: COURIER, currency: "JPY", balance: 28_000 },
    { ownerId: "agent-finance", currency: "JPY", balance: 25_000 },
  ];
}

function baseInventories(): RuntimeInventory[] {
  return [
    { ownerId: PRIMARY_SUPPLIER, resourceId: MATERIAL, onHand: 7, reserved: 0, inTransit: 0 },
    { ownerId: ALTERNATE_SUPPLIER, resourceId: MATERIAL, onHand: 28, reserved: 0, inTransit: 0 },
    { ownerId: SELLER, resourceId: MATERIAL, onHand: 2, reserved: 0, inTransit: 0 },
    { ownerId: BUYER, resourceId: MATERIAL, onHand: 0, reserved: 0, inTransit: 0 },
  ];
}

function baseCapacities(): RuntimeCapacity[] {
  return [
    { ownerId: PRIMARY_SUPPLIER, capacityId: "fulfilment", total: 8, reserved: 0, unit: "units" },
    { ownerId: ALTERNATE_SUPPLIER, capacityId: "fulfilment", total: 24, reserved: 0, unit: "units" },
    { ownerId: COURIER, capacityId: "delivery", total: 12, reserved: 0, unit: "shipments" },
    { ownerId: "agent-operations", capacityId: "machine-hour", total: 10, reserved: 0, unit: "units/hour" },
  ];
}

function baseRelationships(): RuntimeRelationship[] {
  return [
    { fromId: SELLER, toId: PRIMARY_SUPPLIER, kind: "supplier", trust: 0.78, reputation: 0.82, successfulInteractions: 8, failedInteractions: 1 },
    { fromId: SELLER, toId: ALTERNATE_SUPPLIER, kind: "supplier", trust: 0.66, reputation: 0.76, successfulInteractions: 3, failedInteractions: 0 },
    { fromId: BUYER, toId: SELLER, kind: "customer", trust: 0.74, reputation: 0.8, successfulInteractions: 4, failedInteractions: 0 },
    { fromId: SELLER, toId: COURIER, kind: "courier", trust: 0.72, reputation: 0.79, successfulInteractions: 7, failedInteractions: 1 },
  ];
}

export function createAgenticWorldRuntime(seed = DEFAULT_SEED, now = Date.now()): AgenticWorldRuntimeState {
  return {
    version: 1,
    revision: 0,
    seed,
    clock: { now, wallEpochMs: Date.now(), speed: 1, paused: false },
    accounts: baseAccounts(),
    inventories: baseInventories(),
    capacities: baseCapacities(),
    reservations: [],
    commitments: [],
    contracts: [],
    information: [],
    relationships: baseRelationships(),
    memories: [],
    eventQueue: [],
    history: [],
    orders: [],
    metrics: {
      completedTransactions: 0,
      failedIntents: 0,
      successfulIntents: 0,
      resourceShortages: 0,
      commitmentViolations: 0,
      totalEconomicValueTransferred: 0,
      messagesSent: 0,
      alternativePlansTriggered: 0,
      completedDeliveries: 0,
    },
    lastAutonomyAt: now,
  };
}

export function prepareRuntimeForWorkflow(
  current: AgenticWorldRuntimeState,
  workflowId: string,
  now = current.clock.now,
) {
  const world = createAgenticWorldRuntime(current.seed, now);
  world.revision = current.revision;
  const quantity = workflowId === "launch-stock" ? 18 : workflowId === "dinner-network" ? 6 : 12;
  const unitPrice = workflowId === "dinner-network" ? 1_600 : workflowId === "launch-stock" ? 4_800 : 3_200;
  const order: RuntimeOrder = {
    id: nextId(world, "order"),
    workflowId,
    buyerId: BUYER,
    sellerId: SELLER,
    courierId: COURIER,
    resourceId: MATERIAL,
    quantity,
    unitPrice,
    status: "accepted",
    createdAt: now,
    updatedAt: now,
  };
  world.orders.push(order);
  const deliveryCommitment: RuntimeCommitment = {
    id: nextId(world, "commitment"),
    debtorId: SELLER,
    creditorId: BUYER,
    obligation: `Deliver ${quantity} ${MATERIAL} for ${workflowId}`,
    deadline: now + 95_000,
    status: "active",
    penalty: 2_400,
    source: order.id,
    createdAt: now,
  };
  world.commitments.push(deliveryCommitment);
  world.contracts.push({
    id: nextId(world, "contract"),
    partyIds: [BUYER, SELLER],
    terms: ["resources must be conserved", "delivery changes must be communicated", "irreversible external actions require approval"],
    commitmentIds: [deliveryCommitment.id],
    effectiveAt: now,
    status: "active",
  });
  scheduleEvent(world, "commitment_deadline", deliveryCommitment.deadline, { commitmentId: deliveryCommitment.id });
  scheduleEvent(world, "supplier_capacity_shock", now + 8_400 + Math.round(deterministicNoise(world.seed, workflowId.length) * 2_000), { workflowId }, PRIMARY_SUPPLIER, SELLER);
  scheduleEvent(world, "market_discovery", now + 12_300, { workflowId }, "agent-market", "agent-operations");
  scheduleEvent(world, "autonomy_tick", now + 3_000, {}, "agent-market");
  pushHistory(world, "workflow_started", "Persistent world started", `${workflowId} created order ${order.id} with ${quantity} units, explicit commitments and finite resources.`, { actorId: SELLER, targetId: BUYER, visibility: "public" });
  return world;
}

function availableInventory(world: AgenticWorldRuntimeState, ownerId: string, resourceId: string) {
  const item = inventory(world, ownerId, resourceId);
  return item ? Math.max(0, item.onHand - item.reserved) : 0;
}

function availableCapacity(world: AgenticWorldRuntimeState, ownerId: string, capacityId = "fulfilment") {
  const item = capacity(world, ownerId, capacityId);
  return item ? Math.max(0, item.total - item.reserved) : 0;
}

export function chooseRuntimeSupplier(
  world: AgenticWorldRuntimeState,
  quantity: number,
  buyerId = SELLER,
): RuntimeSupplierChoice | null {
  const candidates: RuntimeSupplierCandidate[] = [PRIMARY_SUPPLIER, ALTERNATE_SUPPLIER].map((id, index) => {
    const relation = relationship(world, buyerId, id);
    const available = availableInventory(world, id, MATERIAL);
    return {
      id,
      price: id === PRIMARY_SUPPLIER ? 2_300 : 2_650,
      available,
      capacity: availableCapacity(world, id),
      reputation: relation?.reputation ?? 0.5,
      relationship: relation?.trust ?? 0.5,
      distance: index === 0 ? 0.35 : 0.6,
      risk: id === PRIMARY_SUPPLIER ? 0.34 : 0.18,
    };
  });

  const feasible = candidates.filter((item) => item.available >= quantity && item.capacity >= quantity);
  const ranked = (feasible.length ? feasible : candidates).map<RuntimeSupplierChoice>((item) => {
    const priceScore = 1 - Math.min(1, (item.price - 2_000) / 1_000);
    const availabilityScore = Math.min(1, item.available / Math.max(1, quantity));
    const capacityScore = Math.min(1, item.capacity / Math.max(1, quantity));
    const distanceScore = 1 - item.distance;
    const score = priceScore * 0.18 + availabilityScore * 0.25 + capacityScore * 0.19 + item.reputation * 0.16 + item.relationship * 0.1 + distanceScore * 0.05 + (1 - item.risk) * 0.07;
    return {
      ...item,
      score,
      explanation: [
        `price ${item.price}`,
        `available ${item.available}/${quantity}`,
        `capacity ${item.capacity}/${quantity}`,
        `reputation ${item.reputation.toFixed(2)}`,
        `risk ${item.risk.toFixed(2)}`,
      ],
    };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked[0] ?? null;
}

export function validateRuntimeIntent(current: AgenticWorldRuntimeState, intent: RuntimeIntent): RuntimeValidationResult {
  const world = current;
  const order = currentOrder(world);
  const missing: string[] = [];
  const alternatives: string[] = [];

  if (!intent.actorId) missing.push("actorId");
  if (!Number.isFinite(intent.priority)) missing.push("priority");

  if (intent.action === "reserve_capacity") {
    const quantity = Math.max(1, intent.quantity ?? order?.quantity ?? 1);
    const target = intent.targetId ?? PRIMARY_SUPPLIER;
    if (availableInventory(world, target, intent.resourceId ?? MATERIAL) < quantity) missing.push("inventory");
    if (availableCapacity(world, target) < quantity) missing.push("capacity");
    const alternate = chooseRuntimeSupplier(world, quantity);
    if (alternate && alternate.id !== target && alternate.available >= quantity && alternate.capacity >= quantity) alternatives.push(alternate.id);
  } else if (intent.action === "authorize_payment") {
    const amount = Math.max(0, intent.amount ?? ((order?.quantity ?? 1) * (order?.unitPrice ?? 0)));
    const payer = account(world, order?.buyerId ?? BUYER);
    if (!payer || payer.balance < amount) missing.push("funds");
    if (!order || !["accepted", "reserved", "quoted"].includes(order.status)) missing.push("payable_order_state");
  } else if (intent.action === "release_shipment") {
    if (!order || !["paid", "ready", "preparing"].includes(order.status)) missing.push("paid_or_ready_order");
    if (!order?.reservationId) missing.push("reservation");
    if (availableCapacity(world, COURIER, "delivery") < 1) missing.push("delivery_capacity");
  } else if (intent.action === "transfer_inventory") {
    const source = intent.actorId;
    const quantity = Math.max(0, intent.quantity ?? 0);
    if (!intent.targetId) missing.push("targetId");
    if (availableInventory(world, source, intent.resourceId ?? MATERIAL) < quantity) missing.push("inventory");
  } else if (intent.action === "send_information") {
    if (!intent.targetId) missing.push("targetId");
    if (typeof intent.parameters?.value !== "string" || !String(intent.parameters.value).trim()) missing.push("information_value");
  } else if (intent.action === "create_commitment") {
    if (!intent.targetId) missing.push("creditor");
    if (typeof intent.parameters?.obligation !== "string" || !String(intent.parameters.obligation).trim()) missing.push("obligation");
  } else if (intent.action === "schedule_task") {
    const at = Number(intent.parameters?.scheduledAt);
    if (!Number.isFinite(at) || at <= world.clock.now) missing.push("future_scheduledAt");
  }

  return {
    allowed: missing.length === 0,
    reason: missing.length ? `Blocked by ${missing.join(", ")}.` : "Intent satisfies current world constraints.",
    missingRequirements: missing,
    possibleAlternatives: alternatives,
  };
}

function applyRelationshipOutcome(world: AgenticWorldRuntimeState, fromId: string, toId: string, success: boolean) {
  const item = relationship(world, fromId, toId);
  if (!item) return;
  if (success) {
    item.successfulInteractions += 1;
    item.trust = clamp01(item.trust + 0.02);
    item.reputation = clamp01(item.reputation + 0.012);
  } else {
    item.failedInteractions += 1;
    item.trust = clamp01(item.trust - 0.07);
    item.reputation = clamp01(item.reputation - 0.055);
  }
}

function executeReservation(world: AgenticWorldRuntimeState, intent: RuntimeIntent, validation: RuntimeValidationResult): RuntimeIntentResult {
  const order = currentOrder(world);
  const quantity = Math.max(1, intent.quantity ?? order?.quantity ?? 1);
  let targetId = intent.targetId ?? PRIMARY_SUPPLIER;
  let adaptedFrom: string | undefined;
  if (!validation.allowed && validation.possibleAlternatives.length) {
    adaptedFrom = targetId;
    targetId = validation.possibleAlternatives[0];
    world.metrics.alternativePlansTriggered += 1;
    const event = pushHistory(world, "alternative_selected", "Supplier fallback selected", `${targetId} replaced ${adaptedFrom} because current inventory/capacity could not satisfy ${quantity} units.`, { actorId: intent.actorId, targetId, intentId: intent.id });
    addMemory(world, intent.actorId, "failure", adaptedFrom, `Primary supplier could not satisfy ${quantity}; selected ${targetId}.`, 0.9);
    const targetValidation = validateRuntimeIntent(world, { ...intent, targetId });
    if (!targetValidation.allowed) {
      world.metrics.failedIntents += 1;
      return { ok: false, intent, validation: targetValidation, adaptedFrom, selectedTargetId: targetId, eventIds: [event.id] };
    }
    validation = targetValidation;
  }
  if (!validation.allowed) {
    world.metrics.failedIntents += 1;
    world.metrics.resourceShortages += 1;
    const event = pushHistory(world, "intent_rejected", "Capacity reservation rejected", validation.reason, { actorId: intent.actorId, targetId, intentId: intent.id });
    return { ok: false, intent, validation, selectedTargetId: targetId, eventIds: [event.id] };
  }

  const stock = inventory(world, targetId, intent.resourceId ?? MATERIAL);
  const cap = capacity(world, targetId);
  if (!stock || !cap) {
    const failed = { allowed: false, reason: "Supplier ledger missing.", missingRequirements: ["supplier_ledger"], possibleAlternatives: [] };
    world.metrics.failedIntents += 1;
    return { ok: false, intent, validation: failed, selectedTargetId: targetId, eventIds: [] };
  }
  stock.reserved += quantity;
  cap.reserved += quantity;
  const reservation: RuntimeReservation = {
    id: nextId(world, "reservation"),
    holderId: order?.sellerId ?? SELLER,
    ownerId: targetId,
    resourceId: intent.resourceId ?? MATERIAL,
    quantity,
    createdAt: world.clock.now,
    purpose: order?.id ?? intent.reason ?? "workflow",
    status: "active",
  };
  world.reservations.push(reservation);
  if (order) {
    order.supplierId = targetId;
    order.reservationId = reservation.id;
    order.status = "reserved";
    order.updatedAt = world.clock.now;
  }
  world.metrics.successfulIntents += 1;
  applyRelationshipOutcome(world, SELLER, targetId, true);
  const event = pushHistory(world, "capacity_reserved", "Finite capacity reserved", `${quantity} units reserved at ${targetId}; those units cannot be consumed by another order.`, { actorId: intent.actorId, targetId, intentId: intent.id });
  return { ok: true, intent, validation, adaptedFrom, selectedTargetId: targetId, eventIds: [event.id] };
}

function executePayment(world: AgenticWorldRuntimeState, intent: RuntimeIntent, validation: RuntimeValidationResult): RuntimeIntentResult {
  if (!validation.allowed) {
    world.metrics.failedIntents += 1;
    const event = pushHistory(world, "intent_rejected", "Payment intent rejected", validation.reason, { actorId: intent.actorId, intentId: intent.id });
    return { ok: false, intent, validation, eventIds: [event.id] };
  }
  const order = currentOrder(world)!;
  const amount = Math.max(0, intent.amount ?? order.quantity * order.unitPrice);
  const payer = account(world, order.buyerId)!;
  const payee = account(world, order.sellerId)!;
  payer.balance -= amount;
  payee.balance += amount;
  order.paymentAmount = (order.paymentAmount ?? 0) + amount;
  order.status = "paid";
  order.updatedAt = world.clock.now;
  world.metrics.successfulIntents += 1;
  world.metrics.completedTransactions += 1;
  world.metrics.totalEconomicValueTransferred += amount;
  const event = pushHistory(world, "payment_transferred", "Payment changed the ledger", `${amount} JPY transferred from ${payer.ownerId} to ${payee.ownerId}.`, { actorId: intent.actorId, targetId: payee.ownerId, intentId: intent.id });
  return { ok: true, intent, validation, eventIds: [event.id] };
}

function executeShipment(world: AgenticWorldRuntimeState, intent: RuntimeIntent, validation: RuntimeValidationResult): RuntimeIntentResult {
  if (!validation.allowed) {
    world.metrics.failedIntents += 1;
    const event = pushHistory(world, "intent_rejected", "Shipment release rejected", validation.reason, { actorId: intent.actorId, intentId: intent.id });
    return { ok: false, intent, validation, eventIds: [event.id] };
  }
  const order = currentOrder(world)!;
  const reservation = world.reservations.find((item) => item.id === order.reservationId && item.status === "active")!;
  const stock = inventory(world, reservation.ownerId, reservation.resourceId)!;
  const cap = capacity(world, reservation.ownerId)!;
  stock.reserved -= reservation.quantity;
  stock.onHand -= reservation.quantity;
  stock.inTransit += reservation.quantity;
  cap.reserved = Math.max(0, cap.reserved - reservation.quantity);
  reservation.status = "consumed";
  order.status = "in_transit";
  order.updatedAt = world.clock.now;
  const deliveryCapacity = capacity(world, COURIER, "delivery");
  if (deliveryCapacity) deliveryCapacity.reserved += 1;
  const arrival = scheduleEvent(world, "delivery_arrival", world.clock.now + 4_200, { orderId: order.id, supplierId: reservation.ownerId }, COURIER, order.buyerId);
  world.metrics.successfulIntents += 1;
  const event = pushHistory(world, "shipment_released", "Custody entered transit", `${reservation.quantity} ${reservation.resourceId} left ${reservation.ownerId}; delivery event ${arrival.id} is scheduled.`, { actorId: intent.actorId, targetId: order.buyerId, intentId: intent.id });
  return { ok: true, intent, validation, eventIds: [event.id] };
}

function executeCustomerUpdate(world: AgenticWorldRuntimeState, intent: RuntimeIntent, validation: RuntimeValidationResult): RuntimeIntentResult {
  if (!validation.allowed) {
    world.metrics.failedIntents += 1;
    return { ok: false, intent, validation, eventIds: [] };
  }
  const order = currentOrder(world);
  const event = pushHistory(world, "customer_update", "Customer received current state", `Order ${order?.id ?? "unknown"}: ${order?.status ?? "unknown"}.`, { actorId: intent.actorId, targetId: BUYER, intentId: intent.id });
  const withInfo = publishRuntimeInformation(world, {
    subject: "order-status",
    value: `Order ${order?.id ?? "unknown"} is ${order?.status ?? "unknown"}.`,
    sourceId: intent.actorId,
    recipientIds: [BUYER],
    confidence: 1,
    visibility: "private",
    causalEventId: event.id,
  });
  Object.assign(world, withInfo);
  world.metrics.successfulIntents += 1;
  return { ok: true, intent, validation, eventIds: [event.id] };
}

function executeTransfer(world: AgenticWorldRuntimeState, intent: RuntimeIntent, validation: RuntimeValidationResult): RuntimeIntentResult {
  if (!validation.allowed || !intent.targetId) {
    world.metrics.failedIntents += 1;
    return { ok: false, intent, validation, eventIds: [] };
  }
  const resourceId = intent.resourceId ?? MATERIAL;
  const quantity = Math.max(0, intent.quantity ?? 0);
  const source = inventory(world, intent.actorId, resourceId)!;
  let target = inventory(world, intent.targetId, resourceId);
  if (!target) {
    target = { ownerId: intent.targetId, resourceId, onHand: 0, reserved: 0, inTransit: 0 };
    world.inventories.push(target);
  }
  source.onHand -= quantity;
  target.onHand += quantity;
  world.metrics.successfulIntents += 1;
  const event = pushHistory(world, "inventory_transferred", "Inventory ownership changed", `${quantity} ${resourceId} moved from ${intent.actorId} to ${intent.targetId}.`, { actorId: intent.actorId, targetId: intent.targetId, intentId: intent.id });
  return { ok: true, intent, validation, eventIds: [event.id] };
}

export function executeRuntimeIntent(current: AgenticWorldRuntimeState, input: Omit<RuntimeIntent, "id" | "createdAt"> & Partial<Pick<RuntimeIntent, "id" | "createdAt">>): { world: AgenticWorldRuntimeState; result: RuntimeIntentResult } {
  const world = clone(current);
  const intent: RuntimeIntent = {
    ...input,
    id: input.id ?? nextId(world, "intent"),
    createdAt: input.createdAt ?? world.clock.now,
  };
  let validation = validateRuntimeIntent(world, intent);
  let result: RuntimeIntentResult;

  if (intent.action === "reserve_capacity") result = executeReservation(world, intent, validation);
  else if (intent.action === "authorize_payment") result = executePayment(world, intent, validation);
  else if (intent.action === "release_shipment") result = executeShipment(world, intent, validation);
  else if (intent.action === "send_customer_update") result = executeCustomerUpdate(world, intent, validation);
  else if (intent.action === "transfer_inventory") result = executeTransfer(world, intent, validation);
  else if (intent.action === "send_information") {
    if (!validation.allowed || !intent.targetId) {
      world.metrics.failedIntents += 1;
      result = { ok: false, intent, validation, eventIds: [] };
    } else {
      const value = String(intent.parameters?.value ?? "");
      const event = pushHistory(world, "information_sent", "Information changed an agent observation", value, { actorId: intent.actorId, targetId: intent.targetId, intentId: intent.id, visibility: "private" });
      Object.assign(world, publishRuntimeInformation(world, { subject: String(intent.parameters?.subject ?? "message"), value, sourceId: intent.actorId, recipientIds: [intent.targetId], confidence: Number(intent.parameters?.confidence ?? 0.9), visibility: "private", causalEventId: event.id }));
      world.metrics.successfulIntents += 1;
      result = { ok: true, intent, validation, eventIds: [event.id] };
    }
  } else if (intent.action === "create_commitment") {
    if (!validation.allowed || !intent.targetId) {
      world.metrics.failedIntents += 1;
      result = { ok: false, intent, validation, eventIds: [] };
    } else {
      const deadline = Number(intent.parameters?.deadline ?? world.clock.now + 60_000);
      const commitment: RuntimeCommitment = { id: nextId(world, "commitment"), debtorId: intent.actorId, creditorId: intent.targetId, obligation: String(intent.parameters?.obligation ?? "commitment"), deadline, status: "active", penalty: Number(intent.parameters?.penalty ?? 0), source: intent.id, createdAt: world.clock.now };
      world.commitments.push(commitment);
      scheduleEvent(world, "commitment_deadline", deadline, { commitmentId: commitment.id }, intent.actorId, intent.targetId);
      addMemory(world, intent.actorId, "commitment", commitment.id, commitment.obligation, 0.85);
      world.metrics.successfulIntents += 1;
      const event = pushHistory(world, "commitment_created", "A future obligation now exists", commitment.obligation, { actorId: intent.actorId, targetId: intent.targetId, intentId: intent.id });
      result = { ok: true, intent, validation, eventIds: [event.id] };
    }
  } else if (intent.action === "schedule_task") {
    if (!validation.allowed) {
      world.metrics.failedIntents += 1;
      result = { ok: false, intent, validation, eventIds: [] };
    } else {
      const scheduledAt = Number(intent.parameters?.scheduledAt);
      const event = scheduleEvent(world, "scheduled_intent", scheduledAt, { intent: { ...intent, action: String(intent.parameters?.action ?? "send_information") } }, intent.actorId, intent.targetId);
      world.metrics.successfulIntents += 1;
      result = { ok: true, intent, validation, eventIds: [event.id] };
    }
  } else {
    validation = { allowed: false, reason: "Unsupported runtime action.", missingRequirements: ["supported_action"], possibleAlternatives: [] };
    world.metrics.failedIntents += 1;
    result = { ok: false, intent, validation, eventIds: [] };
  }

  return { world, result };
}

function processDelivery(world: AgenticWorldRuntimeState, event: RuntimeScheduledEvent) {
  const orderId = String(event.payload.orderId ?? "");
  const order = world.orders.find((item) => item.id === orderId);
  if (!order || order.status !== "in_transit") return;
  const reservation = world.reservations.find((item) => item.id === order.reservationId);
  if (!reservation) return;
  const supplierStock = inventory(world, reservation.ownerId, reservation.resourceId);
  let buyerStock = inventory(world, order.buyerId, reservation.resourceId);
  if (!buyerStock) {
    buyerStock = { ownerId: order.buyerId, resourceId: reservation.resourceId, onHand: 0, reserved: 0, inTransit: 0 };
    world.inventories.push(buyerStock);
  }
  if (supplierStock) supplierStock.inTransit = Math.max(0, supplierStock.inTransit - reservation.quantity);
  buyerStock.onHand += reservation.quantity;
  const deliveryCapacity = capacity(world, COURIER, "delivery");
  if (deliveryCapacity) deliveryCapacity.reserved = Math.max(0, deliveryCapacity.reserved - 1);
  order.status = "delivered";
  order.updatedAt = world.clock.now;
  world.metrics.completedDeliveries += 1;
  applyRelationshipOutcome(world, SELLER, COURIER, true);
  for (const commitment of world.commitments.filter((item) => item.source === order.id && item.status === "active")) {
    commitment.status = "fulfilled";
    commitment.resolvedAt = world.clock.now;
  }
  pushHistory(world, "delivery_arrived", "Physical resource reached the buyer", `${reservation.quantity} ${reservation.resourceId} arrived; ownership ledger now reflects receipt.`, { actorId: COURIER, targetId: order.buyerId, causeIds: [event.id] });
}

function processSupplierShock(world: AgenticWorldRuntimeState, event: RuntimeScheduledEvent) {
  const cap = capacity(world, PRIMARY_SUPPLIER);
  const stock = inventory(world, PRIMARY_SUPPLIER, MATERIAL);
  if (cap) cap.total = Math.max(cap.reserved, 4);
  if (stock) stock.onHand = Math.max(stock.reserved, Math.min(stock.onHand, 5));
  const cause = pushHistory(world, "supplier_capacity_shock", "Primary supplier capacity dropped", "A simulated upstream constraint reduced available primary supply. Only directly informed participants know immediately.", { actorId: PRIMARY_SUPPLIER, targetId: "agent-operations", causeIds: [event.id], visibility: "private" });
  Object.assign(world, publishRuntimeInformation(world, { subject: "supplier-capacity", value: "Primary supplier capacity is constrained; alternate sourcing may be required.", sourceId: PRIMARY_SUPPLIER, recipientIds: ["agent-supplier", "agent-operations"], confidence: 0.98, freshnessMs: 35_000, visibility: "private", causalEventId: cause.id }));
  world.metrics.resourceShortages += 1;
  applyRelationshipOutcome(world, SELLER, PRIMARY_SUPPLIER, false);
}

function processMarketDiscovery(world: AgenticWorldRuntimeState, event: RuntimeScheduledEvent) {
  const sourceInfo = [...world.information].reverse().find((item) => item.subject === "supplier-capacity");
  if (!sourceInfo) return;
  const cause = pushHistory(world, "information_discovered", "Market agent independently discovered supply pressure", "The market agent learned the constraint later; information was not globally available before this event.", { actorId: "agent-market", targetId: SELLER, causeIds: [sourceInfo.causalEventId ?? event.id], visibility: "participants" });
  Object.assign(world, publishRuntimeInformation(world, { subject: "market-supply-risk", value: "Supply pressure confirmed independently; alternate supplier has lower availability risk.", sourceId: "agent-market", recipientIds: [SELLER, "agent-finance"], confidence: 0.82, freshnessMs: 45_000, visibility: "participants", causalEventId: cause.id }));
}

function processCommitmentDeadline(world: AgenticWorldRuntimeState, event: RuntimeScheduledEvent) {
  const commitment = world.commitments.find((item) => item.id === String(event.payload.commitmentId ?? ""));
  if (!commitment || commitment.status !== "active") return;
  commitment.status = "violated";
  commitment.resolvedAt = world.clock.now;
  world.metrics.commitmentViolations += 1;
  const debtor = account(world, commitment.debtorId);
  const creditor = account(world, commitment.creditorId);
  const penalty = Math.max(0, commitment.penalty ?? 0);
  const payable = Math.min(penalty, debtor?.balance ?? 0);
  if (debtor && creditor && payable > 0) {
    debtor.balance -= payable;
    creditor.balance += payable;
    world.metrics.totalEconomicValueTransferred += payable;
  }
  applyRelationshipOutcome(world, commitment.creditorId, commitment.debtorId, false);
  pushHistory(world, "commitment_violated", "Commitment deadline missed", `${commitment.obligation}; penalty ${payable} JPY applied.`, { actorId: commitment.debtorId, targetId: commitment.creditorId, causeIds: [event.id] });
}

function runAutonomy(world: AgenticWorldRuntimeState) {
  if (world.clock.now - world.lastAutonomyAt < 2_500) return;
  world.lastAutonomyAt = world.clock.now;
  const order = currentOrder(world);
  if (!order || ["completed", "failed"].includes(order.status)) return;
  const buyerObservation = observeRuntime(world, order.buyerId);
  const knowsStatus = buyerObservation.information.some((item) => item.subject === "order-status" && !item.stale);
  if (!knowsStatus && ["reserved", "paid", "in_transit"].includes(order.status)) {
    const event = pushHistory(world, "autonomous_status_need", "Support detected an information gap", "Customer-side observation did not contain a fresh order status, so support prepared an update without requiring a user click.", { actorId: "agent-support", targetId: order.buyerId });
    Object.assign(world, publishRuntimeInformation(world, { subject: "order-status", value: `Autonomous status: ${order.status}.`, sourceId: "agent-support", recipientIds: [order.buyerId], confidence: 0.96, freshnessMs: 12_000, visibility: "private", causalEventId: event.id }));
  }
  scheduleEvent(world, "autonomy_tick", world.clock.now + 3_000, {}, "agent-support");
}

function processScheduledIntent(world: AgenticWorldRuntimeState, event: RuntimeScheduledEvent) {
  const raw = event.payload.intent;
  if (!raw || typeof raw !== "object") return;
  const record = raw as Record<string, unknown>;
  const action = String(record.action ?? "send_information") as RuntimeAction;
  const result = executeRuntimeIntent(world, {
    actorId: String(record.actorId ?? event.actorId ?? "agent-support"),
    action,
    targetId: typeof record.targetId === "string" ? record.targetId : event.targetId,
    resourceId: typeof record.resourceId === "string" ? record.resourceId : undefined,
    quantity: typeof record.quantity === "number" ? record.quantity : undefined,
    amount: typeof record.amount === "number" ? record.amount : undefined,
    parameters: record.parameters && typeof record.parameters === "object" ? record.parameters as Record<string, unknown> : undefined,
    priority: typeof record.priority === "number" ? record.priority : 0.5,
    reason: typeof record.reason === "string" ? record.reason : "scheduled world action",
  });
  Object.assign(world, result.world);
}

export function advanceAgenticWorldRuntime(current: AgenticWorldRuntimeState, deltaMs: number) {
  const world = clone(current);
  const safeDelta = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0);
  if (!world.clock.paused) world.clock.now += safeDelta * Math.max(0, world.clock.speed);
  const due = world.eventQueue.filter((event) => event.status === "scheduled" && event.scheduledAt <= world.clock.now);
  for (const event of due) {
    event.status = "processed";
    if (event.type === "delivery_arrival") processDelivery(world, event);
    else if (event.type === "supplier_capacity_shock") processSupplierShock(world, event);
    else if (event.type === "market_discovery") processMarketDiscovery(world, event);
    else if (event.type === "commitment_deadline") processCommitmentDeadline(world, event);
    else if (event.type === "scheduled_intent") processScheduledIntent(world, event);
    else if (event.type === "autonomy_tick") runAutonomy(world);
  }
  for (const reservation of world.reservations) {
    if (reservation.status === "active" && reservation.expiresAt && reservation.expiresAt <= world.clock.now) {
      reservation.status = "expired";
      const stock = inventory(world, reservation.ownerId, reservation.resourceId);
      const cap = capacity(world, reservation.ownerId);
      if (stock) stock.reserved = Math.max(0, stock.reserved - reservation.quantity);
      if (cap) cap.reserved = Math.max(0, cap.reserved - reservation.quantity);
      pushHistory(world, "reservation_expired", "Reservation expired", `${reservation.quantity} ${reservation.resourceId} returned to available supply.`, { actorId: reservation.holderId, targetId: reservation.ownerId });
    }
  }
  runAutonomy(world);
  return world;
}

export function observeRuntime(world: AgenticWorldRuntimeState, agentId: string): RuntimeObservation {
  const isPartyToOrder = (order: RuntimeOrder) => [order.buyerId, order.sellerId, order.supplierId, order.courierId].includes(agentId);
  const canSeeInfo = (item: RuntimeInformation) => item.visibility === "public" || item.sourceId === agentId || item.recipientIds.includes(agentId);
  return {
    now: world.clock.now,
    agentId,
    ownAccount: clone(account(world, agentId) ?? null),
    ownInventory: clone(world.inventories.filter((item) => item.ownerId === agentId)),
    ownCapacity: clone(world.capacities.filter((item) => item.ownerId === agentId)),
    orders: clone(world.orders.filter(isPartyToOrder)),
    commitments: clone(world.commitments.filter((item) => item.debtorId === agentId || item.creditorId === agentId)),
    information: clone(world.information.filter(canSeeInfo).map((item) => ({ ...item, stale: item.staleAt <= world.clock.now }))),
    relationships: clone(world.relationships.filter((item) => item.fromId === agentId || item.toId === agentId)),
    memories: clone(world.memories.find((item) => item.agentId === agentId)?.entries ?? []),
  };
}

export function recordRuntimeTaskCompletion(
  current: AgenticWorldRuntimeState,
  input: { taskId: string; title: string; agentId: string; dependentAgentIds: string[] },
) {
  let world = clone(current);
  const cause = pushHistory(world, "task_completed", input.title, `${input.agentId} completed ${input.taskId}; downstream agents receive only the resulting information packet.`, { actorId: input.agentId });
  if (input.dependentAgentIds.length) {
    world = publishRuntimeInformation(world, {
      subject: `task:${input.taskId}`,
      value: `${input.title} completed and is available to dependent work.`,
      sourceId: input.agentId,
      recipientIds: input.dependentAgentIds,
      confidence: 0.95,
      freshnessMs: 50_000,
      visibility: "private",
      causalEventId: cause.id,
    });
  }
  return world;
}

export function createRuntimeIntent(
  world: AgenticWorldRuntimeState,
  actorId: string,
  action: RuntimeAction,
  partial: Partial<Omit<RuntimeIntent, "id" | "actorId" | "action" | "createdAt" | "priority">> & { priority?: number } = {},
): RuntimeIntent {
  return {
    id: `preview-${world.seed.toString(36)}-${world.revision + 1}`,
    actorId,
    action,
    targetId: partial.targetId,
    resourceId: partial.resourceId,
    quantity: partial.quantity,
    amount: partial.amount,
    parameters: partial.parameters,
    createdAt: world.clock.now,
    priority: partial.priority ?? 0.7,
    reason: partial.reason,
  };
}

export function runtimeInvariantViolations(world: AgenticWorldRuntimeState) {
  const violations: string[] = [];
  for (const item of world.accounts) if (!Number.isFinite(item.balance) || item.balance < -1e-6) violations.push(`negative account:${item.ownerId}`);
  for (const item of world.inventories) {
    if (item.onHand < -1e-6) violations.push(`negative inventory:${item.ownerId}:${item.resourceId}`);
    if (item.reserved < -1e-6 || item.reserved - item.onHand > 1e-6) violations.push(`invalid reservation ledger:${item.ownerId}:${item.resourceId}`);
    if (item.inTransit < -1e-6) violations.push(`negative transit:${item.ownerId}:${item.resourceId}`);
  }
  for (const item of world.capacities) if (item.total < -1e-6 || item.reserved < -1e-6 || item.reserved - item.total > 1e-6) violations.push(`invalid capacity:${item.ownerId}:${item.capacityId}`);
  for (const reservation of world.reservations.filter((item) => item.status === "active")) {
    if (!inventory(world, reservation.ownerId, reservation.resourceId)) violations.push(`orphan reservation:${reservation.id}`);
  }
  for (const commitment of world.commitments) {
    if (commitment.status === "fulfilled" && commitment.resolvedAt == null) violations.push(`fulfilled commitment missing resolution:${commitment.id}`);
  }
  return violations;
}

export function explainRuntimeCausality(world: AgenticWorldRuntimeState, eventId?: string) {
  const event = eventId ? world.history.find((item) => item.id === eventId) : world.history.at(-1);
  if (!event) return { event: null, chain: [] as RuntimeHistoryEvent[] };
  const chain: RuntimeHistoryEvent[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const item = world.history.find((candidate) => candidate.id === id);
    if (!item) return;
    for (const causeId of item.causeIds) visit(causeId);
    chain.push(item);
  };
  visit(event.id);
  return { event: clone(event), chain: clone(chain) };
}

export function runtimeSnapshot(world: AgenticWorldRuntimeState) {
  const order = currentOrder(world) ?? null;
  return {
    version: world.version,
    revision: world.revision,
    clock: clone(world.clock),
    order: order ? clone(order) : null,
    accounts: world.accounts.map((item) => ({ ownerId: item.ownerId, currency: item.currency, balance: item.balance })),
    inventories: clone(world.inventories),
    capacities: clone(world.capacities),
    activeReservations: clone(world.reservations.filter((item) => item.status === "active")),
    commitments: clone(world.commitments),
    scheduledEvents: clone(world.eventQueue.filter((item) => item.status === "scheduled").slice(0, 12)),
    recentCausality: clone(world.history.slice(-12)),
    metrics: clone(world.metrics),
    invariantViolations: runtimeInvariantViolations(world),
  };
}

export function serializeRuntime(world: AgenticWorldRuntimeState) {
  return JSON.stringify({ schema: "asympta-agentic-world", version: 1, world });
}

export function restoreRuntime(serialized: string): AgenticWorldRuntimeState | null {
  try {
    const parsed = JSON.parse(serialized) as { schema?: unknown; version?: unknown; world?: unknown };
    if (parsed.schema !== "asympta-agentic-world" || parsed.version !== 1 || !parsed.world || typeof parsed.world !== "object") return null;
    const world = parsed.world as AgenticWorldRuntimeState;
    if (world.version !== 1 || !world.clock || !Array.isArray(world.history) || !Array.isArray(world.eventQueue)) return null;
    if (runtimeInvariantViolations(world).length) return null;
    return clone(world);
  } catch {
    return null;
  }
}

export function setRuntimeClockSpeed(current: AgenticWorldRuntimeState, speed: number) {
  const world = clone(current);
  world.clock.speed = Math.max(0, Math.min(16, Number.isFinite(speed) ? speed : 1));
  return world;
}

export function setRuntimePaused(current: AgenticWorldRuntimeState, paused: boolean) {
  const world = clone(current);
  world.clock.paused = Boolean(paused);
  return world;
}

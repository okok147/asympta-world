import { ATLAS_AGENTS, ATLAS_WORKFLOWS, type AtlasTaskBlueprint, type WorkflowId } from "./atlas-simulation.ts";

export type WorkflowResourceKey = "budget" | "materials" | "inventory" | "capacity" | "compute" | "delivery" | "trust";
export type WorkflowResourceDelta = Partial<Record<WorkflowResourceKey, number>>;
export type WorkflowTaskExchange = { handoff: string; resourceDelta: WorkflowResourceDelta };

type AddedTask = AtlasTaskBlueprint & { handoff?: string; resourceDelta?: WorkflowResourceDelta };

const DEFAULT_HANDOFF: Record<string, string> = {
  user: "Intent, priorities, timing boundary and non-negotiable constraints",
  customer: "Acceptance criteria, preference trade-offs and customer commitment",
  business: "Commercial terms, service promise, price and merchant commitments",
  supplier: "Material availability, capacity, lead time and substitution options",
  operations: "Executable schedule, capacity allocation, dependencies and handoff windows",
  finance: "Budget envelope, payment terms, exposure and approval limits",
  logistics: "Route, custody state, pickup window and delivery ETA",
  support: "Customer communication, open issues, next checkpoint and service ownership",
  quality: "Inspection evidence, risk flags, acceptance gate and release criteria",
  market: "Demand signal, uncertainty band, local conditions and forecast assumptions",
};

const DEFAULT_DELTA: Record<string, WorkflowResourceDelta> = {
  user: { compute: 1, trust: 0.2 },
  customer: { compute: 1, trust: 1 },
  business: { budget: -500, capacity: 0.2, compute: 2, trust: 0.4 },
  supplier: { budget: -700, materials: 2.4, capacity: 0.8, compute: 1 },
  operations: { budget: -850, materials: -1, inventory: 1.2, capacity: -0.2, compute: 2 },
  finance: { budget: -320, compute: 3, trust: 0.3 },
  logistics: { budget: -520, inventory: -1, delivery: 0.6, compute: 1 },
  support: { budget: -180, compute: 1, trust: 2.2 },
  quality: { budget: -280, compute: 2, trust: 1.4 },
  market: { budget: -240, compute: 3, trust: 0.2 },
};

const ACTION_DELTA: Record<string, WorkflowResourceDelta> = {
  reserve_capacity: { budget: -3_200, materials: 2, capacity: 5 },
  authorize_payment: { budget: -6_500, trust: 1 },
  release_shipment: { inventory: -3.8, delivery: 1.2 },
  send_customer_update: { trust: 3.5 },
};

const EXCHANGE = new Map<string, WorkflowTaskExchange>();

function workflow(id: WorkflowId) {
  const value = ATLAS_WORKFLOWS.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Missing workflow ${id}`);
  return value;
}

function addDependency(workflowId: WorkflowId, taskId: string, dependencyId: string) {
  const target = workflow(workflowId).tasks.find((task) => task.id === taskId);
  if (target && !target.dependsOn.includes(dependencyId)) target.dependsOn.push(dependencyId);
}

function insertBefore(workflowId: WorkflowId, beforeId: string, task: AddedTask) {
  const targetWorkflow = workflow(workflowId);
  if (targetWorkflow.tasks.some((candidate) => candidate.id === task.id)) return;
  const index = targetWorkflow.tasks.findIndex((candidate) => candidate.id === beforeId);
  targetWorkflow.tasks.splice(index < 0 ? targetWorkflow.tasks.length : index, 0, task);
  if (task.handoff || task.resourceDelta) EXCHANGE.set(task.id, { handoff: task.handoff ?? "", resourceDelta: { ...task.resourceDelta } });
}

function append(workflowId: WorkflowId, task: AddedTask) {
  insertBefore(workflowId, "__end__", task);
}

function added(id: string, title: string, detail: string, agentId: string, locationId: string, dependsOn: string[], workMs: number, handoff: string, resourceDelta: WorkflowResourceDelta = {}): AddedTask {
  return { id, title, detail, agentId, locationId, dependsOn, workMs, handoff, resourceDelta };
}

// Custom order: add market context, resilient supply, recommitment, traceable procurement and acceptance.
insertBefore("custom-order", "co-customer", added("co-market", "Check market conditions", "Estimate current simulated demand pressure, price band and likely lead-time risk before the merchant promises a date.", "agent-market", "ueno", ["co-intent"], 2_500, "Demand pressure, uncertainty, price band and lead-time risk", { budget: -360, compute: 3 }));
addDependency("custom-order", "co-business", "co-market");
insertBefore("custom-order", "co-quality", added("co-supply-fallback", "Prepare supplier fallback", "Prepare substitute materials and alternate capacity if the primary source slips or fails inspection.", "agent-supplier", "tsukiji", ["co-supply", "co-market"], 2_500, "Fallback material, alternate lead time, reserve capacity and substitution constraints", { budget: -920, materials: 4.8, capacity: 1.9 }));
addDependency("custom-order", "co-quality", "co-supply-fallback");
insertBefore("custom-order", "co-reserve", added("co-customer-confirm", "Confirm final customer commitment", "Present final trade-offs, promised window and acceptance criteria before resources are committed.", "agent-customer", "shinjuku", ["co-negotiate", "co-ops"], 2_100, "Final acceptance criteria, selected trade-offs and customer commitment", { compute: 1, trust: 1.2 }));
addDependency("custom-order", "co-reserve", "co-customer-confirm");
insertBefore("custom-order", "co-pack", added("co-procure", "Release materials to fulfilment", "Convert the approved supplier allocation into a traceable simulated material handoff to operations.", "agent-supplier", "toyosu", ["co-pay"], 2_400, "Material batch, quantity, lot trace and committed arrival window", { budget: -920, materials: 7.7, inventory: 1.5, capacity: 1.1 }));
addDependency("custom-order", "co-pack", "co-procure");
insertBefore("custom-order", "co-dispatch", added("co-inspect", "Final quality release", "Inspect the packed order against accepted specification and lot trace before custody transfers to logistics.", "agent-quality", "nihonbashi", ["co-pack"], 2_200, "Inspection evidence, lot trace, pass/fail gate and logistics release recommendation", { budget: -430, compute: 2, trust: 2.2 }));
addDependency("custom-order", "co-dispatch", "co-inspect");
insertBefore("custom-order", "co-aftercare", added("co-accept", "Confirm customer acceptance", "Confirm custody transfer, received condition and whether any exception requires support follow-up.", "agent-customer", "shibuya", ["co-deliver"], 1_800, "Receipt confirmation, acceptance status, exception notes and service follow-up need", { compute: 1, trust: 1.8 }));
addDependency("custom-order", "co-aftercare", "co-accept");

// Dinner: add demand pressure, fallback ingredient sourcing, economics, final trade-off confirmation and food-quality custody.
insertBefore("dinner-network", "dn-customer", added("dn-market", "Check local dinner demand", "Estimate simulated restaurant and courier demand pressure around the requested delivery window.", "agent-market", "ueno", ["dn-intent"], 2_100, "Local demand pressure, courier congestion and timing uncertainty", { budget: -300, compute: 3 }));
addDependency("dinner-network", "dn-business", "dn-market");
insertBefore("dinner-network", "dn-quality", added("dn-fallback", "Prepare ingredient fallback", "Check alternate ingredient sources and substitution lead time without violating dietary constraints.", "agent-supplier", "tsukiji", ["dn-supplier", "dn-market"], 2_200, "Fallback ingredient, substitution quantity, source and lead-time confidence", { budget: -760, materials: 3.8, capacity: 1.2 }));
addDependency("dinner-network", "dn-quality", "dn-fallback");
insertBefore("dinner-network", "dn-plan", added("dn-finance-risk", "Check dinner economics", "Model simulated order total, service fee exposure and contingency if substitutions or courier timing changes.", "agent-finance", "otemachi", ["dn-business", "dn-fallback"], 2_100, "Order total, contingency ceiling, payment exposure and approval boundary", { budget: -320, compute: 3 }));
addDependency("dinner-network", "dn-plan", "dn-finance-risk");
insertBefore("dinner-network", "dn-authorize", added("dn-customer-confirm", "Confirm final dinner trade-offs", "Confirm accepted substitutions, total price and arrival window before the order is authorised.", "agent-customer", "shinjuku", ["dn-quality", "dn-plan"], 1_800, "Accepted menu, substitutions, final price and delivery commitment", { compute: 1, trust: 1.4 }));
addDependency("dinner-network", "dn-authorize", "dn-customer-confirm");
insertBefore("dinner-network", "dn-prepare", added("dn-slot", "Reserve kitchen-courier slot", "Hold a coordinated simulated preparation and courier handoff slot after payment approval.", "agent-operations", "hamamatsucho", ["dn-authorize"], 1_700, "Kitchen slot, pickup window, courier capacity and exception threshold", { budget: -650, capacity: 2.2, delivery: 0.4 }));
addDependency("dinner-network", "dn-prepare", "dn-slot");
insertBefore("dinner-network", "dn-dispatch", added("dn-food-quality", "Gate food quality and dietary safety", "Verify preparation against the accepted dietary and substitution plan before courier custody.", "agent-quality", "nihonbashi", ["dn-prepare"], 1_900, "Dietary verification, preparation check, seal state and dispatch release", { budget: -280, trust: 2.3 }));
addDependency("dinner-network", "dn-dispatch", "dn-food-quality");
insertBefore("dinner-network", "dn-feedback", added("dn-receipt", "Confirm dinner receipt", "Confirm delivery condition, timing and customer acceptance before the service loop closes.", "agent-customer", "shibuya", ["dn-deliver"], 1_500, "Receipt, condition, timing variance and customer acceptance", { trust: 1.5 }));
addDependency("dinner-network", "dn-feedback", "dn-receipt");

// Launch: add end-user evidence, backup supply, commercial promise, distribution design, inbound trace, QA and live rebalancing.
insertBefore("launch-stock", "ls-market", added("ls-user", "Test end-user journey", "Simulate how an end user discovers, chooses, receives and potentially returns the launch item.", "agent-user", "shibuya", ["ls-brief"], 2_200, "User journey, friction points, service expectations and non-negotiable experience constraints", { compute: 2, trust: 0.5 }));
addDependency("launch-stock", "ls-customer", "ls-user");
insertBefore("launch-stock", "ls-finance", added("ls-backup", "Secure alternate supply path", "Model backup supplier capacity and material substitution if primary launch supply misses the first wave.", "agent-supplier", "tsukiji", ["ls-supply", "ls-market"], 2_500, "Backup lot, alternate capacity, lead-time variance and substitution terms", { budget: -900, materials: 4.4, capacity: 1.8 }));
addDependency("launch-stock", "ls-finance", "ls-backup");
addDependency("launch-stock", "ls-quality", "ls-backup");
insertBefore("launch-stock", "ls-plan", added("ls-commercial", "Set launch service promise", "Translate market, customer and end-user evidence into stock availability, service and return promises.", "agent-business", "marunouchi", ["ls-market", "ls-customer", "ls-user"], 2_500, "Launch promise, stock availability target, return policy and escalation boundary", { budget: -620, compute: 2, trust: 0.8 }));
addDependency("launch-stock", "ls-plan", "ls-commercial");
insertBefore("launch-stock", "ls-reserve", added("ls-route", "Design distribution network", "Allocate simulated launch waves across warehouse and delivery capacity with reroute triggers.", "agent-logistics", "hamamatsucho", ["ls-plan"], 2_400, "Wave routes, custody nodes, delivery capacity, reroute triggers and service ETA", { budget: -520, delivery: 1.2, capacity: 0.4 }));
addDependency("launch-stock", "ls-reserve", "ls-route");
insertBefore("launch-stock", "ls-stage", added("ls-inbound", "Release inbound materials", "Convert reserved capacity into traceable simulated inbound lots for launch staging.", "agent-supplier", "toyosu", ["ls-budget"], 2_400, "Inbound lot, quantity, ASN-style trace, arrival window and exception contact", { budget: -760, materials: 6.2, inventory: 2.2 }));
addDependency("launch-stock", "ls-stage", "ls-inbound");
insertBefore("launch-stock", "ls-release", added("ls-inspect", "Inspect staged launch inventory", "Sample staged inventory against the launch quality gate before distribution release.", "agent-quality", "nihonbashi", ["ls-stage"], 2_300, "Sample evidence, defect rate, quarantine quantity and release decision", { budget: -330, trust: 2.2 }));
addDependency("launch-stock", "ls-release", "ls-inspect");
insertBefore("launch-stock", "ls-monitor", added("ls-live", "Read live launch demand", "Compare simulated launch demand against forecast and identify stockout or overstock risk after release.", "agent-market", "ueno", ["ls-release"], 2_400, "Live demand variance, stock risk, regional signal and confidence band", { budget: -260, compute: 4 }));
insertBefore("launch-stock", "ls-monitor", added("ls-rebalance", "Rebalance launch stock", "Move simulated stock buffers and operational capacity toward the demand signal before support load grows.", "agent-operations", "shinagawa", ["ls-live"], 2_500, "Rebalanced stock, capacity shift, exception queue and next review threshold", { budget: -720, inventory: -0.3, capacity: 0.8 }));
addDependency("launch-stock", "ls-monitor", "ls-rebalance");

// Recovery: add direct evidence, commercial obligation, wider risk, replacement QA, customer slot, delivery proof and learning loop.
insertBefore("service-recovery", "sr-customer", added("sr-user-evidence", "Capture user failure evidence", "Collect simulated symptoms, photos/log-style evidence, urgency and workaround constraints from the affected user.", "agent-user", "shibuya", ["sr-triage"], 1_800, "Failure evidence, urgency, workaround constraints and user-observed timeline", { compute: 1, trust: 0.4 }));
addDependency("service-recovery", "sr-customer", "sr-user-evidence");
insertBefore("service-recovery", "sr-finance", added("sr-business", "Confirm commercial obligations", "Check simulated warranty, SLA, merchant promise and escalation obligations against customer impact.", "agent-business", "marunouchi", ["sr-customer"], 2_100, "Warranty/SLA obligation, merchant commitment, escalation path and remedy boundary", { budget: -520, compute: 2, trust: 0.6 }));
insertBefore("service-recovery", "sr-finance", added("sr-market", "Estimate wider service risk", "Estimate whether the failure pattern may affect other simulated customers or create a broader support spike.", "agent-market", "ueno", ["sr-quality"], 2_200, "Affected-population estimate, demand/support spike risk and uncertainty band", { budget: -260, compute: 3 }));
addDependency("service-recovery", "sr-finance", "sr-business");
addDependency("service-recovery", "sr-finance", "sr-market");
insertBefore("service-recovery", "sr-dispatch", added("sr-prep", "Prepare traceable replacement", "Prepare the simulated replacement, link its lot to the original failure and attach recovery instructions.", "agent-operations", "shinagawa", ["sr-credit"], 2_700, "Prepared replacement, trace record, recovery order link and dispatch readiness", { budget: -850, materials: -2.7, inventory: 4.4 }));
insertBefore("service-recovery", "sr-dispatch", added("sr-verify", "Verify replacement quality", "Inspect the replacement against containment criteria before it leaves controlled custody.", "agent-quality", "nihonbashi", ["sr-prep"], 2_200, "Replacement inspection evidence, containment pass and release recommendation", { budget: -280, trust: 2.1 }));
insertBefore("service-recovery", "sr-dispatch", added("sr-slot", "Confirm recovery handoff window", "Confirm the customer can receive the replacement and accepts the proposed remedy timing.", "agent-customer", "shinjuku", ["sr-verify"], 1_800, "Accepted remedy, receive window, access constraints and customer commitment", { trust: 1.4 }));
addDependency("service-recovery", "sr-dispatch", "sr-slot");
insertBefore("service-recovery", "sr-update", added("sr-deliver", "Complete recovery delivery", "Simulate expedited last-mile movement and confirm replacement custody transfer.", "agent-logistics", "shinjuku", ["sr-dispatch"], 2_600, "Route, custody proof, delivery timestamp and handoff exception state", { budget: -520, inventory: -0.8, delivery: 0.8 }));
addDependency("service-recovery", "sr-update", "sr-deliver");
append("service-recovery", added("sr-postmortem", "Close operational root cause", "Connect failure evidence, containment, supplier response and process change into an operational postmortem.", "agent-business", "marunouchi", ["sr-update", "sr-quality"], 2_400, "Root-cause summary, corrective-action owner, supplier follow-up and prevention commitment", { budget: -520, compute: 2, trust: 0.7 }));
append("service-recovery", added("sr-trust", "Measure trust recovery", "Compare simulated customer and market trust after recovery and identify whether follow-up is still needed.", "agent-market", "ueno", ["sr-postmortem"], 2_100, "Trust-recovery signal, residual risk, follow-up recommendation and learning loop", { budget: -240, compute: 3, trust: 0.8 }));

function addDelta(base: WorkflowResourceDelta, extra: WorkflowResourceDelta) {
  const next = { ...base };
  for (const [key, amount] of Object.entries(extra)) next[key as WorkflowResourceKey] = (next[key as WorkflowResourceKey] ?? 0) + (amount ?? 0);
  return next;
}

for (const definition of ATLAS_WORKFLOWS) {
  for (const task of definition.tasks) {
    if (EXCHANGE.has(task.id)) continue;
    const side = ATLAS_AGENTS.find((agent) => agent.id === task.agentId)?.side ?? "business";
    const actionDelta = task.actionType ? ACTION_DELTA[task.actionType] ?? {} : {};
    EXCHANGE.set(task.id, {
      handoff: DEFAULT_HANDOFF[side] ?? "Structured task result and downstream constraints",
      resourceDelta: addDelta(DEFAULT_DELTA[side] ?? {}, actionDelta),
    });
  }
}

export function workflowTaskExchange(taskId: string): WorkflowTaskExchange | null {
  const value = EXCHANGE.get(taskId);
  return value ? { handoff: value.handoff, resourceDelta: { ...value.resourceDelta } } : null;
}

export function resourceDeltaForTask(taskId: string): WorkflowResourceDelta | null {
  return workflowTaskExchange(taskId)?.resourceDelta ?? null;
}

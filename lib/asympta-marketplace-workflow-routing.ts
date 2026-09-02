import { ATLAS_WORKFLOWS, type AtlasWorkflowDefinition } from "./atlas-simulation.ts";
import type { ContextEnvelope, MarketplaceGoal } from "./asympta-context-compiler.ts";
import {
  MARKETPLACE_WORKFLOW_ID,
  buildMarketplaceWorkflow as buildBaseMarketplaceWorkflow,
  marketplaceRuntimeSpecs,
  marketplaceTaskIds,
  type GoalRuntimeSpec,
} from "./asympta-marketplace-workflow.ts";

export { MARKETPLACE_WORKFLOW_ID, marketplaceRuntimeSpecs, marketplaceTaskIds };
export type { GoalRuntimeSpec };

function fact(goal: MarketplaceGoal, key: string) {
  return goal.facts.find((candidate) => candidate.key === key);
}

function isVehicleGoal(goal: MarketplaceGoal) {
  return fact(goal, "product_class")?.value === "vehicle";
}

function vehicleItem(goal: MarketplaceGoal) {
  return String(fact(goal, "requested_item")?.value ?? "vehicle");
}

function vehicleTaskCopy(goal: MarketplaceGoal, index: number) {
  const ids = marketplaceTaskIds(goal, index);
  const item = vehicleItem(goal);
  return new Map<string, Pick<AtlasWorkflowDefinition["tasks"][number], "title" | "detail" | "agentId">>([
    [ids.store, {
      title: "Vehicle dealer agent accepts typed enquiry",
      detail: `Receive an Asympta ENQUIRY for 1 × ${item}; preserve the user's original request and simulated provenance before dealer-side coordination begins.`,
      agentId: "agent-market",
    }],
    [ids.stock, {
      title: "Dealer inventory agent checks simulated vehicle availability",
      detail: `Check the bounded demo ledger for a simulated ${item}, reserve one unit if available, and publish an AVAILABILITY packet without claiming a real dealer inventory lookup.`,
      agentId: "agent-supplier",
    }],
    [ids.offer, {
      title: "Dealer agent returns a bounded vehicle offer",
      detail: `Prepare a simulated offer for the ${item}, including the selected payment alias and vehicle-transport fulfilment; no real order or finance agreement is created.`,
      agentId: "agent-business",
    }],
    [ids.quality, {
      title: "Inspection agent checks vehicle offer and handoff terms",
      detail: `Verify context evidence, simulated availability, offer provenance, transport handling and the approval boundary before the vehicle purchase can proceed.`,
      agentId: "agent-quality",
    }],
    [ids.payment, {
      title: "Authorise simulated vehicle purchase",
      detail: `Pause at the human boundary before committing the simulated ${item} purchase. Approval advances demo state only; it does not charge money, register a vehicle or create a real contract.`,
      agentId: "agent-finance",
    }],
    [ids.travel, {
      title: "Vehicle transport agent travels to the dealer",
      detail: `After simulated authorisation, the logistics agent travels to the dealer to receive the ${item} through the vehicle-transport lane.`,
      agentId: "agent-logistics",
    }],
    [ids.handoff, {
      title: "Dealer hands the vehicle to the transport agent",
      detail: `Commit a simulated GOODS_HANDOFF packet and transfer the reserved ${item} into the logistics transport state rather than pretending a personal agent can carry it.`,
      agentId: "agent-logistics",
    }],
    [ids.returning, {
      title: "Vehicle transport agent delivers the vehicle to the user",
      detail: `Transport the ${item} from the simulated dealer to the user-side handoff location while preserving the canonical marketplace ledger.`,
      agentId: "agent-logistics",
    }],
    [ids.deliver, {
      title: "Record vehicle handover to the user",
      detail: `Commit the simulated DELIVERY_RECEIPT and move the ${item} from logistics transport state into the user's simulated inventory/handover state.`,
      agentId: "agent-logistics",
    }],
    [ids.verify, {
      title: "Verify vehicle purchase and delivery",
      detail: `Verify dealer enquiry, availability, offer, human approval, transport handoff, delivery receipt and inventory conservation before closing the ${item} goal.`,
      agentId: "agent-support",
    }],
  ]);
}

export function buildMarketplaceWorkflow(envelope: ContextEnvelope): AtlasWorkflowDefinition {
  const base = buildBaseMarketplaceWorkflow(envelope);
  const vehicleGoals = envelope.goals
    .map((goal, index) => ({ goal, index }))
    .filter(({ goal }) => isVehicleGoal(goal));
  if (!vehicleGoals.length) return base;

  const copyByTaskId = new Map<string, Pick<AtlasWorkflowDefinition["tasks"][number], "title" | "detail" | "agentId">>();
  for (const { goal, index } of vehicleGoals) {
    for (const [taskId, copy] of vehicleTaskCopy(goal, index)) copyByTaskId.set(taskId, copy);
  }

  const tasks = base.tasks.map((candidate) => {
    const copy = copyByTaskId.get(candidate.id);
    return copy ? { ...candidate, ...copy } : candidate;
  });
  const allVehicle = vehicleGoals.length === envelope.goals.length;
  return {
    ...base,
    name: allVehicle ? "Intent Marketplace · vehicle purchase" : `${base.name} + vehicle purchase`,
    summary: allVehicle
      ? `Compile “${envelope.rawMessage.text}” into a simulated dealer purchase, preserve the approval boundary, and route the vehicle through a logistics handoff instead of ordinary carry-home fulfilment.`
      : base.summary,
    outcome: allVehicle
      ? "The simulated dealer, finance, inspection and transport agents completed a receipt-backed vehicle handover without claiming a real purchase."
      : base.outcome,
    tasks,
  };
}

export function upsertMarketplaceWorkflow(envelope: ContextEnvelope) {
  const workflow = buildMarketplaceWorkflow(envelope);
  const existing = ATLAS_WORKFLOWS.findIndex((candidate) => candidate.id === MARKETPLACE_WORKFLOW_ID);
  if (existing >= 0) ATLAS_WORKFLOWS.splice(existing, 1, workflow);
  else ATLAS_WORKFLOWS.push(workflow);
  return workflow;
}

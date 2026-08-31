import {
  ATLAS_WORKFLOWS,
  type AtlasTaskBlueprint,
  type AtlasWorkflowDefinition,
  type WorkflowId,
} from "./atlas-simulation.ts";
import {
  marketplaceGoalItem,
  marketplaceGoalQuantity,
  type ContextEnvelope,
  type MarketplaceGoal,
} from "./asympta-context-compiler.ts";

export const MARKETPLACE_WORKFLOW_ID = "marketplace-intent" as WorkflowId;

type GoalRuntimeSpec = {
  goal: MarketplaceGoal;
  index: number;
  prefix: string;
  itemLabel: string;
  quantity: number;
  marketLocationId: string;
};


function task(
  id: string,
  title: string,
  detail: string,
  agentId: string,
  locationId: string,
  dependsOn: string[],
  workMs: number,
  options: Pick<AtlasTaskBlueprint, "requiresApproval" | "approvalLabel" | "actionType"> = {},
): AtlasTaskBlueprint {
  return { id, title, detail, agentId, locationId, dependsOn, workMs, ...options };
}

export function marketplaceRuntimeSpecs(envelope: ContextEnvelope): GoalRuntimeSpec[] {
  return envelope.goals.map((goal, index) => ({
    goal,
    index,
    prefix: `mp-${index + 1}-${goal.domain}`,
    itemLabel: marketplaceGoalItem(goal),
    quantity: marketplaceGoalQuantity(goal),
    marketLocationId: goal.domain === "food" ? "roppongi" : "shinjuku",
  }));
}

export function marketplaceTaskIds(goal: MarketplaceGoal, index: number) {
  const prefix = `mp-${index + 1}-${goal.domain}`;
  return {
    travel: `${prefix}-travel`,
    store: `${prefix}-store`,
    stock: `${prefix}-stock`,
    offer: `${prefix}-offer`,
    quality: `${prefix}-quality`,
    payment: `${prefix}-payment`,
    handoff: `${prefix}-handoff`,
    returning: `${prefix}-return`,
    deliver: `${prefix}-deliver`,
    verify: `${prefix}-verify`,
  };
}

export function buildMarketplaceWorkflow(envelope: ContextEnvelope): AtlasWorkflowDefinition {
  const specs = marketplaceRuntimeSpecs(envelope);
  const tasks: AtlasTaskBlueprint[] = [
    task(
      "mp-context",
      "Compile Asympta Context Envelope",
      `Validate ${envelope.goals.length} goal(s), preserve evidence and keep unknown fields explicit before routing.`,
      "agent-user",
      "shibuya",
      [],
      900,
    ),
  ];

  let previousGoalCompletion = "mp-context";
  for (const spec of specs) {
    const ids = marketplaceTaskIds(spec.goal, spec.index);
    const packetLabel = `${spec.quantity} × ${spec.itemLabel}`;
    tasks.push(
      task(
        ids.travel,
        `Carry ENQUIRY packet to ${spec.goal.domain} marketplace`,
        `The personal agent travels with ${spec.goal.id} and asks for ${packetLabel}; unknown fields remain unknown rather than invented.`,
        "agent-user",
        spec.marketLocationId,
        [previousGoalCompletion],
        650,
      ),
      task(
        ids.store,
        "Marketplace agent accepts typed enquiry",
        `Receive asympta.packet.v1 ENQUIRY for ${packetLabel} and bind it to ${envelope.requestId}.`,
        "agent-market",
        spec.marketLocationId,
        [ids.travel],
        900,
      ),
      task(
        ids.stock,
        "Supplier agent checks and reserves simulated stock",
        `Check the canonical demo ledger for ${packetLabel}; publish an AVAILABILITY packet with simulated provenance.`,
        "agent-supplier",
        spec.marketLocationId,
        [ids.store],
        1_050,
      ),
      task(
        ids.offer,
        "Store agent returns a bounded offer",
        `Create an OFFER packet for ${packetLabel} from actual ledger state, not a prerecorded animation.`,
        "agent-business",
        spec.marketLocationId,
        [ids.store, ids.stock],
        1_000,
      ),
      task(
        ids.quality,
        "Verification agent checks context and stock",
        `Verify goal evidence, quantity, simulated provenance and inventory conservation for ${packetLabel}.`,
        "agent-quality",
        spec.marketLocationId,
        [ids.offer],
        850,
      ),
      task(
        ids.payment,
        "Authorise simulated marketplace payment",
        `Pause before committing the simulated purchase of ${packetLabel}; no real payment or external order is performed.`,
        "agent-finance",
        "otemachi",
        [ids.quality],
        750,
        {
          requiresApproval: true,
          approvalLabel: `Allow simulated payment for ${packetLabel}`,
          actionType: "authorize_payment",
        },
      ),
      task(
        ids.handoff,
        "Store hands the item to the personal agent",
        `Commit a GOODS_HANDOFF packet and move ${packetLabel} from reserved stock into the personal agent's cargo.`,
        "agent-user",
        spec.marketLocationId,
        [ids.payment],
        800,
      ),
      task(
        ids.returning,
        "Personal agent carries the item home",
        `Return to the user with ${packetLabel} held in canonical cargo state.`,
        "agent-user",
        "shibuya",
        [ids.handoff],
        550,
      ),
      task(
        ids.deliver,
        "Transfer the item into user inventory",
        `Commit DELIVERY_RECEIPT and transfer ${packetLabel} from personal-agent cargo to user inventory.`,
        "agent-user",
        "shibuya",
        [ids.returning],
        700,
      ),
      task(
        ids.verify,
        "Verify delivery and close the goal",
        `Confirm the request, structured packets, approvals and inventory ledger reconcile for ${spec.goal.id}.`,
        "agent-support",
        "shibuya",
        [ids.deliver],
        650,
      ),
    );
    previousGoalCompletion = ids.verify;
  }

  const goalNames = specs.map((spec) => spec.goal.domain === "food" ? "food" : "clothing").join(" + ");
  return {
    id: MARKETPLACE_WORKFLOW_ID,
    name: `Intent Marketplace · ${goalNames}`,
    shortName: "Marketplace",
    summary: `Compile “${envelope.rawMessage.text}” into a versioned context envelope, coordinate real engine tasks and return simulated goods to the user.`,
    outcome: "The personal agent returned from the simulated marketplace and the canonical ledger recorded delivery into user inventory.",
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

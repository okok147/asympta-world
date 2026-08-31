import {
  ATLAS_WORKFLOWS,
  type AtlasTaskBlueprint,
  type AtlasWorkflowDefinition,
  type WorkflowId,
} from "./atlas-simulation.ts";
import {
  marketplaceGoalFulfilmentMethod,
  marketplaceGoalItem,
  marketplaceGoalPaymentMethod,
  marketplaceGoalQuantity,
  type ContextEnvelope,
  type MarketplaceGoal,
} from "./asympta-context-compiler.ts";
import type {
  MarketplaceFulfilmentMethod,
  MarketplacePaymentMethod,
} from "./asympta-marketplace-profile.ts";
import { assertMarketplaceTaskReady } from "./asympta-marketplace-task-protocol.ts";

export const MARKETPLACE_WORKFLOW_ID = "marketplace-intent" as WorkflowId;

export type GoalRuntimeSpec = {
  goal: MarketplaceGoal;
  index: number;
  prefix: string;
  itemLabel: string;
  quantity: number;
  marketLocationId: string;
  fulfilmentMethod: MarketplaceFulfilmentMethod;
  paymentMethod: MarketplacePaymentMethod;
  carrierAgentId: "agent-user" | "agent-logistics";
  carrierLabel: "personal agent" | "courier agent";
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
  return envelope.goals.map((goal, index) => {
    const fulfilmentMethod = marketplaceGoalFulfilmentMethod(goal);
    const carrierAgentId = fulfilmentMethod === "courier_delivery" ? "agent-logistics" : "agent-user";
    return {
      goal,
      index,
      prefix: `mp-${index + 1}-${goal.domain}`,
      itemLabel: marketplaceGoalItem(goal),
      quantity: marketplaceGoalQuantity(goal),
      marketLocationId: goal.domain === "food" ? "roppongi" : "shinjuku",
      fulfilmentMethod,
      paymentMethod: marketplaceGoalPaymentMethod(goal),
      carrierAgentId,
      carrierLabel: carrierAgentId === "agent-logistics" ? "courier agent" : "personal agent",
    };
  });
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
  const protocol = assertMarketplaceTaskReady(envelope);
  const specs = marketplaceRuntimeSpecs(envelope);
  const tasks: AtlasTaskBlueprint[] = [
    task(
      "mp-context",
      "Compile Asympta Task Intent",
      `Validate ${envelope.goals.length} goal(s) against ${protocol.contractVersion}, merge approved profile facts, preserve evidence and fail closed with the next question if execution context is incomplete.`,
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
    const courier = spec.fulfilmentMethod === "courier_delivery";
    const storeDependencies = courier ? [previousGoalCompletion] : [ids.travel];
    const travelDependencies = courier ? [ids.payment] : [previousGoalCompletion];
    const handoffDependencies = courier ? [ids.travel] : [ids.payment];

    tasks.push(
      ...(!courier ? [task(
        ids.travel,
        `Personal agent carries ENQUIRY packet to ${spec.goal.domain} marketplace`,
        `The personal agent travels with ${spec.goal.id} and asks for ${packetLabel}; unknown non-blocking fields remain unknown rather than invented.`,
        spec.carrierAgentId,
        spec.marketLocationId,
        travelDependencies,
        650,
      )] : []),
      task(
        ids.store,
        "Marketplace agent accepts typed enquiry",
        `Receive asympta.packet.v1 ENQUIRY for ${packetLabel}, using ${spec.fulfilmentMethod} and ${spec.paymentMethod}, then bind it to ${envelope.requestId}.`,
        "agent-market",
        spec.marketLocationId,
        storeDependencies,
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
        `Create an OFFER packet for ${packetLabel}, ${spec.fulfilmentMethod}, and ${spec.paymentMethod} from actual ledger state, not a prerecorded animation.`,
        "agent-business",
        spec.marketLocationId,
        [ids.store, ids.stock],
        1_000,
      ),
      task(
        ids.quality,
        "Verification agent checks context, profile and stock",
        `Verify message evidence, approved profile provenance, task readiness, quantity, fulfilment, payment method and inventory conservation for ${packetLabel}.`,
        "agent-quality",
        spec.marketLocationId,
        [ids.offer],
        850,
      ),
      task(
        ids.payment,
        `Authorise simulated payment · ${spec.paymentMethod}`,
        `Commit only the local simulated purchase of ${packetLabel} with ${spec.paymentMethod}; a saved method is context, never a real payment credential.`,
        "agent-finance",
        "otemachi",
        [ids.quality],
        750,
        {
          requiresApproval: true,
          approvalLabel: `Allow simulated ${spec.paymentMethod} payment for ${packetLabel}`,
          actionType: "authorize_payment",
        },
      ),
      ...(courier ? [task(
        ids.travel,
        "Courier agent travels to the marketplace",
        `After simulated authorisation, the courier agent travels to collect ${packetLabel} under the structured fulfilment instruction.`,
        spec.carrierAgentId,
        spec.marketLocationId,
        travelDependencies,
        650,
      )] : []),
      task(
        ids.handoff,
        `Store hands the item to the ${spec.carrierLabel}`,
        `Commit a GOODS_HANDOFF packet and move ${packetLabel} from reserved stock into ${spec.carrierAgentId} cargo.`,
        spec.carrierAgentId,
        spec.marketLocationId,
        handoffDependencies,
        800,
      ),
      task(
        ids.returning,
        `${spec.carrierLabel === "courier agent" ? "Courier" : "Personal"} agent carries the item home`,
        `Return to the user with ${packetLabel} held in canonical ${spec.carrierAgentId} cargo state.`,
        spec.carrierAgentId,
        "shibuya",
        [ids.handoff],
        550,
      ),
      task(
        ids.deliver,
        "Transfer the item into user inventory",
        `Commit DELIVERY_RECEIPT and transfer ${packetLabel} from ${spec.carrierAgentId} cargo to user inventory.`,
        spec.carrierAgentId,
        "shibuya",
        [ids.returning],
        700,
      ),
      task(
        ids.verify,
        "Verify delivery and close the goal",
        `Confirm the request, profile provenance, structured packets, readiness contract, approvals and inventory ledger reconcile for ${spec.goal.id}.`,
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
    summary: `Compile “${envelope.rawMessage.text}” into a versioned task intent, use approved preferences where the message is silent, ask for the next blocking requirement when needed, and coordinate real engine tasks.`,
    outcome: "The selected simulated carrier returned from the marketplace and the canonical ledger recorded delivery into user inventory.",
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

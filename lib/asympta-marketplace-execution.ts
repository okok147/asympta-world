import type { WorkflowId } from "./atlas-simulation.ts";
import {
  marketplaceStableHash,
  type ContextEnvelope,
  type MarketplaceDomain,
} from "./asympta-context-compiler.ts";
import type {
  MarketplaceFulfilmentMethod,
  MarketplacePaymentMethod,
} from "./asympta-marketplace-profile.ts";
import {
  MARKETPLACE_WORKFLOW_ID,
  marketplaceRuntimeSpecs,
  marketplaceTaskIds,
} from "./asympta-marketplace-workflow.ts";

export type MarketplacePacketKind =
  | "intent"
  | "context_envelope"
  | "enquiry"
  | "availability"
  | "offer"
  | "verification"
  | "approval_request"
  | "payment_authorized"
  | "goods_handoff"
  | "delivery_receipt"
  | "blocked";

export type MarketplacePacket = {
  schemaVersion: "asympta.packet.v1";
  id: string;
  correlationId: string;
  sequence: number;
  kind: MarketplacePacketKind;
  from: string;
  to: string;
  goalId?: string;
  payload: Record<string, unknown>;
  provenance: "simulated";
};

export type MarketplaceLedgerLine = {
  goalId: string;
  domain: MarketplaceDomain;
  itemId: string;
  itemLabel: string;
  quantity: number;
  carrierAgentId: "agent-user" | "agent-logistics";
  initialMarketStock: number;
  marketAvailable: number;
  marketReserved: number;
  carrierCargo: number;
  carriedByPersonalAgent: number;
  userInventory: number;
};

export type MarketplaceTransactionStatus =
  | "planned"
  | "store_contacted"
  | "stock_reserved"
  | "offer_ready"
  | "awaiting_approval"
  | "authorized"
  | "goods_collected"
  | "returning_to_user"
  | "delivered"
  | "completed"
  | "blocked";

export type MarketplaceTransaction = {
  goalId: string;
  status: MarketplaceTransactionStatus;
  payment: "not_requested" | "awaiting_approval" | "authorized" | "declined" | "failed";
  marketLocationId: string;
  fulfilmentMethod: MarketplaceFulfilmentMethod;
  paymentMethod: MarketplacePaymentMethod;
  carrierAgentId: "agent-user" | "agent-logistics";
};

export type MarketplaceExecutionStatus =
  | "routing"
  | "travelling_to_market"
  | "coordinating"
  | "awaiting_approval"
  | "returning_to_user"
  | "completed"
  | "blocked";

export type MarketplaceExecution = {
  schemaVersion: "asympta.marketplace-execution.v1";
  executionId: string;
  workflowId: WorkflowId;
  revision: number;
  envelope: ContextEnvelope;
  status: MarketplaceExecutionStatus;
  activeGoalId: string | null;
  progress: number;
  ledger: MarketplaceLedgerLine[];
  transactions: MarketplaceTransaction[];
  packets: MarketplacePacket[];
  appliedEffects: string[];
  lastWorldSignature: string;
};

export type MarketplaceWorldTaskSnapshot = {
  id: string;
  status: string;
  approvalStatus?: string | null;
  progress?: number;
};

export type MarketplaceWorldSnapshot = {
  phase?: string;
  tasks?: MarketplaceWorldTaskSnapshot[];
  pendingApprovals?: Array<{ id?: string; taskId?: string | null; actionType?: string | null }>;
};

function cloneExecution(execution: MarketplaceExecution): MarketplaceExecution {
  return JSON.parse(JSON.stringify(execution)) as MarketplaceExecution;
}

function taskState(snapshot: MarketplaceWorldSnapshot, id: string) {
  return snapshot.tasks?.find((candidate) => candidate.id === id)?.status ?? "missing";
}

function taskDone(snapshot: MarketplaceWorldSnapshot, id: string) {
  return taskState(snapshot, id) === "done";
}

function taskActive(snapshot: MarketplaceWorldSnapshot, id: string) {
  return ["moving", "working", "waiting_approval"].includes(taskState(snapshot, id));
}

function signature(snapshot: MarketplaceWorldSnapshot) {
  return JSON.stringify({
    phase: snapshot.phase ?? null,
    tasks: (snapshot.tasks ?? []).map((candidate) => [candidate.id, candidate.status, candidate.progress ?? 0]),
    approvals: (snapshot.pendingApprovals ?? []).map((candidate) => [candidate.id, candidate.taskId, candidate.actionType]),
  });
}

function addPacket(
  execution: MarketplaceExecution,
  kind: MarketplacePacketKind,
  from: string,
  to: string,
  payload: Record<string, unknown>,
  goalId?: string,
) {
  const sequence = execution.packets.length + 1;
  execution.packets.push({
    schemaVersion: "asympta.packet.v1",
    id: `${execution.executionId}:packet:${sequence}`,
    correlationId: execution.envelope.requestId,
    sequence,
    kind,
    from,
    to,
    goalId,
    payload,
    provenance: "simulated",
  });
  execution.packets = execution.packets.slice(-28);
}

function applyOnce(execution: MarketplaceExecution, effect: string, mutate: () => void) {
  if (execution.appliedEffects.includes(effect)) return;
  mutate();
  execution.appliedEffects.push(effect);
  execution.revision += 1;
}

function ledgerFor(execution: MarketplaceExecution, goalId: string) {
  const line = execution.ledger.find((candidate) => candidate.goalId === goalId);
  if (!line) throw new Error(`Missing marketplace ledger line for ${goalId}.`);
  return line;
}

function transactionFor(execution: MarketplaceExecution, goalId: string) {
  const transaction = execution.transactions.find((candidate) => candidate.goalId === goalId);
  if (!transaction) throw new Error(`Missing marketplace transaction for ${goalId}.`);
  return transaction;
}

function setCarrierCargo(line: MarketplaceLedgerLine, quantity: number) {
  line.carrierCargo = quantity;
  line.carriedByPersonalAgent = line.carrierAgentId === "agent-user" ? quantity : 0;
}

export function createMarketplaceExecution(envelope: ContextEnvelope): MarketplaceExecution {
  const specs = marketplaceRuntimeSpecs(envelope);
  const executionId = `execution-${marketplaceStableHash(`${envelope.requestId}:${envelope.createdAt}`)}`;
  const execution: MarketplaceExecution = {
    schemaVersion: "asympta.marketplace-execution.v1",
    executionId,
    workflowId: MARKETPLACE_WORKFLOW_ID,
    revision: 1,
    envelope,
    status: "routing",
    activeGoalId: specs[0]?.goal.id ?? null,
    progress: 0,
    ledger: specs.map((spec) => {
      const initialMarketStock = Math.max(spec.goal.domain === "food" ? 6 : 4, spec.quantity + 2);
      return {
        goalId: spec.goal.id,
        domain: spec.goal.domain,
        itemId: `${spec.goal.domain}:${marketplaceStableHash(spec.itemLabel)}`,
        itemLabel: spec.itemLabel,
        quantity: spec.quantity,
        carrierAgentId: spec.carrierAgentId,
        initialMarketStock,
        marketAvailable: initialMarketStock,
        marketReserved: 0,
        carrierCargo: 0,
        carriedByPersonalAgent: 0,
        userInventory: 0,
      };
    }),
    transactions: specs.map((spec) => ({
      goalId: spec.goal.id,
      status: "planned",
      payment: "not_requested",
      marketLocationId: spec.marketLocationId,
      fulfilmentMethod: spec.fulfilmentMethod,
      paymentMethod: spec.paymentMethod,
      carrierAgentId: spec.carrierAgentId,
    })),
    packets: [],
    appliedEffects: [],
    lastWorldSignature: "",
  };
  addPacket(execution, "intent", "human", "agent-user", {
    envelopeId: envelope.requestId,
    rawMessageRef: envelope.rawMessage.sourceRef,
    goalIds: envelope.goals.map((goal) => goal.id),
    profileRef: envelope.provenance.profileRef ?? null,
  });
  return execution;
}

export function syncMarketplaceExecution(current: MarketplaceExecution, snapshot: MarketplaceWorldSnapshot) {
  const nextSignature = signature(snapshot);
  if (nextSignature === current.lastWorldSignature) return current;

  const execution = cloneExecution(current);
  execution.lastWorldSignature = nextSignature;
  const totalTasks = Math.max(1, snapshot.tasks?.length ?? 0);
  const completedTasks = snapshot.tasks?.filter((candidate) => candidate.status === "done").length ?? 0;
  execution.progress = Math.min(1, completedTasks / totalTasks);

  if (taskDone(snapshot, "mp-context")) {
    applyOnce(execution, "context", () => {
      addPacket(execution, "context_envelope", "agent-user", "agent-market", {
        schemaVersion: execution.envelope.schemaVersion,
        contextVersion: execution.envelope.contextVersion,
        profileRef: execution.envelope.provenance.profileRef ?? null,
        goals: execution.envelope.goals.map((goal) => ({
          id: goal.id,
          domain: goal.domain,
          explicit: goal.facts.filter((fact) => fact.status === "explicit").map((fact) => fact.key),
          profile: goal.facts.filter((fact) => fact.status === "profile").map((fact) => fact.key),
          defaults: goal.facts.filter((fact) => fact.status === "defaulted").map((fact) => fact.key),
          unknownFields: goal.unknownFields,
        })),
      });
    });
  }

  for (const [index, goal] of execution.envelope.goals.entries()) {
    const ids = marketplaceTaskIds(goal, index);
    const line = ledgerFor(execution, goal.id);
    const transaction = transactionFor(execution, goal.id);

    if (taskActive(snapshot, ids.travel)) {
      execution.status = "travelling_to_market";
      execution.activeGoalId = goal.id;
    }

    if (taskDone(snapshot, ids.store)) {
      execution.status = "coordinating";
      applyOnce(execution, `${goal.id}:store`, () => {
        transaction.status = "store_contacted";
        addPacket(execution, "enquiry", "agent-user", "agent-market", {
          itemId: line.itemId,
          itemLabel: line.itemLabel,
          quantity: line.quantity,
          fulfilmentMethod: transaction.fulfilmentMethod,
          paymentMethod: transaction.paymentMethod,
          carrierAgentId: transaction.carrierAgentId,
          unknownFields: goal.unknownFields,
        }, goal.id);
      });
    }

    if (taskDone(snapshot, ids.stock)) {
      execution.status = "coordinating";
      applyOnce(execution, `${goal.id}:stock`, () => {
        line.marketAvailable -= line.quantity;
        line.marketReserved += line.quantity;
        transaction.status = "stock_reserved";
        addPacket(execution, "availability", "agent-supplier", "agent-market", {
          itemId: line.itemId,
          requested: line.quantity,
          reserved: line.quantity,
          remainingAvailable: line.marketAvailable,
        }, goal.id);
      });
    }

    if (taskDone(snapshot, ids.offer)) {
      execution.status = "coordinating";
      applyOnce(execution, `${goal.id}:offer`, () => {
        transaction.status = "offer_ready";
        addPacket(execution, "offer", "agent-business", "agent-user", {
          itemId: line.itemId,
          quantity: line.quantity,
          fulfilmentMethod: transaction.fulfilmentMethod,
          paymentMethod: transaction.paymentMethod,
          paymentRequired: true,
          realWorldSideEffect: false,
        }, goal.id);
      });
    }

    if (taskDone(snapshot, ids.quality)) {
      execution.status = "coordinating";
      applyOnce(execution, `${goal.id}:quality`, () => {
        addPacket(execution, "verification", "agent-quality", "agent-finance", {
          contextEvidenceValid: true,
          profileProvenanceValid: Boolean(execution.envelope.provenance.profileRef) || goal.facts.every((fact) => fact.status !== "profile"),
          stockInvariantValid: marketplaceInventoryInvariant(execution).valid,
          provenance: "simulated",
        }, goal.id);
      });
    }

    const paymentState = taskState(snapshot, ids.payment);
    if (paymentState === "waiting_approval") {
      execution.status = "awaiting_approval";
      execution.activeGoalId = goal.id;
      applyOnce(execution, `${goal.id}:approval-request`, () => {
        transaction.status = "awaiting_approval";
        transaction.payment = "awaiting_approval";
        addPacket(execution, "approval_request", "agent-finance", "human", {
          action: "authorize_simulated_payment",
          paymentMethod: transaction.paymentMethod,
          itemId: line.itemId,
          quantity: line.quantity,
          consequence: "Advance simulated state only; no real charge or order.",
        }, goal.id);
      });
    }

    if (paymentState === "blocked") {
      execution.status = "blocked";
      transaction.status = "blocked";
      const paymentTask = snapshot.tasks?.find((task) => task.id === ids.payment);
      const acceptedButFailed = paymentTask?.approvalStatus === "approved";
      transaction.payment = acceptedButFailed ? "failed" : "declined";
      applyOnce(execution, `${goal.id}:blocked`, () => {
        const inventoryReleased = line.marketReserved >= line.quantity;
        if (line.marketReserved >= line.quantity) {
          line.marketReserved -= line.quantity;
          line.marketAvailable += line.quantity;
        }
        addPacket(execution, "blocked", acceptedButFailed ? "agent-finance" : "human", "agent-finance", {
          reason: acceptedButFailed ? "simulated_payment_execution_failed" : "simulated_payment_declined",
          humanDecision: acceptedButFailed ? "approved" : "declined",
          paymentMethod: transaction.paymentMethod,
          inventoryReleased,
        }, goal.id);
      });
    }

    if (taskDone(snapshot, ids.payment)) {
      execution.status = "coordinating";
      applyOnce(execution, `${goal.id}:payment`, () => {
        transaction.status = "authorized";
        transaction.payment = "authorized";
        addPacket(execution, "payment_authorized", "human", "agent-finance", {
          simulated: true,
          paymentMethod: transaction.paymentMethod,
          itemId: line.itemId,
          quantity: line.quantity,
        }, goal.id);
      });
    }

    if (taskDone(snapshot, ids.handoff)) {
      execution.status = "coordinating";
      applyOnce(execution, `${goal.id}:handoff`, () => {
        line.marketReserved -= line.quantity;
        setCarrierCargo(line, line.carrierCargo + line.quantity);
        transaction.status = "goods_collected";
        addPacket(execution, "goods_handoff", "agent-market", transaction.carrierAgentId, {
          itemId: line.itemId,
          quantity: line.quantity,
          fulfilmentMethod: transaction.fulfilmentMethod,
          fromLedger: "market_reserved",
          toLedger: `${transaction.carrierAgentId}_cargo`,
        }, goal.id);
      });
    }

    if (taskActive(snapshot, ids.returning) || taskDone(snapshot, ids.returning)) {
      execution.status = "returning_to_user";
      execution.activeGoalId = goal.id;
      transaction.status = "returning_to_user";
    }

    if (taskDone(snapshot, ids.deliver)) {
      applyOnce(execution, `${goal.id}:deliver`, () => {
        setCarrierCargo(line, line.carrierCargo - line.quantity);
        line.userInventory += line.quantity;
        transaction.status = "delivered";
        addPacket(execution, "delivery_receipt", transaction.carrierAgentId, "human", {
          itemId: line.itemId,
          itemLabel: line.itemLabel,
          quantity: line.quantity,
          fulfilmentMethod: transaction.fulfilmentMethod,
          fromLedger: `${transaction.carrierAgentId}_cargo`,
          toLedger: "user_inventory",
        }, goal.id);
      });
    }

    if (taskDone(snapshot, ids.verify)) {
      transaction.status = "completed";
    }
  }

  if (snapshot.phase === "blocked") execution.status = "blocked";
  else if (snapshot.phase === "completed" || execution.transactions.every((transaction) => transaction.status === "completed")) {
    execution.status = "completed";
    execution.activeGoalId = null;
    execution.progress = 1;
  } else if (execution.status === "routing" && (snapshot.tasks?.some((candidate) => ["moving", "working"].includes(candidate.status)) ?? false)) {
    execution.status = "coordinating";
  } else if (!new Set(["travelling_to_market", "awaiting_approval", "returning_to_user"]).has(execution.status)) {
    execution.status = "coordinating";
  }

  const invariant = marketplaceInventoryInvariant(execution);
  if (!invariant.valid) throw new Error(invariant.issues.join(" "));
  execution.revision += 1;
  return execution;
}

export function marketplaceInventoryInvariant(execution: MarketplaceExecution) {
  const issues: string[] = [];
  for (const line of execution.ledger) {
    const values = [line.marketAvailable, line.marketReserved, line.carrierCargo, line.userInventory];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) issues.push(`${line.itemId} contains a negative or invalid quantity.`);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total !== line.initialMarketStock) issues.push(`${line.itemId} inventory is not conserved: ${total} != ${line.initialMarketStock}.`);
    if (line.carriedByPersonalAgent !== (line.carrierAgentId === "agent-user" ? line.carrierCargo : 0)) {
      issues.push(`${line.itemId} personal-agent compatibility cargo is inconsistent.`);
    }
  }
  return { valid: issues.length === 0, issues };
}

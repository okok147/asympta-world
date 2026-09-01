import type { AsymptaActivity } from "./asympta-activity.ts";
import type { AsymptaCurrentRequest } from "./asympta-current-request.ts";
import {
  marketplaceCompletionEvidence,
  marketplaceInventoryInvariant,
  type MarketplaceExecution,
} from "./asympta-marketplace-intent.ts";

export const ASYMPTA_COMPLETION_RECEIPT_EVENT = "asympta:completion-receipt" as const;

export type AsymptaCompletionReceiptProvenance =
  | "marketplace_execution"
  | "current_request"
  | "workflow"
  | "activity";

export type AsymptaCompletionReceipt = {
  schemaVersion: "asympta.completion-receipt.v1";
  id: string;
  requestId: string | null;
  title: string;
  summary: string;
  verification: "verified";
  simulated: boolean;
  provenance: AsymptaCompletionReceiptProvenance;
  completedAt: string;
  details?: Record<string, unknown>;
};

function timestamp(now: string | number | Date = Date.now()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
}

function compactText(value: unknown, fallback: string, max = 240) {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (clean || fallback).slice(0, max);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function completionReceiptFromCurrentRequest(
  request: AsymptaCurrentRequest,
  now: string | number | Date = Date.now(),
): AsymptaCompletionReceipt | null {
  if (!request?.requestId || request.status !== "completed" || request.verification !== "verified") return null;

  // Generic write/action requests do not carry execution-mode provenance in the
  // display projection. Their completion receipt must come from the canonical
  // activity/Task Kernel outcome instead of guessing whether it was simulated.
  if (request.kind === "action") return null;

  return {
    schemaVersion: "asympta.completion-receipt.v1",
    id: `request:${request.requestId}`,
    requestId: request.requestId,
    title: compactText(request.goal ?? request.intent, "Job completed", 120),
    summary: compactText(request.step, "The requested job was completed and verified."),
    verification: "verified",
    simulated: request.kind === "marketplace",
    provenance: "current_request",
    completedAt: timestamp(now),
    details: {
      kind: request.kind,
      permission: request.permission,
      actor: request.actor,
      destination: request.destination,
      sourceCount: request.sourceCount,
    },
  };
}

function completedMarketplaceGoals(execution: MarketplaceExecution) {
  const receiptGoals = new Set(
    execution.packets
      .filter((packet) => packet.kind === "delivery_receipt" && typeof packet.goalId === "string")
      .map((packet) => packet.goalId as string),
  );
  return execution.transactions.every((transaction) => transaction.status === "completed" && transaction.payment === "authorized")
    && execution.ledger.every((line) => (
      line.userInventory >= line.quantity
      && line.marketReserved === 0
      && line.carrierCargo === 0
      && receiptGoals.has(line.goalId)
    ));
}

export function completionReceiptFromMarketplaceExecution(
  execution: MarketplaceExecution,
  now: string | number | Date = Date.now(),
): AsymptaCompletionReceipt | null {
  if (!execution?.envelope?.requestId || execution.status !== "completed") return null;
  const invariant = marketplaceInventoryInvariant(execution);
  const evidence = marketplaceCompletionEvidence(execution);
  if (!invariant.valid || !evidence.valid || !execution.transactions.length || !execution.ledger.length || !completedMarketplaceGoals(execution)) return null;

  const quantity = execution.ledger.reduce((sum, line) => sum + line.quantity, 0);
  const labels = execution.ledger.map((line) => `${line.quantity} × ${line.itemLabel}`);
  const receiptPackets = execution.packets.filter((packet) => packet.kind === "delivery_receipt");
  return {
    schemaVersion: "asympta.completion-receipt.v1",
    id: `request:${execution.envelope.requestId}`,
    requestId: execution.envelope.requestId,
    title: compactText(execution.envelope.rawMessage.text, "Marketplace job completed", 120),
    summary: quantity === 1
      ? `${labels[0]} was delivered into simulated user inventory and verified.`
      : `${quantity} requested items were delivered into simulated user inventory and verified.`,
    verification: "verified",
    simulated: true,
    provenance: "marketplace_execution",
    completedAt: timestamp(now),
    details: {
      executionId: execution.executionId,
      workflowId: execution.workflowId,
      items: labels,
      paymentMethods: [...new Set(execution.transactions.map((transaction) => transaction.paymentMethod))],
      fulfilmentMethods: [...new Set(execution.transactions.map((transaction) => transaction.fulfilmentMethod))],
      deliveryReceiptPacketIds: receiptPackets.map((packet) => packet.id),
      inventoryInvariant: true,
    },
  };
}

export type CompletionWorkflowSnapshot = {
  phase?: string;
  workflowId?: string | null;
  workflow?: string | null;
  tasks?: Array<{ id?: string; title?: string; status?: string }>;
  recentEvents?: Array<{ title?: string; detail?: string }>;
};

export function completionReceiptFromWorkflowSnapshot(
  snapshot: CompletionWorkflowSnapshot,
  now: string | number | Date = Date.now(),
): AsymptaCompletionReceipt | null {
  const tasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks : [];
  const workflowId = typeof snapshot?.workflowId === "string" ? snapshot.workflowId : "";
  if (!workflowId || workflowId === "marketplace-intent" || snapshot.phase !== "completed" || !tasks.length) return null;
  if (!tasks.every((task) => task.status === "done" && typeof task.id === "string")) return null;
  const completionEvent = snapshot.recentEvents?.find((event) => /complete/i.test(event.title ?? ""));
  const signature = tasks.map((task) => task.id).sort().join("|");
  return {
    schemaVersion: "asympta.completion-receipt.v1",
    id: `workflow:${workflowId}:${signature}`,
    requestId: null,
    title: compactText(snapshot.workflow, "Workflow completed", 120),
    summary: compactText(completionEvent?.detail, "Every workflow task was completed in the simulated Asympta world."),
    verification: "verified",
    simulated: true,
    provenance: "workflow",
    completedAt: timestamp(now),
    details: {
      workflowId,
      taskIds: tasks.map((task) => task.id),
      completedTaskCount: tasks.length,
    },
  };
}

function explicitSimulationProvenance(value: unknown, depth = 0, seen = new Set<object>()): boolean | null {
  if (depth > 4) return null;
  const candidate = record(value);
  if (!candidate || seen.has(candidate)) return null;
  seen.add(candidate);

  if (typeof candidate.simulated === "boolean") return candidate.simulated;
  if (candidate.mode === "simulated") return true;
  if (candidate.mode === "live") return false;

  for (const key of ["provenance", "result", "outcome", "task", "value"] as const) {
    const nested = explicitSimulationProvenance(candidate[key], depth + 1, seen);
    if (nested !== null) return nested;
  }
  return null;
}

function activitySimulationProvenance(activity: AsymptaActivity) {
  const explicit = explicitSimulationProvenance(activity.outcome?.value);
  if (explicit !== null) return explicit;

  // Connected A2A/MCP evidence is a live transport provenance signal. It is
  // different from Asympta's local simulated-world execution and may therefore
  // be shown as non-simulated only after a verified protocol outcome exists.
  if (activity.evidence.some((evidence) => evidence.protocol === "a2a" || evidence.protocol === "mcp")) return false;
  return null;
}

export function completionReceiptFromActivity(
  activity: AsymptaActivity,
  now: string | number | Date = Date.now(),
): AsymptaCompletionReceipt | null {
  const id = activity?.id?.trim() ?? "";
  const outcome = activity?.outcome;
  if (!id || activity.status !== "completed" || !outcome?.verified || outcome.verification === "none") return null;

  const simulated = activitySimulationProvenance(activity);
  if (simulated === null) return null;

  return {
    schemaVersion: "asympta.completion-receipt.v1",
    id: `request:${id}`,
    requestId: id,
    title: compactText(activity.intent?.raw, "Job completed", 120),
    summary: compactText(outcome.summary, "The requested job was completed and verified."),
    verification: "verified",
    simulated,
    provenance: "activity",
    completedAt: timestamp(now),
    details: {
      verificationMethod: outcome.verification,
      evidenceCount: activity.evidence.length,
      evidenceProtocols: [...new Set(activity.evidence.map((evidence) => evidence.protocol))],
    },
  };
}

export function publishAsymptaCompletionReceipt(receipt: AsymptaCompletionReceipt) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AsymptaCompletionReceipt>(ASYMPTA_COMPLETION_RECEIPT_EVENT, {
    detail: receipt,
  }));
}

export function subscribeAsymptaCompletionReceipts(listener: (receipt: AsymptaCompletionReceipt) => void) {
  if (typeof window === "undefined") return () => undefined;
  const onReceipt = (event: Event) => {
    const receipt = (event as CustomEvent<AsymptaCompletionReceipt>).detail;
    if (receipt?.schemaVersion === "asympta.completion-receipt.v1" && receipt.verification === "verified") listener(receipt);
  };
  window.addEventListener(ASYMPTA_COMPLETION_RECEIPT_EVENT, onReceipt);
  return () => window.removeEventListener(ASYMPTA_COMPLETION_RECEIPT_EVENT, onReceipt);
}

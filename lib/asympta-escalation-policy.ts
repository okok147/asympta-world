export type WorkflowId = "custom-order" | "dinner-network" | "launch-stock" | "service-recovery";

export type ForegroundSnapshot = {
  phase?: string;
  workflow?: string | null;
  tasks?: Array<{ id: string; status: string; progress: number }>;
  agents?: Array<{ id: string; status: string; lon?: number; lat?: number; taskId?: string | null }>;
  pendingApprovals?: Array<{ id: string; source?: string; taskId?: string | null }>;
};

export type EscalationDecision =
  | { kind: "none" }
  | { kind: "approve-missed-auto"; approvalId: string; code: "auto-approve-recovery" }
  | { kind: "remind-human"; approvalId: string; code: "human-authority-required" }
  | { kind: "restart-workflow"; workflowId: WorkflowId; code: "safe-replay" };

export const CORE_STALL_ESCALATION_MS = 5_500;
export const APPROVAL_ESCALATION_MS = 6_500;
export const BLOCKED_RECOVERY_MS = 1_500;

const WORKFLOW_BY_NAME: Record<string, WorkflowId> = {
  "Custom Order Network": "custom-order",
  "Dinner Coordination": "dinner-network",
  "Launch Stock Orchestration": "launch-stock",
  "Service Recovery Network": "service-recovery",
};

export function foregroundProgressSignature(snapshot: ForegroundSnapshot) {
  const tasks = (snapshot.tasks ?? [])
    .map((task) => `${task.id}:${task.status}:${Number(task.progress ?? 0).toFixed(3)}`)
    .join("|");
  const agents = (snapshot.agents ?? [])
    .map((agent) => `${agent.id}:${agent.status}:${Number(agent.lon ?? 0).toFixed(5)}:${Number(agent.lat ?? 0).toFixed(5)}:${agent.taskId ?? ""}`)
    .join("|");
  const approvals = (snapshot.pendingApprovals ?? [])
    .map((approval) => `${approval.id}:${approval.source ?? "workflow"}:${approval.taskId ?? ""}`)
    .join("|");
  return `${snapshot.phase ?? ""}::${snapshot.workflow ?? ""}::${tasks}::${agents}::${approvals}`;
}

export function decideWorkflowEscalation(
  snapshot: ForegroundSnapshot,
  stagnantMs: number,
  autoApproveOn: boolean,
): EscalationDecision {
  const pending = snapshot.pendingApprovals?.[0];
  if (pending) {
    if (stagnantMs < APPROVAL_ESCALATION_MS) return { kind: "none" };
    if (autoApproveOn && (pending.source ?? "workflow") === "workflow") {
      return { kind: "approve-missed-auto", approvalId: pending.id, code: "auto-approve-recovery" };
    }
    return { kind: "remind-human", approvalId: pending.id, code: "human-authority-required" };
  }

  const workflowId = snapshot.workflow ? WORKFLOW_BY_NAME[snapshot.workflow] : undefined;
  if (!workflowId) return { kind: "none" };

  const unfinished = (snapshot.tasks ?? []).some((task) => task.status !== "done");
  if (!unfinished) return { kind: "none" };

  // A declined checkpoint intentionally blocks the current attempt, but must not
  // deadlock the whole demo. Senior coordination starts a fresh safe attempt after
  // a short cooling-off period. The declined action itself is never auto-approved.
  if (snapshot.phase === "blocked") {
    if (stagnantMs < BLOCKED_RECOVERY_MS) return { kind: "none" };
    return { kind: "restart-workflow", workflowId, code: "safe-replay" };
  }

  if (snapshot.phase !== "running" || stagnantMs < CORE_STALL_ESCALATION_MS) return { kind: "none" };
  return { kind: "restart-workflow", workflowId, code: "safe-replay" };
}

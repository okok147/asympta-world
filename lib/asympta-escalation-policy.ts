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
  | { kind: "remind-human"; approvalId: string; code: "human-authority-required" };

export const CORE_STALL_ESCALATION_MS = 5_500;
export const APPROVAL_ESCALATION_MS = 6_500;
export const BLOCKED_RECOVERY_MS = 1_500;

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

  // Runtime/agent cooperation owns operational recovery. A stalled or blocked
  // workflow must remain the same workflow so higher agents can inspect the real
  // state, preserve funds/history/progress, solve the dependency, and resume.
  // This UI guard therefore never restarts or replays a workflow automatically.
  if (snapshot.phase === "blocked") {
    if (stagnantMs < BLOCKED_RECOVERY_MS) return { kind: "none" };
    return { kind: "none" };
  }

  if (snapshot.phase === "running" && stagnantMs >= CORE_STALL_ESCALATION_MS) {
    return { kind: "none" };
  }

  return { kind: "none" };
}

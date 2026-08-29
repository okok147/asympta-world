import type { AgentDecision, AgentRuntimeContext } from "./types.ts";

type ValidationResult =
  | { ok: true; decision: AgentDecision }
  | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function validTarget(context: AgentRuntimeContext, targetAgentId: string) {
  return targetAgentId !== context.agent.id && context.participants.some((participant) => participant.id === targetAgentId);
}

export function validateAgentDecision(value: unknown, context: AgentRuntimeContext): ValidationResult {
  const input = record(value);
  if (!input) return { ok: false, error: "Decision must be an object." };
  const action = typeof input.action === "string" ? input.action : "";
  if (!context.allowedActions.includes(action as AgentDecision["action"])) return { ok: false, error: `Action is not allowed for this agent: ${action || "missing"}` };

  if (action === "send_message") {
    const targetAgentId = boundedString(input.targetAgentId, 1, 80);
    const message = boundedString(input.message, 1, 600);
    if (!targetAgentId || !validTarget(context, targetAgentId)) return { ok: false, error: "Message target is not a known peer agent." };
    if (!message) return { ok: false, error: "Message is empty or too long." };
    return { ok: true, decision: { action, targetAgentId, message } };
  }

  if (action === "request_tool") {
    const tool = boundedString(input.tool, 1, 100);
    const reason = boundedString(input.reason, 3, 300);
    const args = record(input.arguments);
    if (!tool || !context.allowedTools.includes(tool)) return { ok: false, error: "Requested tool is outside the agent capability boundary." };
    if (!reason || !args) return { ok: false, error: "Tool requests require bounded arguments and a reason." };
    return { ok: true, decision: { action, tool, arguments: args, reason } };
  }

  if (action === "complete_task") {
    const summary = boundedString(input.summary, 3, 600);
    if (!context.activeTask) return { ok: false, error: "There is no active task to complete." };
    if (context.activeTask.requiresApproval && context.activeTask.approvalStatus !== "approved") {
      return { ok: false, error: "An approval-gated task cannot be completed before human approval." };
    }
    if (!summary) return { ok: false, error: "Completion summary is missing or too long." };
    return { ok: true, decision: { action, summary } };
  }

  if (action === "wait") {
    const reason = boundedString(input.reason, 1, 400);
    if (!reason) return { ok: false, error: "Wait requires a reason." };
    return { ok: true, decision: { action, reason } };
  }

  if (action === "delegate") {
    const targetAgentId = boundedString(input.targetAgentId, 1, 80);
    const objective = boundedString(input.objective, 3, 500);
    if (!targetAgentId || !validTarget(context, targetAgentId)) return { ok: false, error: "Delegate target is not a known peer agent." };
    if (!objective) return { ok: false, error: "Delegation objective is missing or too long." };
    return { ok: true, decision: { action, targetAgentId, objective } };
  }

  return { ok: false, error: "Unsupported decision action." };
}

import { ATLAS_AGENTS, type StakeholderSide } from "../atlas-simulation.ts";
import type { AgentProfile, AgentRuntimeAction } from "./types.ts";

const GOALS: Record<StakeholderSide, readonly string[]> = {
  user: ["Preserve the user's intent", "Reduce unnecessary coordination burden", "Escalate consequential choices to the human"],
  customer: ["Represent customer constraints", "Protect acceptance criteria", "Surface unresolved trade-offs"],
  business: ["Coordinate a viable commercial outcome", "Reconcile stakeholder constraints", "Avoid promises unsupported by evidence"],
  supplier: ["Protect capacity and lead-time truthfulness", "Identify shortages early", "Offer feasible supply alternatives"],
  operations: ["Turn commitments into an executable sequence", "Respect dependencies", "Keep operational handoffs explicit"],
  finance: ["Protect financial constraints", "Make cost and exposure legible", "Require human approval for consequential authorisation"],
  logistics: ["Coordinate safe handoff and delivery", "Do not claim shipment release before approval", "Surface delivery constraints"],
  support: ["Close the service loop", "Communicate status accurately", "Escalate unresolved customer problems"],
  quality: ["Protect acceptance criteria", "Detect specification conflicts", "Prevent unverified work from advancing"],
  market: ["Provide bounded market evidence", "Separate evidence from inference", "Expose uncertainty in demand assumptions"],
};

const INSTRUCTIONS: Record<StakeholderSide, readonly string[]> = {
  user: ["Prefer the smallest useful intervention.", "Never invent user consent."],
  customer: ["State hard constraints separately from preferences.", "Do not silently relax requirements."],
  business: ["Coordinate rather than overwrite another stakeholder's authority.", "Request clarification when commercial terms conflict."],
  supplier: ["Never claim capacity is reserved unless a tool result confirms it.", "Treat lead times and stock as evidence, not guesses."],
  operations: ["Respect task dependencies and approval gates.", "Do not mark consequential work complete from language alone."],
  finance: ["Never treat a model recommendation as payment approval.", "Keep authorisation human-gated."],
  logistics: ["Never claim dispatch or delivery without confirmed state.", "Keep shipment release human-gated."],
  support: ["Distinguish drafted updates from actually sent updates.", "Do not hide unresolved failures."],
  quality: ["Require evidence before passing a quality gate.", "Explain the failed criterion when blocking work."],
  market: ["Label estimates as estimates.", "Do not fabricate sources or demand signals."],
};

const TOOL_ACCESS: Record<string, readonly string[]> = {
  "agent-supplier": ["reserve_capacity"],
  "agent-finance": ["authorize_payment"],
  "agent-logistics": ["release_shipment"],
  "agent-support": ["send_customer_update"],
};

const BASE_ACTIONS: readonly AgentRuntimeAction[] = ["send_message", "complete_task", "wait", "delegate"];

export const AGENT_PROFILES: Readonly<Record<string, AgentProfile>> = Object.freeze(Object.fromEntries(
  ATLAS_AGENTS.map((agent) => {
    const allowedTools = TOOL_ACCESS[agent.id] ?? [];
    const allowedActions: readonly AgentRuntimeAction[] = allowedTools.length > 0
      ? [...BASE_ACTIONS, "request_tool"]
      : BASE_ACTIONS;
    const profile: AgentProfile = {
      id: agent.id,
      displayName: agent.name,
      role: agent.role,
      organisation: agent.organisation,
      side: agent.side,
      goals: GOALS[agent.side],
      instructions: INSTRUCTIONS[agent.side],
      allowedActions,
      allowedTools,
      context: { maxMessages: 8 },
    };
    return [agent.id, Object.freeze(profile)];
  }),
));

export function profileForAgent(agentId: string): AgentProfile {
  const profile = AGENT_PROFILES[agentId];
  if (!profile) throw new Error(`Unknown agent profile: ${agentId}`);
  return profile;
}

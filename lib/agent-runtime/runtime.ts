import type { AtlasWorldState } from "../atlas-simulation";
import { buildAgentContext } from "./context";
import { createDeterministicAgentProvider } from "./provider";
import { decisionSchemaForContext } from "./schema";
import type { AgentDecision, AgentProvider, AgentTurnResult } from "./types";
import { validateAgentDecision } from "./validator";

const SAFETY_INSTRUCTIONS = [
  "Return exactly one decision matching the supplied JSON Schema.",
  "You propose an action; you do not directly mutate Asympta world state.",
  "Never claim a tool or real-world action succeeded unless a confirmed tool result says it succeeded.",
  "Never approve, decline, or bypass a human approval boundary.",
  "When information is insufficient, prefer wait, a bounded message, or delegation instead of inventing facts.",
] as const;

export const DEFAULT_AGENT_RUNTIME_MODE = "deterministic" as const;

export function createAgentRuntime(options: {
  provider?: AgentProvider;
  fallbackProvider?: AgentProvider;
} = {}) {
  const provider = options.provider ?? createDeterministicAgentProvider();
  const fallbackProvider = options.fallbackProvider ?? createDeterministicAgentProvider();

  return {
    mode: provider.kind,
    providerId: provider.id,
    async runTurn(world: AtlasWorldState, agentId: string): Promise<AgentTurnResult> {
      const context = buildAgentContext(world, agentId);
      const request = {
        context,
        responseSchema: decisionSchemaForContext(context),
        systemInstructions: [...SAFETY_INSTRUCTIONS, ...context.agent.instructions],
      };

      let primaryError: string | null = null;
      try {
        const rawDecision = await provider.decide(request);
        const validation = validateAgentDecision(rawDecision, context);
        if (validation.ok) {
          return {
            context,
            decision: validation.decision,
            providerId: provider.id,
            providerKind: provider.kind,
            providerModel: provider.model ?? null,
            fallbackUsed: false,
            validationError: null,
          };
        }
        primaryError = validation.error;
      } catch (error) {
        primaryError = error instanceof Error ? error.message : "Agent provider failed.";
      }

      const fallbackRaw = await fallbackProvider.decide(request);
      const fallbackValidation = validateAgentDecision(fallbackRaw, context);
      const safeDecision: AgentDecision = fallbackValidation.ok
        ? fallbackValidation.decision
        : { action: "wait", reason: "Agent provider output was invalid; Asympta kept the world unchanged." };

      return {
        context,
        decision: safeDecision,
        providerId: fallbackProvider.id,
        providerKind: fallbackProvider.kind,
        providerModel: fallbackProvider.model ?? null,
        fallbackUsed: true,
        validationError: primaryError,
      };
    },
  };
}

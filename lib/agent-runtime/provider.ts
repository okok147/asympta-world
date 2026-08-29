import type { AgentInferenceRequest, AgentProvider } from "./types.ts";

export function createDeterministicAgentProvider(): AgentProvider {
  return {
    id: "asympta-deterministic-demo",
    kind: "deterministic",
    async decide(request) {
      return {
        action: "wait",
        reason: request.context.activeTask
          ? "Deterministic demo mode is active; the canonical simulation engine owns task execution."
          : "Deterministic demo mode is active; there is no agent task requiring an AI turn.",
      };
    },
  };
}

export type AiInferenceTransport = (request: AgentInferenceRequest & { model?: string }) => Promise<unknown>;

export function createAiAgentProvider(options: {
  id?: string;
  model?: string;
  infer: AiInferenceTransport;
}): AgentProvider {
  return {
    id: options.id ?? "asympta-ai-provider",
    kind: "ai",
    model: options.model,
    decide(request) {
      return options.infer({ ...request, model: options.model });
    },
  };
}

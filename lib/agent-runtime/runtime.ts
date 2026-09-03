import type { AtlasWorldState } from "../atlas-simulation.ts";
import { buildAgentContext } from "./context.ts";
import {
  collectCommittedAgentEvents,
  createAgentEventCursor,
  markAgentEventsSeen,
  subscribedEventsForAgent,
} from "./events.ts";
import { createDeterministicAgentProvider } from "./provider.ts";
import { decisionSchemaForContext } from "./schema.ts";
import type {
  AgentDecision,
  AgentEventCursor,
  AgentEventCycleResult,
  AgentEventDelivery,
  AgentEventDispatchResult,
  AgentProposalCommitter,
  AgentProvider,
  AgentRuntimeEvent,
  AgentTurnResult,
} from "./types.ts";
import { validateAgentDecision } from "./validator.ts";

const SAFETY_INSTRUCTIONS = [
  "Return exactly one decision matching the supplied JSON Schema.",
  "You propose an action; you do not directly mutate Asympta world state.",
  "React only to the supplied committed trigger events and canonical context; do not poll or invent hidden world state.",
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

  const runTurn = async (
    world: AtlasWorldState,
    agentId: string,
    turnOptions: { triggerEvents?: readonly AgentRuntimeEvent[] } = {},
  ): Promise<AgentTurnResult> => {
    const context = buildAgentContext(world, agentId, turnOptions.triggerEvents ?? []);
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
  };

  const dispatchEvents = async (
    world: AtlasWorldState,
    cursor: AgentEventCursor = createAgentEventCursor(),
  ): Promise<AgentEventDispatchResult> => {
    let nextCursor = cursor;
    const deliveries: AgentEventDelivery[] = [];
    const observedEventIds = collectCommittedAgentEvents(world).map((event) => event.id);

    for (const agent of world.agents) {
      const triggerEvents = subscribedEventsForAgent(world, agent.id, nextCursor);
      if (triggerEvents.length === 0) continue;
      const turn = await runTurn(world, agent.id, { triggerEvents });
      const eventIds = triggerEvents.map((event) => event.id);
      nextCursor = markAgentEventsSeen(nextCursor, agent.id, eventIds);
      deliveries.push({ agentId: agent.id, eventIds, turn });
    }

    return { cursor: nextCursor, deliveries, observedEventIds };
  };

  const runEventDrivenCycle = async (
    initialWorld: AtlasWorldState,
    cycleOptions: {
      cursor?: AgentEventCursor;
      commit: AgentProposalCommitter;
      maxRounds?: number;
    },
  ): Promise<AgentEventCycleResult> => {
    let world = initialWorld;
    let cursor = cycleOptions.cursor ?? createAgentEventCursor();
    const deliveries: AgentEventDelivery[] = [];
    let rounds = 0;
    const maxRounds = Math.max(1, Math.min(32, cycleOptions.maxRounds ?? 12));

    for (let round = 0; round < maxRounds; round += 1) {
      const beforeEventIds = new Set(collectCommittedAgentEvents(world).map((event) => event.id));
      const dispatch = await dispatchEvents(world, cursor);
      cursor = dispatch.cursor;
      if (dispatch.deliveries.length === 0) break;

      rounds += 1;
      deliveries.push(...dispatch.deliveries);
      let committedNewEvent = false;

      for (const delivery of dispatch.deliveries) {
        if (delivery.turn.decision.action === "wait") continue;
        world = await cycleOptions.commit({ world, delivery });
        if (collectCommittedAgentEvents(world).some((event) => !beforeEventIds.has(event.id))) {
          committedNewEvent = true;
        }
      }

      if (!committedNewEvent) break;
    }

    return { world, cursor, rounds, deliveries };
  };

  return {
    mode: provider.kind,
    providerId: provider.id,
    runTurn,
    dispatchEvents,
    runEventDrivenCycle,
    createEventCursor: createAgentEventCursor,
  };
}

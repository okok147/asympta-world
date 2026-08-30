import {
  appendAsymptaEvidence,
  appendAsymptaEvent,
  createAsymptaActivity,
  finishAsymptaActivity,
  type AsymptaActivity,
  type AsymptaActivityEvent,
} from "./asympta-activity.ts";
import {
  getA2ATask,
  resolveA2AAgentCard,
  sendA2AMessage,
  type A2AAgentCard,
  type A2APeer,
} from "./protocols/a2a-client.ts";
import { callMcpTool, listMcpTools, type FetchLike, type McpPeer, type McpTool } from "./protocols/mcp-client.ts";

export type AsymptaProtocolConfig = {
  mcp: McpPeer[];
  a2a: A2APeer[];
};

export type AsymptaRuntimeOptions = {
  locale?: string;
  principalId?: string;
  fetcher?: FetchLike;
  signal?: AbortSignal;
  onActivity?: (activity: AsymptaActivity, event: AsymptaActivityEvent) => void;
};

type DiscoveredMcp = { peer: McpPeer; tools: McpTool[] };
type DiscoveredA2A = { peer: A2APeer; card: A2AAgentCard };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function tokens(value: string) {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/gu).filter((item) => item.length > 1));
}

function score(intent: string, candidate: string) {
  const intentTokens = tokens(intent);
  const candidateTokens = tokens(candidate);
  let value = 0;
  for (const token of intentTokens) if (candidateTokens.has(token)) value += token.length > 5 ? 2 : 1;
  return value;
}

function skillText(card: A2AAgentCard) {
  const skills = Array.isArray(card.skills) ? card.skills : [];
  return [
    card.name,
    card.description,
    ...skills.flatMap((skill) => [
      skill.name,
      skill.description,
      Array.isArray(skill.tags) ? skill.tags.join(" ") : "",
      Array.isArray(skill.examples) ? skill.examples.join(" ") : "",
    ]),
  ].filter((value): value is string => typeof value === "string").join(" ");
}

function toolText(tool: McpTool) {
  return [tool.name, tool.title, tool.description].filter((value): value is string => typeof value === "string").join(" ");
}

function actorForTool(toolName: string) {
  const name = toolName.toLowerCase();
  if (/pay|bill|invoice|finance|charge|refund/.test(name)) return "agent-finance";
  if (/deliver|ship|route|courier|logistic|dispatch/.test(name)) return "agent-logistics";
  if (/stock|inventory|supply|warehouse|reserve/.test(name)) return "agent-supplier";
  if (/verify|quality|receipt|audit|check/.test(name)) return "agent-quality";
  return "agent-operations";
}

function schemaProperties(tool: McpTool) {
  const schema = record(tool.inputSchema);
  return schema ? record(schema.properties) ?? {} : {};
}

export function buildMcpArguments(intent: string, tool: McpTool) {
  const schema = record(tool.inputSchema);
  if (!schema) return { arguments: {}, missing: [] as string[] };
  const properties = schemaProperties(tool);
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
  const result: Record<string, unknown> = {};
  const missing: string[] = [];
  const semanticStringNames = new Set(["q", "query", "text", "message", "input", "intent", "request", "prompt", "description"]);

  for (const field of required) {
    const fieldSchema = record(properties[field]);
    const type = typeof fieldSchema?.type === "string" ? fieldSchema.type : undefined;
    const enumValues = Array.isArray(fieldSchema?.enum) ? fieldSchema.enum : [];

    if (enumValues.length === 1) {
      result[field] = enumValues[0];
      continue;
    }
    if (type === "string" && (semanticStringNames.has(field.toLowerCase()) || required.length === 1)) {
      result[field] = intent;
      continue;
    }
    missing.push(field);
  }

  return { arguments: result, missing };
}

function a2aTaskState(result: unknown) {
  const root = record(result);
  const status = record(root?.status);
  return String(status?.state ?? root?.state ?? "").toLowerCase();
}

function a2aTaskId(result: unknown) {
  const root = record(result);
  return typeof root?.id === "string" ? root.id : typeof root?.taskId === "string" ? root.taskId : null;
}

function isA2ATerminal(state: string) {
  return /completed|failed|rejected|cancelled|canceled/.test(state);
}

function isA2ASuccess(state: string) {
  return /completed|succeeded|success/.test(state);
}

function isA2AInputRequired(state: string) {
  return /input.*required|auth.*required|waiting.*input/.test(state);
}

function mcpInputRequired(result: unknown) {
  const root = record(result);
  return root?.resultType === "input_required" ? root : null;
}

function mcpIsError(result: unknown) {
  const root = record(result);
  return root?.isError === true || root?.resultType === "error";
}

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = globalThis.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export async function runAsymptaIntent(
  intention: string,
  config: AsymptaProtocolConfig,
  options: AsymptaRuntimeOptions = {},
): Promise<AsymptaActivity> {
  let activity = createAsymptaActivity({
    intent: intention,
    locale: options.locale,
    principalId: options.principalId,
  });

  const emit = (
    event: Omit<AsymptaActivityEvent, "id" | "at">,
  ) => {
    activity = appendAsymptaEvent(activity, event);
    const last = activity.events.at(-1);
    if (last) options.onActivity?.(activity, last);
  };

  emit({
    status: "interpreting",
    protocol: "asympta",
    actorId: "agent-user",
    summary: intention,
    data: { representation: "asympta-ir/0.1" },
  });

  if (!config.a2a.length && !config.mcp.length) {
    emit({
      status: "blocked",
      protocol: "asympta",
      actorId: "agent-user",
      summary: "No live service connection is available for this intention yet.",
      data: { reason: "no_protocol_peers" },
    });
    return activity;
  }

  emit({
    status: "discovering",
    protocol: "asympta",
    actorId: "agent-market",
    summary: "Finding independent agents and tools that can help.",
  });

  const a2aResults = await Promise.allSettled(config.a2a.map(async (peer): Promise<DiscoveredA2A> => ({
    peer,
    card: await resolveA2AAgentCard(peer, { fetcher: options.fetcher, signal: options.signal }),
  })));
  const mcpResults = await Promise.allSettled(config.mcp.map(async (peer): Promise<DiscoveredMcp> => ({
    peer,
    tools: await listMcpTools(peer, { fetcher: options.fetcher, signal: options.signal }),
  })));

  const a2a = a2aResults.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  const mcp = mcpResults.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);

  for (const item of a2a) {
    activity = appendAsymptaEvidence(activity, {
      protocol: "a2a",
      source: item.peer.name ?? item.peer.url,
      kind: "agent-card",
      value: item.card,
    });
  }
  for (const item of mcp) {
    activity = appendAsymptaEvidence(activity, {
      protocol: "mcp",
      source: item.peer.name ?? item.peer.url,
      kind: "tool-list",
      value: item.tools,
    });
  }

  const bestA2A = a2a
    .map((item) => ({ item, score: score(intention, skillText(item.card)) }))
    .sort((a, b) => b.score - a.score)[0];
  const bestMcp = mcp
    .flatMap((item) => item.tools.map((tool) => ({ item, tool, score: score(intention, toolText(tool)) })))
    .sort((a, b) => b.score - a.score)[0];

  const shouldDelegateToAgent = Boolean(bestA2A && (!bestMcp || bestA2A.score >= bestMcp.score));

  if (shouldDelegateToAgent && bestA2A) {
    const peer = bestA2A.item.peer;
    emit({
      status: "coordinating",
      protocol: "a2a",
      actorId: "agent-business",
      peer: peer.name ?? peer.url,
      summary: `Asking ${bestA2A.item.card.name ?? "an independent agent"} to help with the intention.`,
    });

    try {
      let { result } = await sendA2AMessage(peer, intention, {
        card: bestA2A.item.card,
        fetcher: options.fetcher,
        signal: options.signal,
        metadata: { asymptaActivityId: activity.id },
      });
      activity = appendAsymptaEvidence(activity, {
        protocol: "a2a",
        source: peer.name ?? peer.url,
        kind: "protocol-response",
        value: result,
      });

      let state = a2aTaskState(result);
      const taskId = a2aTaskId(result);
      if (isA2AInputRequired(state)) {
        emit({ status: "waiting_input", protocol: "a2a", actorId: "agent-user", peer: peer.name ?? peer.url, summary: "The service needs one more piece of information from you.", data: { taskId, result } });
        return activity;
      }

      for (let attempt = 0; taskId && state && !isA2ATerminal(state) && attempt < 6; attempt += 1) {
        await delay(650, options.signal);
        result = await getA2ATask(peer, taskId, { card: bestA2A.item.card, fetcher: options.fetcher, signal: options.signal, historyLength: 6 });
        state = a2aTaskState(result);
        emit({ status: "coordinating", protocol: "a2a", actorId: "agent-business", peer: peer.name ?? peer.url, summary: "The independent agent is working on the request.", data: { taskId, state } });
        if (isA2AInputRequired(state)) {
          emit({ status: "waiting_input", protocol: "a2a", actorId: "agent-user", peer: peer.name ?? peer.url, summary: "The service needs one more piece of information from you.", data: { taskId, result } });
          return activity;
        }
      }

      emit({ status: "verifying", protocol: "asympta", actorId: "agent-quality", summary: "Checking the returned task state and evidence." });
      const verified = state ? isA2ASuccess(state) : Boolean(result);
      activity = finishAsymptaActivity(activity, {
        verified,
        verification: state ? "task-completed" : "protocol-response",
        summary: verified ? "The connected agent completed the protocol task." : "The connected agent did not return a completed result.",
        value: result,
      });
      emit({
        status: activity.status,
        protocol: "asympta",
        actorId: verified ? "agent-quality" : "agent-support",
        summary: activity.outcome?.summary ?? "Activity finished.",
      });
      return activity;
    } catch (error) {
      emit({ status: "failed", protocol: "a2a", actorId: "agent-support", peer: peer.name ?? peer.url, summary: error instanceof Error ? error.message : String(error) });
      return activity;
    }
  }

  if (bestMcp) {
    const peer = bestMcp.item.peer;
    const prepared = buildMcpArguments(intention, bestMcp.tool);
    if (prepared.missing.length) {
      emit({
        status: "waiting_input",
        protocol: "mcp",
        actorId: "agent-user",
        peer: peer.name ?? peer.url,
        summary: "A connected tool needs a little more information before it can act.",
        data: { tool: bestMcp.tool.name, missingFields: prepared.missing },
      });
      return activity;
    }

    emit({
      status: "executing",
      protocol: "mcp",
      actorId: actorForTool(bestMcp.tool.name),
      peer: peer.name ?? peer.url,
      summary: `Using ${bestMcp.tool.title ?? bestMcp.tool.name}.`,
      data: { tool: bestMcp.tool.name },
    });

    try {
      const result = await callMcpTool(peer, bestMcp.tool.name, prepared.arguments, {
        fetcher: options.fetcher,
        signal: options.signal,
      });
      activity = appendAsymptaEvidence(activity, {
        protocol: "mcp",
        source: peer.name ?? peer.url,
        kind: "protocol-response",
        value: result,
      });

      const required = mcpInputRequired(result);
      if (required) {
        emit({
          status: "waiting_input",
          protocol: "mcp",
          actorId: "agent-user",
          peer: peer.name ?? peer.url,
          summary: "The service needs your confirmation or another detail before continuing.",
          data: required,
        });
        return activity;
      }

      emit({ status: "verifying", protocol: "asympta", actorId: "agent-quality", summary: "Checking the tool result before treating the action as complete." });
      const verified = !mcpIsError(result);
      activity = finishAsymptaActivity(activity, {
        verified,
        verification: "tool-result",
        summary: verified ? "The connected tool returned a successful result." : "The connected tool reported a failure.",
        value: result,
      });
      emit({ status: activity.status, protocol: "asympta", actorId: verified ? "agent-quality" : "agent-support", summary: activity.outcome?.summary ?? "Activity finished." });
      return activity;
    } catch (error) {
      emit({ status: "failed", protocol: "mcp", actorId: "agent-support", peer: peer.name ?? peer.url, summary: error instanceof Error ? error.message : String(error) });
      return activity;
    }
  }

  emit({
    status: "blocked",
    protocol: "asympta",
    actorId: "agent-user",
    summary: "The connected services did not expose a usable capability for this intention.",
    data: {
      a2aDiscoveryFailures: a2aResults.filter((item) => item.status === "rejected").length,
      mcpDiscoveryFailures: mcpResults.filter((item) => item.status === "rejected").length,
    },
  });
  return activity;
}

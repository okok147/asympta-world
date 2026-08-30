import type { FetchLike } from "./mcp-client.ts";

export type A2APeer = {
  url: string;
  name?: string;
  headers?: Record<string, string>;
};

export type A2AAgentInterface = {
  url?: string;
  protocolBinding?: string;
  protocolVersion?: string;
  tenant?: string;
  [key: string]: unknown;
};

export type A2AAgentCard = {
  name?: string;
  description?: string;
  version?: string;
  url?: string;
  skills?: Array<Record<string, unknown>>;
  supportedInterfaces?: A2AAgentInterface[];
  preferredTransport?: string;
  additionalInterfaces?: A2AAgentInterface[];
  capabilities?: Record<string, unknown>;
  [key: string]: unknown;
};

export type A2AOptions = {
  fetcher?: FetchLike;
  signal?: AbortSignal;
  contextId?: string;
  metadata?: Record<string, unknown>;
};

type JsonRpcEnvelope = {
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

function uid() {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function cardUrl(input: string) {
  const url = new URL(input);
  if (url.pathname.endsWith(".json")) return url.toString();
  return new URL("/.well-known/agent-card.json", url.origin).toString();
}

export async function resolveA2AAgentCard(peer: A2APeer, options: A2AOptions = {}): Promise<A2AAgentCard> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(cardUrl(peer.url), {
    method: "GET",
    headers: { Accept: "application/json, application/a2a+json", ...(peer.headers ?? {}) },
    signal: options.signal,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`A2A Agent Card HTTP ${response.status}: ${text.slice(0, 240)}`);
  const card = JSON.parse(text || "{}") as A2AAgentCard;
  if (!card || typeof card !== "object") throw new Error("A2A Agent Card is invalid.");
  return card;
}

export function selectA2AInterface(card: A2AAgentCard, peer: A2APeer): A2AAgentInterface {
  const supported = Array.isArray(card.supportedInterfaces) ? card.supportedInterfaces : [];
  const jsonRpc = supported.find((item) => String(item.protocolBinding ?? "").toLowerCase().includes("jsonrpc"));
  if (jsonRpc?.url) return jsonRpc;

  const legacy = Array.isArray(card.additionalInterfaces)
    ? card.additionalInterfaces.find((item) => item.url)
    : undefined;
  if (legacy?.url) return legacy;
  if (typeof card.url === "string") return { url: card.url, protocolBinding: card.preferredTransport ?? "JSONRPC", protocolVersion: "0.3" };
  return { url: peer.url, protocolBinding: "JSONRPC", protocolVersion: "1.0" };
}

async function postJsonRpc(
  endpoint: string,
  method: string,
  params: Record<string, unknown>,
  peer: A2APeer,
  options: A2AOptions,
): Promise<JsonRpcEnvelope> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, application/a2a+json",
      ...(peer.headers ?? {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: uid(), method, params }),
    signal: options.signal,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`A2A HTTP ${response.status}: ${text.slice(0, 240)}`);
  return JSON.parse(text || "{}") as JsonRpcEnvelope;
}

function unwrapResult(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const value = result as Record<string, unknown>;
  return value.task ?? value.message ?? result;
}

function methodNotFound(envelope: JsonRpcEnvelope) {
  return envelope.error?.code === -32601 || /method/i.test(envelope.error?.message ?? "") && /not found|unknown/i.test(envelope.error?.message ?? "");
}

export async function sendA2AMessage(
  peer: A2APeer,
  text: string,
  options: A2AOptions & { card?: A2AAgentCard } = {},
) {
  const card = options.card ?? await resolveA2AAgentCard(peer, options);
  const agentInterface = selectA2AInterface(card, peer);
  const endpoint = agentInterface.url ?? peer.url;
  const messageId = uid();
  const metadata = {
    ...(options.metadata ?? {}),
    asympta: { source: "asympta-world", intent: text },
  };

  let envelope = await postJsonRpc(endpoint, "SendMessage", {
    ...(agentInterface.tenant ? { tenant: agentInterface.tenant } : {}),
    message: {
      messageId,
      role: "ROLE_USER",
      parts: [{ text }],
      ...(options.contextId ? { contextId: options.contextId } : {}),
    },
    metadata,
  }, peer, options);

  if (methodNotFound(envelope)) {
    envelope = await postJsonRpc(endpoint, "message/send", {
      message: {
        messageId,
        role: "user",
        parts: [{ kind: "text", text }],
        ...(options.contextId ? { contextId: options.contextId } : {}),
      },
      metadata,
    }, peer, options);
  }

  if (envelope.error) throw new Error(`A2A send failed (${envelope.error.code ?? "error"}): ${envelope.error.message ?? "Unknown error"}`);
  return { card, interface: agentInterface, result: unwrapResult(envelope.result) };
}

export async function getA2ATask(
  peer: A2APeer,
  taskId: string,
  options: A2AOptions & { card?: A2AAgentCard; historyLength?: number } = {},
) {
  const card = options.card ?? await resolveA2AAgentCard(peer, options);
  const agentInterface = selectA2AInterface(card, peer);
  const endpoint = agentInterface.url ?? peer.url;

  let envelope = await postJsonRpc(endpoint, "GetTask", {
    ...(agentInterface.tenant ? { tenant: agentInterface.tenant } : {}),
    id: taskId,
    ...(typeof options.historyLength === "number" ? { historyLength: options.historyLength } : {}),
  }, peer, options);

  if (methodNotFound(envelope)) {
    envelope = await postJsonRpc(endpoint, "tasks/get", {
      id: taskId,
      ...(typeof options.historyLength === "number" ? { historyLength: options.historyLength } : {}),
    }, peer, options);
  }

  if (envelope.error) throw new Error(`A2A get task failed (${envelope.error.code ?? "error"}): ${envelope.error.message ?? "Unknown error"}`);
  return unwrapResult(envelope.result);
}

export const ASYMPTA_MCP_PROTOCOL_VERSION = "2026-07-28";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
};

export type McpPeer = {
  url: string;
  name?: string;
  headers?: Record<string, string>;
};

export type McpCallOptions = {
  fetcher?: FetchLike;
  clientName?: string;
  clientVersion?: string;
  signal?: AbortSignal;
};

type JsonRpcEnvelope = {
  jsonrpc?: string;
  id?: string | number | null;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

function rpcId() {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clientMeta(options: McpCallOptions) {
  return {
    "io.modelcontextprotocol/clientInfo": {
      name: options.clientName ?? "asympta-world",
      version: options.clientVersion ?? "0.1.0",
    },
    "io.modelcontextprotocol/clientCapabilities": {
      extensions: {},
    },
  };
}

function protocolHeaders(peer: McpPeer, method: string, name?: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": ASYMPTA_MCP_PROTOCOL_VERSION,
    "Mcp-Method": method,
    ...(name ? { "Mcp-Name": name } : {}),
    ...(peer.headers ?? {}),
  };
}

async function parseProtocolResponse(response: Response): Promise<JsonRpcEnvelope> {
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${text.slice(0, 240)}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    if (!dataLines.length) throw new Error("MCP returned an empty event stream.");
    return JSON.parse(dataLines.at(-1) ?? "{}") as JsonRpcEnvelope;
  }

  return JSON.parse(text || "{}") as JsonRpcEnvelope;
}

async function callMcpRpc(
  peer: McpPeer,
  method: string,
  params: Record<string, unknown>,
  options: McpCallOptions = {},
  name?: string,
) {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const body = {
    jsonrpc: "2.0",
    id: rpcId(),
    method,
    params: {
      ...params,
      _meta: {
        ...(params._meta && typeof params._meta === "object" && !Array.isArray(params._meta)
          ? params._meta as Record<string, unknown>
          : {}),
        ...clientMeta(options),
      },
    },
  };

  const response = await fetcher(peer.url, {
    method: "POST",
    headers: protocolHeaders(peer, method, name),
    body: JSON.stringify(body),
    signal: options.signal,
  });
  const envelope = await parseProtocolResponse(response);
  if (envelope.error) {
    throw new Error(`MCP ${method} failed (${envelope.error.code ?? "error"}): ${envelope.error.message ?? "Unknown error"}`);
  }
  return envelope.result;
}

export async function discoverMcpServer(peer: McpPeer, options: McpCallOptions = {}) {
  return callMcpRpc(peer, "server/discover", {}, options);
}

export async function listMcpTools(peer: McpPeer, options: McpCallOptions = {}): Promise<McpTool[]> {
  const result = await callMcpRpc(peer, "tools/list", {}, options);
  if (!result || typeof result !== "object") return [];
  const tools = (result as { tools?: unknown }).tools;
  return Array.isArray(tools) ? tools.filter((tool): tool is McpTool => Boolean(tool && typeof tool === "object" && !Array.isArray(tool) && typeof (tool as McpTool).name === "string")) : [];
}

export async function callMcpTool(
  peer: McpPeer,
  toolName: string,
  args: Record<string, unknown>,
  options: McpCallOptions = {},
) {
  return callMcpRpc(peer, "tools/call", { name: toolName, arguments: args }, options, toolName);
}

export type MessageParticipantKind = "human" | "agent" | "business" | "organization" | "system";
export type StructuredMessageKind = "request" | "offer" | "question" | "answer" | "update" | "confirmation" | "warning" | "handoff" | "plain";
export type StructuredMessageSource = "human" | "workflow" | "agent-runtime" | "webmcp" | "business-system";
export type StructuredMessageStatus = "sent" | "delivered" | "read" | "acted_on";

export type MessageParticipant = {
  id: string;
  kind: MessageParticipantKind;
  label?: string;
};

export type StructuredMessageSemantics = {
  intent?: string;
  action?: string;
  entities?: string[];
  data: Record<string, unknown>;
};

export type StructuredAgentMessage = {
  id: string;
  externalId?: string;
  threadId: string;
  from: MessageParticipant;
  to: MessageParticipant;
  kind: StructuredMessageKind;
  subject?: string;
  body: string;
  semantics: StructuredMessageSemantics;
  source: StructuredMessageSource;
  status: StructuredMessageStatus;
  replyToId?: string;
  causalEventIds: string[];
  createdAt: number;
  deliveredAt?: number;
  readAt?: number;
  actedOnAt?: number;
  worldContext?: {
    workflow?: string | null;
    worldRevision?: number | null;
  };
};

export type AgentMessageState = {
  schema: "asympta-agent-messages";
  version: 1;
  revision: number;
  messages: StructuredAgentMessage[];
};

export type SubmitStructuredMessageInput = {
  body: string;
  fromId?: string;
  toId?: string;
  fromKind?: MessageParticipantKind;
  toKind?: MessageParticipantKind;
  kind?: StructuredMessageKind;
  subject?: string;
  threadId?: string;
  replyToId?: string;
  source?: StructuredMessageSource;
  intent?: string;
  action?: string;
  entities?: string[];
  data?: Record<string, unknown>;
  causalEventIds?: string[];
  externalId?: string;
};

export type MessageWorldContext = {
  workflow?: string | null;
  worldRevision?: number | null;
};

const STORAGE_KEY = "asympta-world:agent-messages-v1";
const MESSAGE_LIMIT = 240;
let browserCache: AgentMessageState | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function participantKind(id: string, explicit?: MessageParticipantKind): MessageParticipantKind {
  if (explicit) return explicit;
  if (id === "human" || id.startsWith("human-")) return "human";
  if (id.startsWith("agent-")) return "agent";
  if (id.startsWith("business-") || id.startsWith("merchant-")) return "business";
  if (id.startsWith("org-") || id.startsWith("company-")) return "organization";
  return "system";
}

function safeText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function safeStringArray(value: unknown, maxItems = 16) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item, 120)).filter(Boolean).slice(0, maxItems);
}

function threadFor(fromId: string, toId: string, context?: MessageWorldContext) {
  const participants = [fromId, toId].sort().join("--");
  return `thread:${context?.workflow ?? "world"}:${participants}`;
}

export function createAgentMessageState(): AgentMessageState {
  return { schema: "asympta-agent-messages", version: 1, revision: 0, messages: [] };
}

export function restoreAgentMessageState(serialized: string): AgentMessageState | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<AgentMessageState>;
    if (parsed.schema !== "asympta-agent-messages" || parsed.version !== 1 || !Array.isArray(parsed.messages)) return null;
    const messages = parsed.messages.filter((message): message is StructuredAgentMessage => {
      if (!message || typeof message !== "object") return false;
      return typeof message.id === "string"
        && typeof message.threadId === "string"
        && typeof message.body === "string"
        && Boolean(message.from?.id)
        && Boolean(message.to?.id);
    }).slice(-MESSAGE_LIMIT);
    return {
      schema: "asympta-agent-messages",
      version: 1,
      revision: Number.isFinite(parsed.revision) ? Number(parsed.revision) : messages.length,
      messages: clone(messages),
    };
  } catch {
    return null;
  }
}

export function serializeAgentMessageState(state: AgentMessageState) {
  return JSON.stringify({ ...state, messages: state.messages.slice(-MESSAGE_LIMIT) });
}

export function submitStructuredMessage(
  current: AgentMessageState,
  input: SubmitStructuredMessageInput,
  context: MessageWorldContext = {},
  now = Date.now(),
): { state: AgentMessageState; message: StructuredAgentMessage } {
  const body = safeText(input.body, 800);
  if (!body) throw new Error("Message body is required.");

  const state = clone(current);
  const fromId = safeText(input.fromId ?? "human", 100) || "human";
  const toId = safeText(input.toId ?? "agent-user", 100) || "agent-user";
  const fromKind = participantKind(fromId, input.fromKind);
  const toKind = participantKind(toId, input.toKind);
  const nextRevision = state.revision + 1;
  const createdAt = Number.isFinite(now) ? now : Date.now();
  const id = `message-${Math.floor(createdAt).toString(36)}-${nextRevision.toString(36)}`;
  const threadId = safeText(input.threadId, 180) || threadFor(fromId, toId, context);
  const message: StructuredAgentMessage = {
    id,
    externalId: safeText(input.externalId, 180) || undefined,
    threadId,
    from: { id: fromId, kind: fromKind },
    to: { id: toId, kind: toKind },
    kind: input.kind ?? (fromKind === "human" ? "request" : "plain"),
    subject: safeText(input.subject, 180) || undefined,
    body,
    semantics: {
      intent: safeText(input.intent, 120) || undefined,
      action: safeText(input.action, 120) || undefined,
      entities: safeStringArray(input.entities),
      data: input.data && typeof input.data === "object" && !Array.isArray(input.data) ? clone(input.data) : {},
    },
    source: input.source ?? (fromKind === "human" ? "human" : "agent-runtime"),
    status: "delivered",
    replyToId: safeText(input.replyToId, 180) || undefined,
    causalEventIds: safeStringArray(input.causalEventIds, 24),
    createdAt,
    deliveredAt: createdAt,
    worldContext: {
      workflow: context.workflow ?? null,
      worldRevision: Number.isFinite(context.worldRevision) ? Number(context.worldRevision) : null,
    },
  };
  state.revision = nextRevision;
  state.messages.push(message);
  if (state.messages.length > MESSAGE_LIMIT) state.messages.splice(0, state.messages.length - MESSAGE_LIMIT);
  return { state, message: clone(message) };
}

export function ingestWorkflowMessages(
  current: AgentMessageState,
  messages: Array<{ id?: unknown; from?: unknown; to?: unknown; text?: unknown }>,
  context: MessageWorldContext = {},
  now = Date.now(),
) {
  let state = clone(current);
  const knownExternalIds = new Set(state.messages.map((message) => message.externalId).filter(Boolean));
  for (const raw of messages) {
    const externalId = safeText(raw.id, 180);
    const body = safeText(raw.text, 800);
    const fromId = safeText(raw.from, 100);
    const toId = safeText(raw.to, 100);
    if (!body || !fromId || !toId) continue;
    if (externalId && knownExternalIds.has(externalId)) continue;
    const submitted = submitStructuredMessage(state, {
      body,
      fromId,
      toId,
      kind: "handoff",
      source: "workflow",
      intent: "coordinate",
      data: { transport: "atlas-message" },
      externalId: externalId || undefined,
    }, context, now);
    state = submitted.state;
    if (externalId) knownExternalIds.add(externalId);
  }
  return state;
}

export function listStructuredMessages(
  state: AgentMessageState,
  filter: { participantId?: string; threadId?: string; limit?: number } = {},
) {
  const participantId = safeText(filter.participantId, 100);
  const threadId = safeText(filter.threadId, 180);
  const limit = Math.max(1, Math.min(100, Math.floor(filter.limit ?? 30)));
  return clone(state.messages.filter((message) => {
    if (participantId && message.from.id !== participantId && message.to.id !== participantId) return false;
    if (threadId && message.threadId !== threadId) return false;
    return true;
  }).slice(-limit));
}

export function getBrowserAgentMessageState() {
  if (browserCache) return clone(browserCache);
  if (typeof localStorage === "undefined") {
    browserCache = createAgentMessageState();
    return clone(browserCache);
  }
  try {
    browserCache = restoreAgentMessageState(localStorage.getItem(STORAGE_KEY) ?? "") ?? createAgentMessageState();
  } catch {
    browserCache = createAgentMessageState();
  }
  return clone(browserCache);
}

export function setBrowserAgentMessageState(state: AgentMessageState) {
  browserCache = clone(state);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, serializeAgentMessageState(browserCache)); } catch { /* best effort */ }
  }
  return clone(browserCache);
}

export function submitBrowserStructuredMessage(input: SubmitStructuredMessageInput, context: MessageWorldContext = {}) {
  const submitted = submitStructuredMessage(getBrowserAgentMessageState(), input, context);
  setBrowserAgentMessageState(submitted.state);
  return submitted.message;
}

export function syncBrowserWorkflowMessages(
  messages: Array<{ id?: unknown; from?: unknown; to?: unknown; text?: unknown }>,
  context: MessageWorldContext = {},
) {
  const next = ingestWorkflowMessages(getBrowserAgentMessageState(), messages, context);
  setBrowserAgentMessageState(next);
  return next;
}

export function listBrowserStructuredMessages(filter: { participantId?: string; threadId?: string; limit?: number } = {}) {
  return listStructuredMessages(getBrowserAgentMessageState(), filter);
}

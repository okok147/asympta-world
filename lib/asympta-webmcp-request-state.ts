export type AsymptaWebMcpRequestStatus =
  | "pending_human_review"
  | "running"
  | "awaiting_confirmation"
  | "needs_clarification"
  | "completed"
  | "failed"
  | "declined";

export type AsymptaWebMcpRequest = {
  requestId: string;
  intent: string;
  status: AsymptaWebMcpRequestStatus;
  source: "webmcp";
  createdAt: number;
  updatedAt: number;
  resultSummary?: string;
};

export type AsymptaWebMcpRequestState = {
  schema: "asympta-webmcp-requests";
  version: 1;
  revision: number;
  requests: AsymptaWebMcpRequest[];
};

export const ASYMPTA_WEBMCP_REQUEST_STORAGE_KEY = "asympta-world:webmcp-requests-v1";
export const ASYMPTA_WEBMCP_REQUEST_EVENT = "asympta:webmcp-request";
export const ASYMPTA_WEBMCP_REQUEST_LIMIT = 40;

const REQUEST_ID_PATTERN = /^request-[a-z0-9-]{8,100}$/;
const STATUS_VALUES: AsymptaWebMcpRequestStatus[] = [
  "pending_human_review",
  "running",
  "awaiting_confirmation",
  "needs_clarification",
  "completed",
  "failed",
  "declined",
];
const CREDENTIAL_PATTERNS = [
  /\bsk-(?:or-v1-)?[a-z0-9_-]{16,}\b/i,
  /\b(?:gh[pousr]_|github_pat_)[a-z0-9_]{16,}\b/i,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bAIza[a-z0-9_-]{30,}\b/i,
  /\beyJ[a-z0-9_-]+\.eyJ[a-z0-9_-]+\.[a-z0-9_-]+\b/i,
  /\bbearer\s+[a-z0-9._~+/=-]{12,}\b/i,
  /\b(?:authorization|api[-_ ]?key|bearer|password|secret|token)\s*(?::|=|\bis\b)\s*["']?[a-z0-9._~+/=-]{12,}/i,
];
let browserCache: AsymptaWebMcpRequestState | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function containsCredential(value: string) {
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(value));
}

function safePersistedText(value: unknown, maxLength: number) {
  const text = safeText(value, maxLength);
  return text && !containsCredential(text) ? text : null;
}

function safeRequestId(value: unknown) {
  const requestId = safeText(value, 108).toLowerCase();
  return REQUEST_ID_PATTERN.test(requestId) ? requestId : null;
}

function isStatus(value: unknown): value is AsymptaWebMcpRequestStatus {
  return STATUS_VALUES.includes(value as AsymptaWebMcpRequestStatus);
}

function normalizeRequest(value: unknown): AsymptaWebMcpRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<AsymptaWebMcpRequest>;
  const requestId = safeRequestId(candidate.requestId);
  const intent = safePersistedText(candidate.intent, 600);
  if (!requestId || !intent || !isStatus(candidate.status) || candidate.source !== "webmcp") return null;
  const createdAt = Number(candidate.createdAt);
  const updatedAt = Number(candidate.updatedAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null;
  const resultSummary = safePersistedText(candidate.resultSummary, 1_000);
  return {
    requestId,
    intent,
    status: candidate.status,
    source: "webmcp",
    createdAt,
    updatedAt,
    ...(resultSummary ? { resultSummary } : {}),
  };
}

function normalizeRequests(values: readonly unknown[]) {
  const seen = new Set<string>();
  return values
    .map(normalizeRequest)
    .filter((request): request is AsymptaWebMcpRequest => request !== null)
    .reverse()
    .filter((request) => {
      if (seen.has(request.requestId)) return false;
      seen.add(request.requestId);
      return true;
    })
    .reverse()
    .slice(-ASYMPTA_WEBMCP_REQUEST_LIMIT);
}

function newRequestId(now: number, revision: number) {
  const random = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2);
  return `request-${Math.floor(now).toString(36)}-${revision.toString(36)}-${random.slice(0, 16)}`;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function publishBrowserRequest(request: AsymptaWebMcpRequest) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AsymptaWebMcpRequest>(ASYMPTA_WEBMCP_REQUEST_EVENT, {
    detail: clone(request),
  }));
}

export function createWebMcpRequestState(): AsymptaWebMcpRequestState {
  return { schema: "asympta-webmcp-requests", version: 1, revision: 0, requests: [] };
}

export function restoreWebMcpRequestState(serialized: string): AsymptaWebMcpRequestState | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<AsymptaWebMcpRequestState>;
    if (parsed.schema !== "asympta-webmcp-requests" || parsed.version !== 1 || !Array.isArray(parsed.requests)) return null;
    const requests = normalizeRequests(parsed.requests);
    return {
      schema: "asympta-webmcp-requests",
      version: 1,
      revision: Number.isFinite(parsed.revision) ? Math.max(0, Number(parsed.revision)) : requests.length,
      requests,
    };
  } catch {
    return null;
  }
}

export function serializeWebMcpRequestState(state: AsymptaWebMcpRequestState) {
  return JSON.stringify({ ...state, requests: normalizeRequests(state.requests) });
}

export function submitWebMcpRequest(
  current: AsymptaWebMcpRequestState,
  rawIntent: unknown,
  now = Date.now(),
): { state: AsymptaWebMcpRequestState; request: AsymptaWebMcpRequest } {
  const unboundedIntent = String(rawIntent ?? "").replace(/\s+/g, " ").trim();
  if (unboundedIntent.length > 600) throw new Error("An intention can contain at most 600 characters.");
  const intent = safeText(unboundedIntent, 600);
  if (!intent) throw new Error("An intention is required.");
  if (containsCredential(intent)) throw new Error("Remove passwords, API keys and other credentials before submitting this request.");

  const state: AsymptaWebMcpRequestState = {
    ...clone(current),
    requests: normalizeRequests(current.requests),
  };
  const revision = Math.max(0, Math.floor(state.revision)) + 1;
  const timestamp = Number.isFinite(now) ? now : Date.now();
  const request: AsymptaWebMcpRequest = {
    requestId: newRequestId(timestamp, revision),
    intent,
    status: "pending_human_review",
    source: "webmcp",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.revision = revision;
  state.requests.push(request);
  if (state.requests.length > ASYMPTA_WEBMCP_REQUEST_LIMIT) {
    state.requests.splice(0, state.requests.length - ASYMPTA_WEBMCP_REQUEST_LIMIT);
  }
  return { state, request: clone(request) };
}

export function readWebMcpRequest(state: AsymptaWebMcpRequestState, rawRequestId: unknown) {
  const requestId = safeRequestId(rawRequestId);
  if (!requestId) return null;
  const request = state.requests.find((item) => item.requestId === requestId);
  return request ? clone(request) : null;
}

export function updateWebMcpRequest(
  current: AsymptaWebMcpRequestState,
  rawRequestId: unknown,
  patch: { status: AsymptaWebMcpRequestStatus; resultSummary?: unknown },
  now = Date.now(),
): { state: AsymptaWebMcpRequestState; request: AsymptaWebMcpRequest } | null {
  const requestId = safeRequestId(rawRequestId);
  if (!requestId || !isStatus(patch.status)) return null;
  const resultSummary = patch.resultSummary === undefined ? undefined : safeText(patch.resultSummary, 1_000);
  if (resultSummary && containsCredential(resultSummary)) {
    throw new Error("Credentials cannot be stored in a request result.");
  }

  const state: AsymptaWebMcpRequestState = {
    ...clone(current),
    requests: normalizeRequests(current.requests),
  };
  const index = state.requests.findIndex((item) => item.requestId === requestId);
  if (index < 0) return null;
  const timestamp = Number.isFinite(now) ? now : Date.now();
  const request: AsymptaWebMcpRequest = {
    ...state.requests[index],
    status: patch.status,
    updatedAt: timestamp,
    ...(resultSummary ? { resultSummary } : {}),
  };
  state.revision = Math.max(0, Math.floor(state.revision)) + 1;
  state.requests[index] = request;
  return { state, request: clone(request) };
}

export function getBrowserWebMcpRequestState() {
  if (browserCache) return clone(browserCache);
  const storage = browserStorage();
  if (!storage) {
    browserCache = createWebMcpRequestState();
    return clone(browserCache);
  }
  try {
    browserCache = restoreWebMcpRequestState(storage.getItem(ASYMPTA_WEBMCP_REQUEST_STORAGE_KEY) ?? "")
      ?? createWebMcpRequestState();
  } catch {
    browserCache = createWebMcpRequestState();
  }
  return clone(browserCache);
}

function writeBrowserWebMcpRequestState(state: AsymptaWebMcpRequestState) {
  browserCache = clone(state);
  const storage = browserStorage();
  if (storage) {
    try {
      storage.setItem(ASYMPTA_WEBMCP_REQUEST_STORAGE_KEY, serializeWebMcpRequestState(state));
    } catch {
      // The in-page event still lets the current session review the request.
    }
  }
}

export function submitBrowserWebMcpRequest(intent: unknown) {
  const submitted = submitWebMcpRequest(getBrowserWebMcpRequestState(), intent);
  writeBrowserWebMcpRequestState(submitted.state);
  publishBrowserRequest(submitted.request);
  return submitted.request;
}

export function readBrowserWebMcpRequest(requestId: unknown) {
  return readWebMcpRequest(getBrowserWebMcpRequestState(), requestId);
}

export function updateBrowserWebMcpRequest(
  requestId: unknown,
  patch: { status: AsymptaWebMcpRequestStatus; resultSummary?: unknown },
) {
  const updated = updateWebMcpRequest(getBrowserWebMcpRequestState(), requestId, patch);
  if (!updated) return null;
  writeBrowserWebMcpRequestState(updated.state);
  publishBrowserRequest(updated.request);
  return updated.request;
}

export function subscribeBrowserWebMcpRequests(
  listener: (request: AsymptaWebMcpRequest) => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const onRequest = (event: Event) => {
    const request = normalizeRequest((event as CustomEvent<AsymptaWebMcpRequest>).detail);
    if (request) listener(request);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ASYMPTA_WEBMCP_REQUEST_STORAGE_KEY) return;
    browserCache = restoreWebMcpRequestState(event.newValue ?? "") ?? createWebMcpRequestState();
    const latest = browserCache.requests.at(-1);
    if (latest) listener(clone(latest));
  };
  window.addEventListener(ASYMPTA_WEBMCP_REQUEST_EVENT, onRequest);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ASYMPTA_WEBMCP_REQUEST_EVENT, onRequest);
    window.removeEventListener("storage", onStorage);
  };
}

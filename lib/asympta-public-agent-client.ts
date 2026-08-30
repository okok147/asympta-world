import {
  ASYMPTA_PUBLIC_AGENT_API_PATH,
  ASYMPTA_PUBLIC_AGENT_TURNSTILE_ACTION,
} from "./asympta-public-agent-contract.ts";
import type {
  PublicAgentCityPlan,
  PublicAgentErrorCode,
  PublicAgentRequest,
  PublicAgentResponse,
  PublicAgentSuccessResponse,
} from "./asympta-public-agent-contract.ts";
import { isPublicAgentCityPlan } from "./asympta-city-plan.ts";

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const CLIENT_ID_STORAGE_KEY = "asympta.public-agent.client-id";
const TURNSTILE_TIMEOUT_MS = 30_000;
const TURNSTILE_SCRIPT_TIMEOUT_MS = 15_000;
const TURNSTILE_RETRY_INTERVAL_MS = 8_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERROR_CODES = new Set<PublicAgentErrorCode>([
  "invalid_origin",
  "method_not_allowed",
  "unsupported_media_type",
  "request_too_large",
  "invalid_request",
  "turnstile_failed",
  "rate_limited",
  "budget_exhausted",
  "missing_configuration",
  "upstream_timeout",
  "upstream_error",
  "invalid_upstream_response",
  "internal_error",
]);

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type TurnstileOptions = {
  sitekey: string;
  action: string;
  execution: "execute";
  appearance: "interaction-only";
  retry: "auto";
  "retry-interval": number;
  callback: (token: string) => void;
  "error-callback": (code?: string) => boolean;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type PublicAgentConfig = {
  endpoint: string;
  turnstileSiteKey: string;
};

export class PublicAgentClientError extends Error {
  readonly code: PublicAgentErrorCode;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(
    message: string,
    options: { code: PublicAgentErrorCode; retryable: boolean; status?: number | null },
  ) {
    super(message);
    this.name = "PublicAgentClientError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.status = options.status ?? null;
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

type PublicAgentSuccessPayload = Omit<PublicAgentSuccessResponse, "cityPlan"> & {
  cityPlan?: PublicAgentCityPlan | null;
};

function hasValidSuccessShape(value: unknown): value is PublicAgentSuccessPayload {
  const response = record(value);
  const goal = record(response?.goal);
  const result = response?.result === null ? null : record(response?.result);
  const action = response?.action === null ? null : record(response?.action);
  const provenance = record(response?.provenance);
  const sources = result ? result.sources : [];
  const verification = result ? record(result.verification) : null;

  return response?.ok === true
    && "result" in response
    && "action" in response
    && typeof response.activityId === "string"
    && typeof goal?.title === "string"
    && typeof goal.summary === "string"
    && ["weather", "research", "action", "clarification"].includes(String(goal.kind))
    && ["completed", "needs_clarification", "awaiting_confirmation"].includes(String(goal.status))
    && isStringArray(goal.missingFields)
    && typeof goal.requiresConfirmation === "boolean"
    && ["none", "low", "medium", "high"].includes(String(goal.risk))
    && (result === null || (
      typeof result.answer === "string"
      && typeof result.checkedAt === "string"
      && Array.isArray(sources)
      && sources.every((source) => {
        const item = record(source);
        return typeof item?.title === "string"
          && typeof item.url === "string"
          && ["open-meteo", "openrouter-web-search"].includes(String(item.provider))
          && (typeof item.publishedAt === "string" || item.publishedAt === null);
      })
      && ["verified", "partially_verified", "not_verified"].includes(String(verification?.status))
      && typeof verification?.details === "string"
    ))
    && (action === null || (
      typeof action.description === "string"
      && typeof action.consequence === "string"
    ))
    && (response.cityPlan === undefined || response.cityPlan === null || isPublicAgentCityPlan(response.cityPlan))
    && ["openrouter", "asympta"].includes(String(provenance?.provider))
    && (typeof provenance?.model === "string" || provenance?.model === null)
    && isStringArray(provenance?.tools)
    && typeof provenance?.simulated === "boolean";
}

function hasValidErrorShape(value: unknown): value is Extract<PublicAgentResponse, { ok: false }> {
  const response = record(value);
  const error = record(response?.error);
  return response?.ok === false
    && (typeof response.activityId === "string" || response.activityId === null)
    && typeof error?.code === "string"
    && ERROR_CODES.has(error.code as PublicAgentErrorCode)
    && typeof error.message === "string"
    && typeof error.retryable === "boolean";
}

function assertActionBoundary(response: PublicAgentSuccessResponse) {
  if (response.cityPlan?.access === "READ") {
    if (
      response.goal.kind !== "research"
      || response.goal.status !== "completed"
      || response.goal.requiresConfirmation
      || response.goal.risk !== "none"
      || response.action !== null
    ) {
      throw new PublicAgentClientError(
        "The service returned an unsafe city READ plan.",
        { code: "invalid_upstream_response", retryable: true },
      );
    }
    return;
  }

  const requiresBoundary = response.cityPlan?.access === "WRITE_REQUEST"
    || response.goal.kind === "action"
    || response.goal.status === "awaiting_confirmation"
    || response.goal.requiresConfirmation
    || response.action !== null;
  if (!requiresBoundary) return;
  if (
    response.goal.kind !== "action"
    || response.goal.status !== "awaiting_confirmation"
    || response.goal.requiresConfirmation !== true
    || response.action === null
  ) {
    throw new PublicAgentClientError(
      "The service returned an action without the required confirmation boundary.",
      { code: "invalid_upstream_response", retryable: true },
    );
  }
}

function parseResponse(value: unknown, status: number, responseOk: boolean): PublicAgentSuccessResponse {
  if (hasValidErrorShape(value)) {
    throw new PublicAgentClientError(value.error.message, {
      code: value.error.code,
      retryable: value.error.retryable,
      status,
    });
  }
  if (!hasValidSuccessShape(value)) {
    throw new PublicAgentClientError("The public agent returned an unreadable response.", {
      code: "invalid_upstream_response",
      retryable: true,
      status,
    });
  }
  if (!responseOk) {
    throw new PublicAgentClientError("The public agent could not complete the request.", {
      code: "upstream_error",
      retryable: status >= 500,
      status,
    });
  }
  const normalized: PublicAgentSuccessResponse = {
    ...value,
    cityPlan: value.cityPlan ?? null,
  };
  assertActionBoundary(normalized);
  return normalized;
}

function createUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function buildEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PublicAgentClientError("The public agent address is not valid.", {
      code: "missing_configuration",
      retryable: false,
    });
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new PublicAgentClientError("The public agent address must be a public HTTP endpoint.", {
      code: "missing_configuration",
      retryable: false,
    });
  }
  const basePath = url.pathname.replace(/\/+$/, "");
  if (!basePath.endsWith(ASYMPTA_PUBLIC_AGENT_API_PATH)) {
    url.pathname = `${basePath}${ASYMPTA_PUBLIC_AGENT_API_PATH}`;
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function getPublicAgentConfig(): PublicAgentConfig | null {
  const apiUrl = process.env.NEXT_PUBLIC_ASYMPTA_AGENT_API_URL?.trim();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY?.trim();
  if (!apiUrl || !turnstileSiteKey) return null;
  return { endpoint: buildEndpoint(apiUrl), turnstileSiteKey };
}

export function isPublicAgentConfigured() {
  try {
    return getPublicAgentConfig() !== null;
  } catch {
    return false;
  }
}

export function getOrCreatePublicAgentClientId(storage?: Storage) {
  try {
    const target = storage ?? window.localStorage;
    const existing = target.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing && UUID_PATTERN.test(existing)) return existing;
    const clientId = createUuid();
    target.setItem(CLIENT_ID_STORAGE_KEY, clientId);
    return clientId;
  } catch {
    return createUuid();
  }
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.asymptaTurnstile = "explicit";
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      callback();
    };
    const timer = window.setTimeout(() => finish(() => {
      script.remove();
      reject(new Error("Turnstile took too long to load."));
    }), TURNSTILE_SCRIPT_TIMEOUT_MS);
    script.addEventListener("load", () => finish(() => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile loaded without a browser API."));
    }), { once: true });
    script.addEventListener("error", () => finish(() => reject(new Error("Turnstile could not be loaded."))), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
}

export async function requestTurnstileToken(input: {
  container: HTMLElement;
  siteKey: string;
  signal?: AbortSignal;
}) {
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const api = await new Promise<TurnstileApi>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    input.signal?.addEventListener("abort", abort, { once: true });
    loadTurnstile().then(resolve, reject).finally(() => {
      input.signal?.removeEventListener("abort", abort);
    });
  });
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  return new Promise<{ token: string; release: () => void }>((resolve, reject) => {
    const mount = input.container.ownerDocument.createElement("div");
    mount.className = "asympta-intent-turnstile__mount";
    input.container.appendChild(mount);
    let widgetId: string | null = null;
    let settled = false;
    let released = false;
    const timer = window.setTimeout(() => fail("Verification timed out. Please try again."), TURNSTILE_TIMEOUT_MS);

    const stopWaiting = () => {
      window.clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
    };
    const release = () => {
      if (released) return;
      released = true;
      stopWaiting();
      if (widgetId !== null) {
        api.remove(widgetId);
        widgetId = null;
      }
      mount.remove();
    };
    const succeed = (token: string) => {
      if (settled) return;
      settled = true;
      stopWaiting();
      if (token) resolve({ token, release });
      else {
        release();
        reject(new PublicAgentClientError("Verification returned an empty token.", {
          code: "turnstile_failed",
          retryable: true,
        }));
      }
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      release();
      reject(new PublicAgentClientError(message, { code: "turnstile_failed", retryable: true }));
    };
    const abort = () => {
      if (settled) return;
      settled = true;
      release();
      reject(new DOMException("Aborted", "AbortError"));
    };

    input.signal?.addEventListener("abort", abort, { once: true });
    try {
      widgetId = api.render(mount, {
        sitekey: input.siteKey,
        action: ASYMPTA_PUBLIC_AGENT_TURNSTILE_ACTION,
        execution: "execute",
        appearance: "interaction-only",
        retry: "auto",
        "retry-interval": TURNSTILE_RETRY_INTERVAL_MS,
        callback: succeed,
        // Returning false preserves Turnstile's automatic retry path. The
        // outer 30-second timer remains the fail-closed boundary.
        "error-callback": () => false,
        "expired-callback": () => fail("Verification expired. Please try again."),
        "timeout-callback": () => fail("Verification timed out. Please try again."),
      });
      if (settled) {
        release();
        return;
      }
      api.execute(widgetId);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Verification could not start.");
    }
  });
}

export async function runPublicAgentIntent(
  request: PublicAgentRequest,
  options: { endpoint: string; signal?: AbortSignal; fetcher?: FetchLike },
) {
  const response = await (options.fetcher ?? fetch)(options.endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
    signal: options.signal,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });

  const payload: unknown = await response.json().catch(() => null);
  return parseResponse(payload, response.status, response.ok);
}

export function isSafePublicAgentSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

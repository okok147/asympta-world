import { DurableObject } from "cloudflare:workers";

import {
  answerTaskRequirement,
  approveAsymptaTask,
  AsymptaTaskKernelError,
  cancelAsymptaTask,
  createAsymptaTask,
  nextTaskRequirement,
} from "../../../lib/asympta-task-kernel.ts";
import type {
  AnswerRequirementCommand,
  ApproveTaskCommand,
  AsymptaTaskState,
  CancelTaskCommand,
  CreateAsymptaTaskInput,
} from "../../../lib/asympta-task-kernel-types.ts";

const PRODUCTION_ORIGIN = "https://okok147.github.io";
const API_PREFIX = "/v1/tasks";
const MAX_BODY_BYTES = 32 * 1024;
const TOKEN_BYTES = 32;
const TASK_ID_PATTERN = /^task-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TOKEN_HASH_HEADER = "X-Asympta-Task-Token-Hash";
const STORAGE_KEY = "task-record";

type JsonRecord = Record<string, unknown>;
type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }> | { success: boolean };
};
type DurableObjectStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};
type DurableObjectNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
};

type TaskKernelEnv = {
  TASKS?: DurableObjectNamespace;
  TASK_RATE_LIMIT?: RateLimitBinding;
  ENVIRONMENT?: string;
};

type TaskKernelDependencies = {
  randomUUID?: () => string;
  randomBytes?: (length: number) => Uint8Array;
  now?: () => Date;
};

type StoredTaskRecord = {
  task: AsymptaTaskState;
  tokenHash: string;
};

type DurableObjectStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  transaction?<T>(closure: (transaction: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  }) => Promise<T>): Promise<T>;
};

type DurableObjectState = {
  storage: DurableObjectStorage;
};

class TaskKernelHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, retryable: boolean, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function boundedString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function boundedInteger(value: unknown, min: number, max: number): number | null {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : null;
}

function hasOnlyKeys(value: JsonRecord, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isDevelopment(env: TaskKernelEnv) {
  return env.ENVIRONMENT === "development" || env.ENVIRONMENT === "test";
}

function allowedOrigin(rawOrigin: string | null, env: TaskKernelEnv): string | false {
  if (rawOrigin === PRODUCTION_ORIGIN) return rawOrigin;
  if (!rawOrigin || !isDevelopment(env)) return false;
  try {
    const parsed = new URL(rawOrigin);
    const local = parsed.hostname === "localhost"
      || parsed.hostname === "127.0.0.1"
      || parsed.hostname === "[::1]";
    if (!local || parsed.protocol !== "http:" || parsed.origin !== rawOrigin) return false;
    const port = parsed.port === "" ? 80 : Number(parsed.port);
    return Number.isInteger(port) && port >= 1 && port <= 65_535 ? rawOrigin : false;
  } catch {
    return false;
  }
}

function responseHeaders(origin: string | null, revision?: number) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Asympta-Client-Id");
    headers.set("Access-Control-Expose-Headers", "ETag, X-Asympta-Task-Revision");
    headers.set("Access-Control-Max-Age", "600");
  }
  if (revision !== undefined) {
    headers.set("ETag", `\"revision-${revision}\"`);
    headers.set("X-Asympta-Task-Revision", String(revision));
  }
  return headers;
}

function jsonResponse(payload: unknown, status: number, origin: string | null, revision?: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(origin, revision),
  });
}

function errorResponse(error: TaskKernelHttpError, origin: string | null) {
  return jsonResponse({
    ok: false,
    error: {
      code: error.code,
      message: error.message.slice(0, 240),
      retryable: error.retryable,
    },
  }, error.status, origin);
}

async function readBodyWithinLimit(request: Request) {
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new TaskKernelHttpError(413, "request_too_large", false, "Request body is too large.");
  }
  if (!request.body) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "A JSON request body is required.");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new TaskKernelHttpError(413, "request_too_large", false, "Request body is too large.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Request body must be valid UTF-8 JSON.");
  }
}

function requireJson(request: Request) {
  const type = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") {
    throw new TaskKernelHttpError(415, "unsupported_media_type", false, "Content-Type must be application/json.");
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

function constantTimeEqual(left: string, right: string) {
  const size = Math.max(left.length, right.length);
  let different = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    different |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return different === 0;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,256})$/u.exec(authorization);
  if (!match) {
    throw new TaskKernelHttpError(401, "unauthorized", false, "A valid task bearer token is required.");
  }
  return match[1];
}

function validateTaskId(value: string) {
  if (!TASK_ID_PATTERN.test(value)) {
    throw new TaskKernelHttpError(404, "task_not_found", false, "Task was not found.");
  }
  return value;
}

function validateStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const items = value.map((item) => boundedString(item, 1, maxLength));
  return items.some((item) => item === null) ? null : items as string[];
}

function validateCreateInput(value: unknown): CreateAsymptaTaskInput {
  const record = asRecord(value);
  const allowed = [
    "activityId", "rootIntent", "locale", "domain", "actionFamily", "mode", "risk",
    "title", "summary", "missingFields",
  ] as const;
  if (!record || !hasOnlyKeys(record, allowed)) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Task fields are invalid.");
  }
  const rootIntent = boundedString(record.rootIntent, 2, 600);
  const locale = boundedString(record.locale, 2, 35);
  const activityId = record.activityId === undefined || record.activityId === null
    ? null
    : boundedString(record.activityId, 1, 128);
  const domain = record.domain === undefined ? undefined : boundedString(record.domain, 1, 80);
  const actionFamily = record.actionFamily === undefined ? undefined : boundedString(record.actionFamily, 1, 80);
  const title = record.title === undefined ? undefined : boundedString(record.title, 1, 120);
  const summary = record.summary === undefined ? undefined : boundedString(record.summary, 1, 360);
  const missingFields = validateStringArray(record.missingFields, 16, 120);
  const mode = record.mode === undefined || record.mode === "live" || record.mode === "simulated"
    ? record.mode as CreateAsymptaTaskInput["mode"]
    : null;
  const risks = ["none", "low", "medium", "high", "critical"];
  const risk = record.risk === undefined || risks.includes(String(record.risk))
    ? record.risk as CreateAsymptaTaskInput["risk"]
    : null;
  if (!rootIntent || !locale || !missingFields || mode === null || risk === null
    || (record.activityId !== undefined && activityId === null)
    || (record.domain !== undefined && !domain)
    || (record.actionFamily !== undefined && !actionFamily)
    || (record.title !== undefined && !title)
    || (record.summary !== undefined && !summary)) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Task fields are missing or outside allowed limits.");
  }
  return {
    rootIntent,
    locale,
    activityId,
    missingFields,
    ...(domain ? { domain } : {}),
    ...(actionFamily ? { actionFamily } : {}),
    ...(mode ? { mode } : {}),
    ...(risk ? { risk } : {}),
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
  };
}

function validateAnswerInput(value: unknown, taskId: string): AnswerRequirementCommand {
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ["commandId", "requirementId", "expectedRevision", "value", "label"])) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Answer fields are invalid.");
  }
  const commandId = boundedString(record.commandId, 8, 180);
  const requirementId = boundedString(record.requirementId, 3, 220);
  const expectedRevision = boundedInteger(record.expectedRevision, 1, Number.MAX_SAFE_INTEGER);
  const label = boundedString(record.label, 1, 180);
  const answerValue = record.value;
  const scalar = typeof answerValue === "string" || typeof answerValue === "boolean"
    || (typeof answerValue === "number" && Number.isFinite(answerValue));
  if (!commandId || !requirementId || expectedRevision === null || !label || !scalar) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Answer fields are missing or outside allowed limits.");
  }
  if (typeof answerValue === "string" && (answerValue.trim().length < 1 || answerValue.length > 500)) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Answer value is outside allowed limits.");
  }
  return {
    commandId,
    taskId,
    requirementId,
    expectedRevision,
    value: typeof answerValue === "string" ? answerValue.trim() : answerValue,
    label,
    actorId: "human",
  };
}

function validateApprovalInput(value: unknown, taskId: string): ApproveTaskCommand {
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ["commandId", "approvalId", "expectedRevision", "approved"])) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Approval fields are invalid.");
  }
  const commandId = boundedString(record.commandId, 8, 180);
  const approvalId = boundedString(record.approvalId, 3, 220);
  const expectedRevision = boundedInteger(record.expectedRevision, 1, Number.MAX_SAFE_INTEGER);
  if (!commandId || !approvalId || expectedRevision === null || typeof record.approved !== "boolean") {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Approval fields are missing or outside allowed limits.");
  }
  return {
    commandId,
    taskId,
    approvalId,
    expectedRevision,
    approved: record.approved,
    actorId: "human",
  };
}

function validateCancelInput(value: unknown, taskId: string): CancelTaskCommand {
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ["commandId", "expectedRevision", "reason"])) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Cancellation fields are invalid.");
  }
  const commandId = boundedString(record.commandId, 8, 180);
  const expectedRevision = boundedInteger(record.expectedRevision, 1, Number.MAX_SAFE_INTEGER);
  const reason = record.reason === undefined ? undefined : boundedString(record.reason, 1, 240);
  if (!commandId || expectedRevision === null || (record.reason !== undefined && !reason)) {
    throw new TaskKernelHttpError(400, "invalid_request", false, "Cancellation fields are missing or outside allowed limits.");
  }
  return {
    commandId,
    taskId,
    expectedRevision,
    ...(reason ? { reason } : {}),
    actorId: "human",
  };
}

function kernelError(error: unknown) {
  if (error instanceof TaskKernelHttpError) return error;
  if (error instanceof AsymptaTaskKernelError) {
    const status = error.code === "task_not_found" ? 404
      : error.code === "invalid_command" ? 400
        : 409;
    return new TaskKernelHttpError(status, error.code, error.code === "revision_conflict", error.message);
  }
  return new TaskKernelHttpError(500, "internal_error", true, "The Task Kernel could not complete this operation.");
}

function taskPayload(task: AsymptaTaskState) {
  return {
    ok: true,
    task,
    nextRequirement: nextTaskRequirement(task),
  };
}

async function enforceRateLimit(env: TaskKernelEnv, request: Request) {
  if (!env.TASK_RATE_LIMIT) {
    if (isDevelopment(env)) return;
    throw new TaskKernelHttpError(503, "missing_configuration", true, "Task creation protection is unavailable.");
  }
  const ip = boundedString(request.headers.get("CF-Connecting-IP"), 3, 64);
  const clientId = boundedString(request.headers.get("X-Asympta-Client-Id"), 8, 128);
  const key = ip ? `ip:${ip}` : clientId ? `client:${clientId}` : "anonymous";
  try {
    const result = await env.TASK_RATE_LIMIT.limit({ key });
    if (!result.success) throw new TaskKernelHttpError(429, "rate_limited", true, "Too many task requests. Please try again shortly.");
  } catch (error) {
    if (error instanceof TaskKernelHttpError) throw error;
    throw new TaskKernelHttpError(503, "missing_configuration", true, "Task creation protection is unavailable.");
  }
}

async function forwardTaskRequest(
  env: TaskKernelEnv,
  taskId: string,
  path: string,
  request: Request,
  body?: unknown,
) {
  if (!env.TASKS) {
    throw new TaskKernelHttpError(503, "missing_configuration", true, "Task persistence is unavailable.");
  }
  const token = bearerToken(request);
  const tokenHash = await hashToken(token);
  const id = env.TASKS.idFromName(taskId);
  const stub = env.TASKS.get(id);
  return stub.fetch(`https://task.internal${path}`, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      [TOKEN_HASH_HEADER]: tokenHash,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readInternalResponse(response: Response, origin: string) {
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new TaskKernelHttpError(502, "invalid_internal_response", true, "Task persistence returned an invalid response.");
  }
  const revision = Number(response.headers.get("X-Asympta-Task-Revision"));
  return jsonResponse(body, response.status, origin, Number.isInteger(revision) ? revision : undefined);
}

export class TaskCoordinator extends DurableObject<TaskKernelEnv> {
  constructor(state: DurableObjectState, env: TaskKernelEnv) {
    super(state, env);
  }

  private get storage() {
    return this.ctx.storage as DurableObjectStorage;
  }

  private async readRecord() {
    const record = await this.storage.get<StoredTaskRecord>(STORAGE_KEY);
    if (!record) throw new TaskKernelHttpError(404, "task_not_found", false, "Task was not found.");
    return record;
  }

  private async authenticate(request: Request, record: StoredTaskRecord) {
    const supplied = request.headers.get(TOKEN_HASH_HEADER) ?? "";
    if (!supplied || !constantTimeEqual(supplied, record.tokenHash)) {
      throw new TaskKernelHttpError(401, "unauthorized", false, "Task token is invalid.");
    }
  }

  private async writeTask(record: StoredTaskRecord, task: AsymptaTaskState) {
    const next = { ...record, task };
    await this.storage.put(STORAGE_KEY, next);
    return next;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/internal/initialize") {
        if (request.method !== "POST") return Response.json({ ok: false }, { status: 405 });
        const input = asRecord(await request.json());
        const tokenHash = boundedString(input?.tokenHash, 32, 128);
        const taskInput = asRecord(input?.input);
        if (!tokenHash || !taskInput) {
          throw new TaskKernelHttpError(400, "invalid_request", false, "Task initialization is invalid.");
        }
        const existing = await this.storage.get<StoredTaskRecord>(STORAGE_KEY);
        if (existing) {
          throw new TaskKernelHttpError(409, "task_exists", false, "Task already exists.");
        }
        const task = createAsymptaTask(taskInput as unknown as CreateAsymptaTaskInput);
        await this.storage.put(STORAGE_KEY, { task, tokenHash } satisfies StoredTaskRecord);
        return jsonResponse(taskPayload(task), 201, null, task.revision);
      }

      const record = await this.readRecord();
      await this.authenticate(request, record);

      if (url.pathname === "/task" && request.method === "GET") {
        return jsonResponse(taskPayload(record.task), 200, null, record.task.revision);
      }
      if (url.pathname === "/events" && request.method === "GET") {
        const after = Number(url.searchParams.get("afterRevision") ?? 0);
        const events = record.task.events.filter((event) => !Number.isFinite(after) || event.revision > after);
        return jsonResponse({ ok: true, taskId: record.task.taskId, revision: record.task.revision, events }, 200, null, record.task.revision);
      }
      if (url.pathname === "/answer" && request.method === "POST") {
        const body = validateAnswerInput(await request.json(), record.task.taskId);
        const task = answerTaskRequirement(record.task, body);
        await this.writeTask(record, task);
        return jsonResponse(taskPayload(task), 200, null, task.revision);
      }
      if (url.pathname === "/approve" && request.method === "POST") {
        const body = validateApprovalInput(await request.json(), record.task.taskId);
        const task = approveAsymptaTask(record.task, body);
        await this.writeTask(record, task);
        return jsonResponse(taskPayload(task), 200, null, task.revision);
      }
      if (url.pathname === "/cancel" && request.method === "POST") {
        const body = validateCancelInput(await request.json(), record.task.taskId);
        const task = cancelAsymptaTask(record.task, body);
        await this.writeTask(record, task);
        return jsonResponse(taskPayload(task), 200, null, task.revision);
      }
      throw new TaskKernelHttpError(404, "not_found", false, "Endpoint was not found.");
    } catch (error) {
      const mapped = kernelError(error);
      return errorResponse(mapped, null);
    }
  }
}

export function createTaskKernelWorker(dependencies: TaskKernelDependencies = {}) {
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
  const randomBytes = dependencies.randomBytes ?? ((length: number) => crypto.getRandomValues(new Uint8Array(length)));
  const now = dependencies.now ?? (() => new Date());

  return {
    async fetch(request: Request, env: TaskKernelEnv): Promise<Response> {
      const origin = allowedOrigin(request.headers.get("Origin"), env);
      if (origin === false) {
        return errorResponse(new TaskKernelHttpError(403, "invalid_origin", false, "Request origin is not allowed."), null);
      }
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: responseHeaders(origin) });
      }
      try {
        const url = new URL(request.url);
        if (url.pathname === "/health" && request.method === "GET") {
          return jsonResponse({ ok: true, service: "asympta-task-kernel", version: "asympta.task/0.3" }, 200, origin);
        }
        if (url.pathname === API_PREFIX) {
          if (request.method !== "POST") {
            const response = errorResponse(new TaskKernelHttpError(405, "method_not_allowed", false, "Only POST is allowed."), origin);
            response.headers.set("Allow", "POST, OPTIONS");
            return response;
          }
          requireJson(request);
          await enforceRateLimit(env, request);
          if (!env.TASKS) {
            throw new TaskKernelHttpError(503, "missing_configuration", true, "Task persistence is unavailable.");
          }
          const input = validateCreateInput(await readBodyWithinLimit(request));
          const taskId = `task-${randomUUID().toLowerCase()}`;
          validateTaskId(taskId);
          const accessToken = base64Url(randomBytes(TOKEN_BYTES));
          const tokenHash = await hashToken(accessToken);
          const id = env.TASKS.idFromName(taskId);
          const stub = env.TASKS.get(id);
          const initialized = await stub.fetch("https://task.internal/internal/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: {
                ...input,
                taskId,
                now: now().toISOString(),
              },
              tokenHash,
            }),
          });
          const text = await initialized.text();
          let body: JsonRecord | null = null;
          try {
            body = asRecord(JSON.parse(text));
          } catch {
            body = null;
          }
          if (!initialized.ok || !body) {
            throw new TaskKernelHttpError(502, "task_initialization_failed", true, "Task persistence could not initialize the task.");
          }
          const task = asRecord(body.task) as unknown as AsymptaTaskState | null;
          return jsonResponse({ ...body, accessToken }, 201, origin, task?.revision);
        }

        const match = /^\/v1\/tasks\/([^/]+)(?:\/(answers|approve|cancel|events))?$/u.exec(url.pathname);
        if (!match) throw new TaskKernelHttpError(404, "not_found", false, "Endpoint was not found.");
        const taskId = validateTaskId(decodeURIComponent(match[1]));
        const action = match[2] ?? "task";
        if (action === "task") {
          if (request.method !== "GET") throw new TaskKernelHttpError(405, "method_not_allowed", false, "Only GET is allowed.");
          return readInternalResponse(await forwardTaskRequest(env, taskId, "/task", request), origin);
        }
        if (action === "events") {
          if (request.method !== "GET") throw new TaskKernelHttpError(405, "method_not_allowed", false, "Only GET is allowed.");
          const after = boundedInteger(Number(url.searchParams.get("afterRevision") ?? 0), 0, Number.MAX_SAFE_INTEGER) ?? 0;
          return readInternalResponse(await forwardTaskRequest(env, taskId, `/events?afterRevision=${after}`, request), origin);
        }
        if (request.method !== "POST") throw new TaskKernelHttpError(405, "method_not_allowed", false, "Only POST is allowed.");
        requireJson(request);
        const body = await readBodyWithinLimit(request);
        const internalPath = action === "answers" ? "/answer" : action === "approve" ? "/approve" : "/cancel";
        return readInternalResponse(await forwardTaskRequest(env, taskId, internalPath, request, body), origin);
      } catch (error) {
        return errorResponse(kernelError(error), origin);
      }
    },
  };
}

export default createTaskKernelWorker();

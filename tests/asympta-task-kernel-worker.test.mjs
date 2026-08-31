import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("../cloudflare/task-kernel/test-loader.mjs", import.meta.url);

const {
  TaskCoordinator,
  createTaskKernelWorker,
} = await import("../cloudflare/task-kernel/src/index.ts");

const ORIGIN = "https://okok147.github.io";
const API = "https://kernel.example/v1/tasks";
const UUID = "11111111-2222-4333-8444-555555555555";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }

  async transaction(closure) {
    return closure(this);
  }
}

class MemoryTaskNamespace {
  constructor(env) {
    this.env = env;
    this.instances = new Map();
    this.storages = new Map();
  }

  idFromName(name) {
    return name;
  }

  get(id) {
    if (!this.instances.has(id)) {
      const storage = new MemoryStorage();
      this.storages.set(id, storage);
      this.instances.set(id, new TaskCoordinator({ storage }, this.env));
    }
    const instance = this.instances.get(id);
    return {
      fetch(input, init) {
        return instance.fetch(new Request(input, init));
      },
    };
  }
}

function deterministicWorker() {
  return createTaskKernelWorker({
    randomUUID: () => UUID,
    randomBytes: (length) => Uint8Array.from({ length }, (_, index) => (index * 17 + 11) % 256),
    now: () => new Date("2026-08-31T10:30:00.000Z"),
  });
}

function environment(overrides = {}) {
  const env = {
    ENVIRONMENT: "production",
    TASK_RATE_LIMIT: { async limit() { return { success: true }; } },
    ...overrides,
  };
  env.TASKS = overrides.TASKS ?? new MemoryTaskNamespace(env);
  return env;
}

function request(url, options = {}) {
  const headers = new Headers({
    Origin: ORIGIN,
    "CF-Connecting-IP": "203.0.113.14",
    ...options.headers,
  });
  const body = options.body;
  if (body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Request(url, {
    method: options.method ?? "GET",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function createBody(overrides = {}) {
  return {
    rootIntent: "Buy a television",
    locale: "en-HK",
    mode: "simulated",
    missingFields: ["screen size", "brand preference", "delivery location"],
    ...overrides,
  };
}

async function createTask(worker, env, overrides = {}) {
  const response = await worker.fetch(request(API, {
    method: "POST",
    body: createBody(overrides),
  }), env);
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return { response, body, token: body.accessToken, task: body.task };
}

async function answer(worker, env, token, task, requirement, value, label, commandId) {
  const response = await worker.fetch(request(`${API}/${task.taskId}/answers`, {
    method: "POST",
    headers: auth(token),
    body: {
      commandId,
      requirementId: requirement.id,
      expectedRevision: task.revision,
      value,
      label,
    },
  }), env);
  const body = await response.json();
  return { response, body, task: body.task };
}

test("health and CORS use an exact production allowlist", async () => {
  const worker = deterministicWorker();
  const env = environment();

  const health = await worker.fetch(request("https://kernel.example/health"), env);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: "asympta-task-kernel",
    version: "asympta.task/0.3",
  });

  const rejected = await worker.fetch(new Request("https://kernel.example/health", {
    headers: { Origin: "https://okok147.github.io.evil.example" },
  }), env);
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await rejected.json()).error.code, "invalid_origin");

  const local = await worker.fetch(new Request("https://kernel.example/health", {
    headers: { Origin: "http://localhost:5173" },
  }), { ...env, ENVIRONMENT: "development" });
  assert.equal(local.status, 200);
  assert.equal(local.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
});

test("task creation is bounded and fails closed without the rate limiter", async () => {
  const worker = deterministicWorker();
  const noRate = environment({ TASK_RATE_LIMIT: undefined });
  const protectedResponse = await worker.fetch(request(API, {
    method: "POST",
    body: createBody(),
  }), noRate);
  assert.equal(protectedResponse.status, 503);
  assert.equal((await protectedResponse.json()).error.code, "missing_configuration");

  const env = environment();
  const wrongType = await worker.fetch(request(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: createBody(),
  }), env);
  assert.equal(wrongType.status, 415);

  const invalidFields = await worker.fetch(request(API, {
    method: "POST",
    body: { ...createBody(), unexpected: true },
  }), env);
  assert.equal(invalidFields.status, 400);

  const oversized = await worker.fetch(new Request(API, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ ...createBody(), rootIntent: "x".repeat(33 * 1024) }),
  }), env);
  assert.equal(oversized.status, 413);
});

test("creation returns an opaque task token while Durable Object storage keeps only its hash", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);

  assert.equal(created.task.version, "asympta.task/0.3");
  assert.equal(created.task.taskId, `task-${UUID}`);
  assert.equal(created.task.revision, 1);
  assert.equal(created.task.phase, "awaiting_human");
  assert.ok(typeof created.token === "string" && created.token.length >= 40);
  assert.equal(created.response.headers.get("X-Asympta-Task-Revision"), "1");
  assert.equal(created.response.headers.get("ETag"), '"revision-1"');

  const storage = env.TASKS.storages.get(created.task.taskId);
  const serialized = JSON.stringify([...storage.values.values()]);
  assert.doesNotMatch(serialized, new RegExp(created.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(serialized, /tokenHash/);
});

test("task reads require the exact bearer capability token", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);

  const noToken = await worker.fetch(request(`${API}/${created.task.taskId}`), env);
  assert.equal(noToken.status, 401);

  const wrongToken = await worker.fetch(request(`${API}/${created.task.taskId}`, {
    headers: auth("wrong_token_that_is_long_enough_1234567890"),
  }), env);
  assert.equal(wrongToken.status, 401);

  const valid = await worker.fetch(request(`${API}/${created.task.taskId}`, {
    headers: auth(created.token),
  }), env);
  assert.equal(valid.status, 200);
  const body = await valid.json();
  assert.equal(body.task.taskId, created.task.taskId);
  assert.equal(body.nextRequirement.key, "screen_size");
});

test("typed answers advance one revisioned task through the bounded specialist mesh", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);
  const rootIntent = created.task.rootIntent.raw;
  let task = created.task;

  let result = await answer(worker, env, created.token, task, task.requirements.find((item) => item.key === "screen_size"), "55-inch", "55″", "answer-size-001");
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  task = result.task;
  assert.equal(task.revision, 2);
  assert.equal(result.body.nextRequirement.key, "brand");

  result = await answer(worker, env, created.token, task, task.requirements.find((item) => item.key === "brand"), "sony", "Sony", "answer-brand-001");
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  task = result.task;
  assert.equal(result.body.nextRequirement.key, "delivery_location");

  result = await answer(worker, env, created.token, task, task.requirements.find((item) => item.key === "delivery_location"), "saved_home", "Usual address", "answer-delivery-001");
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  task = result.task;
  assert.equal(task.phase, "completed");
  assert.equal(task.result.completed, true);
  assert.equal(task.rootIntent.raw, rootIntent);
  assert.equal(task.requirements.filter((item) => item.status === "unknown").length, 0);
  assert.ok(task.requirements.every((item) => item.lockedBy === "human"));
  for (const expectedAgent of [
    "intent-interpreter",
    "commerce-electronics-specialist",
    "retailer-search-agent",
    "logistics-agent",
    "independent-verifier",
  ]) {
    assert.ok(task.assignments.some((assignment) => assignment.agentId === expectedAgent), expectedAgent);
  }
  assert.ok(task.assignments.length <= task.limits.maxAssignments);
  assert.ok(task.assignments.every((assignment) => assignment.depth <= task.limits.maxDelegationDepth));
});

test("stale revisions fail with 409 while command replay is idempotent", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);
  const size = created.task.requirements.find((item) => item.key === "screen_size");
  const first = await answer(worker, env, created.token, created.task, size, "55-inch", "55″", "answer-size-idempotent");
  assert.equal(first.response.status, 200);

  const replayResponse = await worker.fetch(request(`${API}/${created.task.taskId}/answers`, {
    method: "POST",
    headers: auth(created.token),
    body: {
      commandId: "answer-size-idempotent",
      requirementId: size.id,
      expectedRevision: created.task.revision,
      value: "55-inch",
      label: "55″",
    },
  }), env);
  const replay = await replayResponse.json();
  assert.equal(replayResponse.status, 200);
  assert.equal(replay.task.revision, first.task.revision);

  const brand = first.task.requirements.find((item) => item.key === "brand");
  const staleResponse = await worker.fetch(request(`${API}/${created.task.taskId}/answers`, {
    method: "POST",
    headers: auth(created.token),
    body: {
      commandId: "answer-brand-stale",
      requirementId: brand.id,
      expectedRevision: created.task.revision,
      value: "sony",
      label: "Sony",
    },
  }), env);
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error.code, "revision_conflict");
});

test("event history can be read incrementally by task revision", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);
  const size = created.task.requirements.find((item) => item.key === "screen_size");
  const first = await answer(worker, env, created.token, created.task, size, "55-inch", "55″", "answer-size-events");
  assert.equal(first.response.status, 200);

  const eventsResponse = await worker.fetch(request(`${API}/${created.task.taskId}/events?afterRevision=1`, {
    headers: auth(created.token),
  }), env);
  const events = await eventsResponse.json();
  assert.equal(eventsResponse.status, 200);
  assert.ok(events.events.length > 0);
  assert.ok(events.events.every((event) => event.revision > 1));
  assert.equal(events.revision, first.task.revision);
});

test("live tasks stop at approval and never claim a side effect without a connected executor", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env, {
    mode: "live",
    missingFields: ["screen size"],
  });
  const size = created.task.requirements.find((item) => item.key === "screen_size");
  const answered = await answer(worker, env, created.token, created.task, size, "55-inch", "55″", "live-size-answer");
  assert.equal(answered.response.status, 200, JSON.stringify(answered.body));
  assert.equal(answered.task.phase, "awaiting_approval");
  assert.equal(answered.task.result, null);
  const approval = answered.task.approvals.find((item) => item.status === "pending");
  assert.ok(approval);

  const approvedResponse = await worker.fetch(request(`${API}/${created.task.taskId}/approve`, {
    method: "POST",
    headers: auth(created.token),
    body: {
      commandId: "approve-live-task",
      approvalId: approval.id,
      expectedRevision: answered.task.revision,
      approved: true,
    },
  }), env);
  const approved = await approvedResponse.json();
  assert.equal(approvedResponse.status, 200, JSON.stringify(approved));
  assert.equal(approved.task.phase, "blocked");
  assert.equal(approved.task.result.completed, false);
  assert.equal(approved.task.failure.code, "connected_executor_required");
  assert.match(approved.task.result.summary, /no real external action was executed/i);
});

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
    this.alarmAt = null;
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

  async setAlarm(value) {
    this.alarmAt = value instanceof Date ? value.getTime() : Number(value);
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

function answerFor(requirement) {
  const key = requirement.key;
  if (key === "budget") return ["premium", "Premium"];
  if (key === "screen_size" || key === "size") return ["55-inch", "55″"];
  if (key === "brand") return ["sony", "Sony"];
  if (key === "delivery_location" || key === "fulfilment") return ["saved_home", "Usual address"];
  if (key === "quantity") return [1, "1"];
  if (key === "purpose") return ["personal_use", "Personal use"];
  if (key === "purchase_location") return ["best_available_channel", "Best available channel"];
  if (key === "deadline") return ["flexible", "Flexible timing"];
  return ["agent_choice", "Let Asympta decide"];
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

async function answerAll(worker, env, created, prefix) {
  let task = created.task;
  let index = 0;
  while (task.requirements.some((requirement) => requirement.status === "unknown")) {
    const requirement = task.requirements.find((candidate) => candidate.status === "unknown");
    const [value, label] = answerFor(requirement);
    const result = await answer(worker, env, created.token, task, requirement, value, label, `${prefix}-${index}-answer`);
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    task = result.task;
    index += 1;
    assert.ok(index < 24, "requirement progression must remain bounded");
  }
  return task;
}

async function approve(worker, env, token, task, commandId) {
  const approval = task.approvals.find((candidate) => candidate.status === "pending");
  assert.ok(approval, "a pending typed approval must exist");
  const response = await worker.fetch(request(`${API}/${task.taskId}/approve`, {
    method: "POST",
    headers: auth(token),
    body: {
      commandId,
      approvalId: approval.id,
      expectedRevision: task.revision,
      approved: true,
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
    version: "asympta.task/0.4",
  });

  const rejected = await worker.fetch(new Request("https://kernel.example/health", {
    headers: { Origin: "https://okok147.github.io.evil.example" },
  }), env);
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), null);

  const local = await worker.fetch(new Request("https://kernel.example/health", {
    headers: { Origin: "http://localhost:5173" },
  }), { ...env, ENVIRONMENT: "development" });
  assert.equal(local.status, 200);
  assert.equal(local.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
});

test("task creation is bounded and accepts only the typed confirmation flag", async () => {
  const worker = deterministicWorker();
  const noRate = environment({ TASK_RATE_LIMIT: undefined });
  const protectedResponse = await worker.fetch(request(API, { method: "POST", body: createBody() }), noRate);
  assert.equal(protectedResponse.status, 503);

  const env = environment();
  const wrongType = await worker.fetch(request(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: createBody(),
  }), env);
  assert.equal(wrongType.status, 415);

  const invalidFields = await worker.fetch(request(API, {
    method: "POST",
    body: { ...createBody(), confirmationRequired: "yes" },
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

  assert.equal(created.task.version, "asympta.task/0.4");
  assert.equal(created.task.taskId, `task-${UUID}`);
  assert.equal(created.task.phase, "awaiting_human");
  assert.ok(typeof created.token === "string" && created.token.length >= 40);
  assert.equal(created.response.headers.get("X-Asympta-Task-Revision"), String(created.task.revision));

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
  assert.ok(body.nextRequirement);
});

test("typed answers and confirmation continue the same task through execution receipt and verification", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);
  const rootIntent = created.task.rootIntent.raw;
  const answered = await answerAll(worker, env, created, "tv");

  assert.equal(answered.phase, "awaiting_approval");
  assert.equal(answered.result, null);
  const approved = await approve(worker, env, created.token, answered, "approve-tv-task");
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.task.phase, "completed");
  assert.equal(approved.task.rootIntent.raw, rootIntent);
  assert.equal(approved.task.outcome.status, "completed");
  assert.equal(approved.task.result.verification.status, "verified");
  assert.ok(approved.task.evidence.some((evidence) => evidence.kind === "receipt" && evidence.verified));
  for (const agentId of [
    "intent-interpreter",
    "commerce-electronics-specialist",
    "retailer-search-agent",
    "logistics-agent",
    "transaction-coordinator",
    "independent-verifier",
  ]) {
    assert.ok(approved.task.assignments.some((assignment) => assignment.agentId === agentId), agentId);
  }
});

test("the airplane case uses the generic purchase contract, not a false planning completion", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env, {
    rootIntent: "buy me an airplane",
    missingFields: [],
    confirmationRequired: true,
    risk: "high",
  });

  assert.equal(created.task.requirementContract.id, "commerce.purchase.generic.v1");
  assert.equal(created.task.phase, "awaiting_human");
  assert.equal(created.task.result, null);
  const answered = await answerAll(worker, env, created, "airplane");
  assert.equal(answered.phase, "awaiting_approval");
  const approved = await approve(worker, env, created.token, answered, "approve-airplane-task");
  assert.equal(approved.task.phase, "completed");
  assert.equal(approved.task.outcome.status, "completed");
  assert.ok(approved.task.evidence.some((evidence) => evidence.kind === "receipt"));
  assert.doesNotMatch(approved.task.result.summary, /specialist agent mesh completed/i);
});

test("stale revisions fail with 409 while command replay is idempotent", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);
  const firstRequirement = created.task.requirements.find((item) => item.status === "unknown");
  const [value, label] = answerFor(firstRequirement);
  const first = await answer(worker, env, created.token, created.task, firstRequirement, value, label, "idempotent-first-answer");
  assert.equal(first.response.status, 200);

  const replayResponse = await worker.fetch(request(`${API}/${created.task.taskId}/answers`, {
    method: "POST",
    headers: auth(created.token),
    body: {
      commandId: "idempotent-first-answer",
      requirementId: firstRequirement.id,
      expectedRevision: created.task.revision,
      value,
      label,
    },
  }), env);
  const replay = await replayResponse.json();
  assert.equal(replayResponse.status, 200);
  assert.equal(replay.task.revision, first.task.revision);

  const nextRequirement = first.task.requirements.find((item) => item.status === "unknown");
  const nextAnswer = answerFor(nextRequirement);
  const staleResponse = await worker.fetch(request(`${API}/${created.task.taskId}/answers`, {
    method: "POST",
    headers: auth(created.token),
    body: {
      commandId: "stale-second-answer",
      requirementId: nextRequirement.id,
      expectedRevision: created.task.revision,
      value: nextAnswer[0],
      label: nextAnswer[1],
    },
  }), env);
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error.code, "revision_conflict");
});

test("event history can be read incrementally by task revision", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env);
  const requirement = created.task.requirements.find((item) => item.status === "unknown");
  const [value, label] = answerFor(requirement);
  const first = await answer(worker, env, created.token, created.task, requirement, value, label, "events-first-answer");
  assert.equal(first.response.status, 200);

  const eventsResponse = await worker.fetch(request(`${API}/${created.task.taskId}/events?afterRevision=${created.task.revision}`, {
    headers: auth(created.token),
  }), env);
  const events = await eventsResponse.json();
  assert.equal(eventsResponse.status, 200);
  assert.ok(events.events.length > 0);
  assert.ok(events.events.every((event) => event.revision > created.task.revision));
});

test("live tasks remain active after confirmation and schedule recovery until a connected executor exists", async () => {
  const worker = deterministicWorker();
  const env = environment();
  const created = await createTask(worker, env, {
    rootIntent: "purchase an industrial robot",
    mode: "live",
    missingFields: [],
    confirmationRequired: true,
    risk: "high",
  });
  const answered = await answerAll(worker, env, created, "live-robot");
  assert.equal(answered.phase, "awaiting_approval");
  const approved = await approve(worker, env, created.token, answered, "approve-live-robot");

  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  assert.notEqual(approved.task.phase, "blocked");
  assert.notEqual(approved.task.phase, "failed");
  assert.equal(approved.task.phase, "coordinating");
  assert.equal(approved.task.result, null);
  assert.equal(approved.task.outcome.status, "waiting_external");
  assert.equal(approved.task.liveness.state, "waiting_external");
  assert.equal(approved.task.liveness.obstacle.recoverable, true);
  assert.ok(approved.task.liveness.nextAttemptAt);

  const storage = env.TASKS.storages.get(created.task.taskId);
  assert.ok(Number.isFinite(storage.alarmAt));

  const resumed = await worker.fetch(request(`${API}/${created.task.taskId}/resume`, {
    method: "POST",
    headers: auth(created.token),
  }), env);
  assert.equal(resumed.status, 200);
  const body = await resumed.json();
  assert.notEqual(body.task.phase, "blocked");
  assert.notEqual(body.task.phase, "failed");
});

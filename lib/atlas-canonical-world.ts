import * as legacy from "./atlas-simulation.ts";
import type { PublicAgentCityPlan } from "./asympta-public-agent-contract.ts";
import {
  advanceAgenticWorldRuntime,
  createAgenticWorldRuntime,
  createRuntimeIntent,
  executeRuntimeIntent,
  explainRuntimeCausality,
  observeRuntime,
  prepareRuntimeForWorkflow,
  recordRuntimeTaskCompletion,
  restoreRuntime,
  runtimeInvariantViolations,
  runtimeSnapshot,
  serializeRuntime,
  validateRuntimeIntent,
  type AgenticWorldRuntimeState,
  type RuntimeIntentResult,
  type RuntimeObservation,
} from "./agentic-world-runtime.ts";

export { ATLAS_AGENTS, ATLAS_LOCATIONS, ATLAS_WORKFLOWS } from "./atlas-simulation.ts";
export type {
  AgentStatus,
  AtlasAgentBlueprint,
  AtlasAgentState,
  AtlasApproval,
  AtlasCityPlanEvidence,
  AtlasEvent,
  AtlasLocation,
  AtlasMessage,
  AtlasTaskBlueprint,
  AtlasWorkflowDefinition,
  ExternalAction,
  GeoPoint,
  StakeholderSide,
  TaskStatus,
  WorkflowId,
  WorldPhase,
} from "./atlas-simulation.ts";

export type AtlasTaskState = legacy.AtlasTaskState & {
  blockingReason?: string;
  runtimeIntentId?: string;
  actualDurationMs?: number;
};

export type AtlasWorldState = Omit<legacy.AtlasWorldState, "tasks"> & {
  tasks: AtlasTaskState[];
  schemaVersion: 2;
  seed: number;
  runtime: AgenticWorldRuntimeState;
  runtimeHistoryCursor: number;
  persistedAt?: number;
};

type LegacyOrCanonicalWorld = legacy.AtlasWorldState | AtlasWorldState;

const STORAGE_KEY = "asympta-world:canonical-v2";
const PERSIST_INTERVAL_MS = 1_500;
let lastPersistedSimulationTime = 0;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isCanonical(value: LegacyOrCanonicalWorld): value is AtlasWorldState {
  const candidate = value as Partial<AtlasWorldState>;
  return candidate.schemaVersion === 2 && Boolean(candidate.runtime?.clock) && Number.isFinite(candidate.seed);
}

function seedFor(value: LegacyOrCanonicalWorld) {
  const candidate = value as Partial<AtlasWorldState>;
  return Number.isFinite(candidate.seed) ? Number(candidate.seed) : 2_026_0830;
}

function runtimeFor(value: LegacyOrCanonicalWorld, resetForWorkflow = false) {
  const seed = seedFor(value);
  if (!resetForWorkflow && isCanonical(value)) return clone(value.runtime);
  const base = createAgenticWorldRuntime(seed, value.now);
  return value.workflowId ? prepareRuntimeForWorkflow(base, value.workflowId, value.now) : base;
}

export function canonicalizeAtlasWorld(value: LegacyOrCanonicalWorld, resetForWorkflow = false): AtlasWorldState {
  const base = clone(value) as legacy.AtlasWorldState;
  const runtime = runtimeFor(value, resetForWorkflow);
  const cursor = resetForWorkflow || !isCanonical(value) ? runtime.history.length : value.runtimeHistoryCursor;
  return {
    ...base,
    tasks: base.tasks as AtlasTaskState[],
    schemaVersion: 2,
    seed: seedFor(value),
    runtime,
    runtimeHistoryCursor: Math.min(cursor, runtime.history.length),
  };
}

function nextBridgeId(world: AtlasWorldState, prefix: string) {
  world.revision += 1;
  return `${prefix}-v2-${world.revision.toString(36)}-${Math.floor(world.now).toString(36)}`;
}

function pushBridgeEvent(world: AtlasWorldState, title: string, detail: string, agentId?: string, taskId?: string) {
  world.events = [
    {
      id: nextBridgeId(world, "event"),
      title,
      detail,
      createdAt: world.now,
      agentId,
      taskId,
    },
    ...world.events,
  ].slice(0, 120);
}

function pushBridgeMessage(world: AtlasWorldState, fromAgentId: string, toAgentId: string, text: string) {
  world.messages = [
    ...world.messages,
    {
      id: nextBridgeId(world, "message"),
      fromAgentId,
      toAgentId,
      text,
      createdAt: world.now,
      expiresAt: world.now + 4_600,
    },
  ].slice(-24);
}

function bridgeRuntimeHistory(world: AtlasWorldState) {
  const start = Math.max(0, Math.min(world.runtimeHistoryCursor, world.runtime.history.length));
  const events = world.runtime.history.slice(start);
  for (const event of events) {
    if (["task_completed", "information_published", "information_sent"].includes(event.type)) continue;
    pushBridgeEvent(world, event.title, event.detail, event.actorId, undefined);
  }
  world.runtimeHistoryCursor = world.runtime.history.length;
}

function runtimeIntentForAction(world: AtlasWorldState, action: legacy.ExternalAction, actorId: string, reason?: string) {
  const order = world.runtime.orders.at(-1);
  const common = { reason: reason ?? "Approved through the Asympta World action boundary." };
  if (action === "reserve_capacity") {
    return createRuntimeIntent(world.runtime, actorId, action, {
      ...common,
      targetId: "supplier-primary",
      resourceId: order?.resourceId ?? "world-material",
      quantity: order?.quantity ?? 1,
    });
  }
  if (action === "authorize_payment") {
    return createRuntimeIntent(world.runtime, actorId, action, {
      ...common,
      targetId: order?.sellerId ?? "agent-business",
      amount: order ? order.quantity * order.unitPrice : 0,
    });
  }
  if (action === "release_shipment") {
    return createRuntimeIntent(world.runtime, actorId, action, {
      ...common,
      targetId: order?.buyerId ?? "agent-customer",
      resourceId: order?.resourceId ?? "world-material",
      quantity: order?.quantity ?? 1,
    });
  }
  return createRuntimeIntent(world.runtime, actorId, action, {
    ...common,
    targetId: order?.buyerId ?? "agent-customer",
    parameters: { orderId: order?.id ?? null, value: `Status update for ${order?.id ?? "active workflow"}` },
  });
}

function applyApprovedRuntimeAction(
  current: AtlasWorldState,
  action: legacy.ExternalAction,
  actorId: string,
  reason?: string,
): { world: AtlasWorldState; result: RuntimeIntentResult } {
  const world = canonicalizeAtlasWorld(current);
  const intent = runtimeIntentForAction(world, action, actorId, reason);
  const executed = executeRuntimeIntent(world.runtime, intent);
  world.runtime = executed.world;
  bridgeRuntimeHistory(world);
  return { world, result: executed.result };
}

function markRuntimeRejection(world: AtlasWorldState, taskId: string | undefined, actorId: string | undefined, result: RuntimeIntentResult) {
  const reason = result.validation.reason || "The world rejected the requested state transition.";
  if (taskId) {
    const task = world.tasks.find((item) => item.id === taskId);
    if (task) {
      task.status = "blocked";
      task.blockingReason = reason;
      task.runtimeIntentId = result.intent.id;
    }
  }
  if (actorId) {
    const agent = world.agents.find((item) => item.id === actorId);
    if (agent) agent.status = "waiting";
  }
  world.phase = "blocked";
  pushBridgeEvent(world, "World rejected intent", reason, actorId, taskId);
}

function markRuntimeSuccess(world: AtlasWorldState, taskId: string | undefined, actorId: string | undefined, result: RuntimeIntentResult) {
  if (taskId) {
    const task = world.tasks.find((item) => item.id === taskId);
    if (task) task.runtimeIntentId = result.intent.id;
  }
  if (result.adaptedFrom && result.selectedTargetId) {
    const message = `Constraint detected at ${result.adaptedFrom}; the world selected ${result.selectedTargetId} as a feasible alternative.`;
    pushBridgeEvent(world, "Agent plan adapted to world constraints", message, actorId, taskId);
    if (actorId) pushBridgeMessage(world, actorId, "agent-operations", message);
  }
}

function recordNewlyCompletedTasks(before: AtlasWorldState, after: AtlasWorldState) {
  const beforeDone = new Set(before.tasks.filter((task) => task.status === "done").map((task) => task.id));
  for (const task of after.tasks) {
    if (task.status !== "done" || beforeDone.has(task.id)) continue;
    task.actualDurationMs = task.startedAt == null ? undefined : Math.max(0, after.now - task.startedAt);
    const dependentAgentIds = [...new Set(after.tasks
      .filter((candidate) => candidate.dependsOn.includes(task.id) && candidate.agentId !== task.agentId)
      .map((candidate) => candidate.agentId))];
    after.runtime = recordRuntimeTaskCompletion(after.runtime, {
      taskId: task.id,
      title: task.title,
      agentId: task.agentId,
      dependentAgentIds,
    });
  }
}

function persistMaybe(world: AtlasWorldState, force = false) {
  if (!force && world.now - lastPersistedSimulationTime < PERSIST_INTERVAL_MS) return;
  if (typeof localStorage === "undefined") return;
  try {
    const snapshot = clone(world);
    snapshot.persistedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: "asympta-atlas-world", version: 2, world: snapshot }));
    lastPersistedSimulationTime = world.now;
  } catch {
    // Persistence is best-effort; simulation truth remains in memory if storage is unavailable.
  }
}

export function persistAtlasWorld(world: AtlasWorldState) {
  persistMaybe(canonicalizeAtlasWorld(world), true);
}

export function loadPersistedAtlasWorld(): AtlasWorldState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return restoreAtlasWorld(raw);
  } catch {
    return null;
  }
}

export function clearPersistedAtlasWorld() {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
}

export function createAtlasWorld(now = Date.now(), seed = 2_026_0830): AtlasWorldState {
  const base = legacy.createAtlasWorld(now);
  return {
    ...base,
    tasks: base.tasks as AtlasTaskState[],
    schemaVersion: 2,
    seed,
    runtime: createAgenticWorldRuntime(seed, now),
    runtimeHistoryCursor: 0,
  };
}

export function workflowFor(id: legacy.WorkflowId) {
  return legacy.workflowFor(id);
}

export function startAtlasWorkflow(current: LegacyOrCanonicalWorld, workflowId: legacy.WorkflowId) {
  const canonical = canonicalizeAtlasWorld(current);
  const base = legacy.startAtlasWorkflow(canonical, workflowId);
  const seeded = {
    ...base,
    schemaVersion: 2 as const,
    seed: canonical.seed,
    runtime: canonical.runtime,
    runtimeHistoryCursor: 0,
  } as AtlasWorldState;
  const next = canonicalizeAtlasWorld(seeded, true);
  bridgeRuntimeHistory(next);
  persistMaybe(next, true);
  return next;
}

export function advanceAtlasWorld(current: LegacyOrCanonicalWorld, deltaMs: number) {
  const before = canonicalizeAtlasWorld(current);
  const safeDelta = Math.min(140, Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0));
  const base = legacy.advanceAtlasWorld(before, safeDelta);
  const after = canonicalizeAtlasWorld(base);
  after.runtime = advanceAgenticWorldRuntime(before.runtime, safeDelta);
  after.now = after.runtime.clock.now;
  recordNewlyCompletedTasks(before, after);
  bridgeRuntimeHistory(after);
  const violations = runtimeInvariantViolations(after.runtime);
  if (violations.length) {
    after.phase = "blocked";
    pushBridgeEvent(after, "World invariant violation", violations.join(" · "));
  }
  persistMaybe(after);
  return after;
}

export function resolveAtlasApproval(current: LegacyOrCanonicalWorld, approvalId: string, approved: boolean) {
  const before = canonicalizeAtlasWorld(current);
  const approval = before.approvals.find((item) => item.id === approvalId && item.status === "pending");
  if (!approval) return before;

  let runtimeWorld = before;
  let runtimeResult: RuntimeIntentResult | null = null;
  if (approved && approval.actionType && approval.agentId) {
    const applied = applyApprovedRuntimeAction(before, approval.actionType, approval.agentId, approval.detail);
    runtimeWorld = applied.world;
    runtimeResult = applied.result;
  }

  const legacyResolved = legacy.resolveAtlasApproval(runtimeWorld, approvalId, approved);
  const after = canonicalizeAtlasWorld(legacyResolved);
  after.seed = before.seed;
  if (approved && approval.kind === "webmcp-start" && approval.workflowId) {
    after.runtime = prepareRuntimeForWorkflow(createAgenticWorldRuntime(before.seed, after.now), approval.workflowId, after.now);
    after.runtimeHistoryCursor = 0;
  } else {
    after.runtime = runtimeWorld.runtime;
    after.runtimeHistoryCursor = runtimeWorld.runtimeHistoryCursor;
  }

  if (runtimeResult) {
    if (runtimeResult.ok) markRuntimeSuccess(after, approval.taskId, approval.agentId, runtimeResult);
    else markRuntimeRejection(after, approval.taskId, approval.agentId, runtimeResult);
  }
  bridgeRuntimeHistory(after);
  persistMaybe(after, true);
  return after;
}

export function applyAtlasCityPlan(
  current: LegacyOrCanonicalWorld,
  requestId: string,
  plan: PublicAgentCityPlan,
) {
  const before = canonicalizeAtlasWorld(current);
  const next = canonicalizeAtlasWorld(legacy.applyAtlasCityPlan(before, requestId, plan));
  next.runtime = before.runtime;
  next.runtimeHistoryCursor = before.runtimeHistoryCursor;
  persistMaybe(next, true);
  return next;
}

export function requestWebMcpWorkflow(current: LegacyOrCanonicalWorld, workflowId: legacy.WorkflowId) {
  const before = canonicalizeAtlasWorld(current);
  const next = canonicalizeAtlasWorld(legacy.requestWebMcpWorkflow(before, workflowId));
  next.runtime = before.runtime;
  next.runtimeHistoryCursor = before.runtimeHistoryCursor;
  persistMaybe(next, true);
  return next;
}

export function requestWebMcpAction(current: LegacyOrCanonicalWorld, actionType: legacy.ExternalAction, agentId: string, reason: string) {
  const before = canonicalizeAtlasWorld(current);
  const next = canonicalizeAtlasWorld(legacy.requestWebMcpAction(before, actionType, agentId, reason));
  next.runtime = before.runtime;
  next.runtimeHistoryCursor = before.runtimeHistoryCursor;
  const preview = runtimeIntentForAction(next, actionType, agentId, reason);
  const validation = validateRuntimeIntent(next.runtime, preview);
  const pending = [...next.approvals].reverse().find((item) => item.actionType === actionType && item.status === "pending");
  if (pending && !validation.allowed) {
    pending.detail = `${pending.detail} World preflight: ${validation.reason}${validation.possibleAlternatives.length ? ` Alternatives: ${validation.possibleAlternatives.join(", ")}.` : ""}`;
  }
  persistMaybe(next, true);
  return next;
}

export function atlasAgentObservation(current: LegacyOrCanonicalWorld, agentId: string): RuntimeObservation {
  const world = canonicalizeAtlasWorld(current);
  return observeRuntime(world.runtime, agentId);
}

export function atlasInvariantViolations(current: LegacyOrCanonicalWorld) {
  return runtimeInvariantViolations(canonicalizeAtlasWorld(current).runtime);
}

export function explainAtlasCausality(current: LegacyOrCanonicalWorld, eventId?: string) {
  return explainRuntimeCausality(canonicalizeAtlasWorld(current).runtime, eventId);
}

export function atlasSnapshot(current: LegacyOrCanonicalWorld) {
  const world = canonicalizeAtlasWorld(current);
  const base = legacy.atlasSnapshot(world);
  return {
    ...base,
    schemaVersion: world.schemaVersion,
    seed: world.seed,
    runtime: runtimeSnapshot(world.runtime),
  };
}

export function serializeAtlasWorld(current: LegacyOrCanonicalWorld) {
  const world = canonicalizeAtlasWorld(current);
  return JSON.stringify({
    schema: "asympta-atlas-world",
    version: 2,
    world: {
      ...world,
      runtimeSerialized: serializeRuntime(world.runtime),
    },
  });
}

export function restoreAtlasWorld(serialized: string): AtlasWorldState | null {
  try {
    const parsed = JSON.parse(serialized) as { schema?: unknown; version?: unknown; world?: Record<string, unknown> };
    if (parsed.schema !== "asympta-atlas-world" || parsed.version !== 2 || !parsed.world) return null;
    const raw = parsed.world;
    const restoredRuntime = typeof raw.runtimeSerialized === "string"
      ? restoreRuntime(raw.runtimeSerialized)
      : raw.runtime && typeof raw.runtime === "object"
        ? restoreRuntime(JSON.stringify({ schema: "asympta-agentic-world", version: 1, world: raw.runtime }))
        : null;
    if (!restoredRuntime) return null;
    const legacyShape = raw as unknown as legacy.AtlasWorldState;
    if (!Array.isArray(legacyShape.tasks) || !Array.isArray(legacyShape.agents) || !Array.isArray(legacyShape.events)) return null;
    const world = canonicalizeAtlasWorld(legacyShape);
    world.runtime = restoredRuntime;
    world.runtimeHistoryCursor = Math.min(Number(raw.runtimeHistoryCursor ?? restoredRuntime.history.length), restoredRuntime.history.length);
    world.seed = Number(raw.seed ?? restoredRuntime.seed);
    world.schemaVersion = 2;
    world.persistedAt = typeof raw.persistedAt === "number" ? raw.persistedAt : undefined;
    return runtimeInvariantViolations(world.runtime).length ? null : world;
  } catch {
    return null;
  }
}

import * as runtime from "./atlas-simulation-runtime.ts";
import { currentAtlasLocale, localizeAtlasSnapshot, localizeWorkflow } from "./atlas-i18n.ts";

export const ATLAS_AGENTS = runtime.ATLAS_AGENTS;
export const ATLAS_LOCATIONS = runtime.ATLAS_LOCATIONS;

export const ATLAS_WORKFLOWS = runtime.ATLAS_WORKFLOWS.map((base) => {
  const value = { ...base } as typeof base;
  Object.defineProperties(value, {
    name: { enumerable: true, configurable: true, get: () => localizeWorkflow(base.id, currentAtlasLocale(), base).name },
    summary: { enumerable: true, configurable: true, get: () => localizeWorkflow(base.id, currentAtlasLocale(), base).summary },
    outcome: { enumerable: true, configurable: true, get: () => localizeWorkflow(base.id, currentAtlasLocale(), base).outcome },
  });
  return value;
});

export type {
  AtlasAgentState,
  AtlasApproval,
  AtlasEvent,
  AtlasMessage,
  AtlasSchedulerState,
  AtlasTaskRuntime,
  AtlasTaskState,
  AtlasWorldState,
  ExternalAction,
  GeoPoint,
  ScheduleHealth,
  StakeholderSide,
  WorkflowId,
} from "./atlas-simulation-runtime.ts";

declare global {
  interface Window {
    __ASYMPTA_EXPLORE_MODE__?: boolean;
  }
}

function preferredExploreMode() {
  if (typeof window === "undefined") return undefined;
  return typeof window.__ASYMPTA_EXPLORE_MODE__ === "boolean" ? window.__ASYMPTA_EXPLORE_MODE__ : undefined;
}

function applyPreference(world: runtime.AtlasWorldState) {
  const preference = preferredExploreMode();
  if (preference === undefined || world.scheduler?.exploreMode === preference) return world;
  return runtime.setExploreMode(world, preference);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function timeMetrics(world: runtime.AtlasWorldState, taskId: string) {
  const task = world.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return null;

  const progress = task.status === "done" ? 1 : clamp01(task.progress);
  const rate = Math.max(0.5, task.runtime?.rateMultiplier || 1);
  const activeElapsedMs = progress * task.workMs;
  const activeRemainingMs = task.status === "done" ? 0 : ((1 - progress) * task.workMs) / rate;
  const obstacleRemainingMs = task.runtime?.obstacleUntil ? Math.max(0, task.runtime.obstacleUntil - world.now) : 0;
  const remainingMs = task.status === "waiting_approval" ? null : activeRemainingMs + obstacleRemainingMs;
  const estimatedTotalMs = remainingMs === null ? null : activeElapsedMs + remainingMs;

  return {
    progress: Number(progress.toFixed(3)),
    progressPercent: Math.round(progress * 100),
    progressBasis: "effective_active_time" as const,
    activeElapsedSeconds: Number((activeElapsedMs / 1000).toFixed(1)),
    remainingSeconds: remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000)),
    estimatedTotalSeconds: estimatedTotalMs === null ? null : Number((estimatedTotalMs / 1000).toFixed(1)),
  };
}

export function setExplorePreference(enabled: boolean) {
  if (typeof window !== "undefined") window.__ASYMPTA_EXPLORE_MODE__ = enabled;
  return enabled;
}

export function createAtlasWorld(now = Date.now()) {
  return applyPreference(runtime.createAtlasWorld(now));
}

export function startAtlasWorkflow(current: runtime.AtlasWorldState, workflowId: runtime.WorkflowId) {
  return applyPreference(runtime.startAtlasWorkflow(current, workflowId));
}

export function advanceAtlasWorld(current: runtime.AtlasWorldState, deltaMs: number) {
  return applyPreference(runtime.advanceAtlasWorld(current, deltaMs));
}

export function resolveAtlasApproval(current: runtime.AtlasWorldState, approvalId: string, approved: boolean) {
  return applyPreference(runtime.resolveAtlasApproval(current, approvalId, approved));
}

export function requestWebMcpWorkflow(current: runtime.AtlasWorldState, workflowId: runtime.WorkflowId) {
  return applyPreference(runtime.requestWebMcpWorkflow(current, workflowId));
}

export function requestWebMcpAction(current: runtime.AtlasWorldState, actionType: runtime.ExternalAction, agentId: string, reason: string) {
  return applyPreference(runtime.requestWebMcpAction(current, actionType, agentId, reason));
}

export function setExploreMode(current: runtime.AtlasWorldState, enabled: boolean) {
  setExplorePreference(enabled);
  return runtime.setExploreMode(current, enabled);
}

export function taskScheduleForAgent(world: runtime.AtlasWorldState, agentId: string) {
  const row = runtime.taskScheduleForAgent(world, agentId);
  if (!row) return null;
  return { ...row, ...timeMetrics(world, row.taskId) };
}

export function scheduledTaskRows(world: runtime.AtlasWorldState, limit = 8) {
  return runtime.scheduledTaskRows(world, limit).map((row) => ({
    ...row,
    ...timeMetrics(world, row.id),
  }));
}

export function workflowFor(id: runtime.WorkflowId) {
  return ATLAS_WORKFLOWS.find((workflow) => workflow.id === id) ?? ATLAS_WORKFLOWS[0];
}

export function atlasSnapshot(world: runtime.AtlasWorldState) {
  const snapshot = runtime.atlasSnapshot(world);
  const timed = {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => ({ ...task, ...timeMetrics(world, task.id) })),
    scheduler: {
      ...snapshot.scheduler,
      active: scheduledTaskRows(world, 10),
    },
  };
  return localizeAtlasSnapshot(timed, currentAtlasLocale());
}

import "./atlas-workflow-expansion.ts";
import { ATLAS_AGENTS, ATLAS_LOCATIONS, ATLAS_WORKFLOWS } from "./atlas-simulation.ts";

const SPEED = 0.0000028;
const ARRIVAL = 0.00034;
const LOCATION_IDS = Object.keys(ATLAS_LOCATIONS);

type Point = { lon: number; lat: number };
export type LiveTaskTimingState = { id: string; agentId: string; status: string; progress: number; approvalStatus?: string | null };
export type LiveAgentTimingState = { id: string; lon: number; lat: number };
export type LiveWorkflowTimingSnapshot = { tasks?: LiveTaskTimingState[]; agents?: LiveAgentTimingState[] };
export type WorkflowTimingEstimate = { totalMs: number; travelMs: number; workMs: number; approvalTravelMs: number; approvalCount: number };
export type WorkflowRemainingEstimate = WorkflowTimingEstimate & { completedTasks: number; totalTasks: number };

const CACHE = new Map<string, WorkflowTimingEstimate>();

function distance(a?: Point, b?: Point) {
  if (!a || !b) return 0;
  const scale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * scale, a.lat - b.lat);
}

function travel(a?: Point, b?: Point) {
  const value = distance(a, b);
  return value <= ARRIVAL ? 0 : Math.max(0, value - ARRIVAL) / SPEED;
}

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function demoOrigin(taskId: string, destinationId: string) {
  const candidates = LOCATION_IDS.filter((id) => id !== destinationId);
  return ATLAS_LOCATIONS[candidates[hash(taskId) % candidates.length]]?.point;
}

function definition(name?: string | null) {
  return name ? ATLAS_WORKFLOWS.find((item) => item.id === name || item.name === name) ?? null : null;
}

function agentHome(agentId: string) {
  const agent = ATLAS_AGENTS.find((item) => item.id === agentId);
  return agent ? ATLAS_LOCATIONS[agent.homeLocationId]?.point : undefined;
}

export function estimateWorkflowTiming(name?: string | null): WorkflowTimingEstimate {
  const workflow = definition(name);
  if (!workflow) return { totalMs: 0, travelMs: 0, workMs: 0, approvalTravelMs: 0, approvalCount: 0 };
  const cached = CACHE.get(workflow.id);
  if (cached) return cached;

  const finish = new Map<string, number>();
  const previous = new Map<string, (typeof workflow.tasks)[number]>();
  let travelMs = 0;
  let workMs = 0;
  let approvalCount = 0;

  for (const task of workflow.tasks) {
    const prior = previous.get(task.agentId);
    const deps = prior && !task.dependsOn.includes(prior.id) ? [...task.dependsOn, prior.id] : task.dependsOn;
    const ready = deps.reduce((value, id) => Math.max(value, finish.get(id) ?? 0), 0);
    const destination = ATLAS_LOCATIONS[task.locationId]?.point;
    const origin = !prior && task.dependsOn.length === 0 ? demoOrigin(task.id, task.locationId) : prior ? ATLAS_LOCATIONS[prior.locationId]?.point : agentHome(task.agentId);
    const inbound = travel(origin, destination);
    travelMs += inbound;
    workMs += Math.max(0, task.workMs);
    if (task.requiresApproval) approvalCount += 1;
    finish.set(task.id, ready + inbound + Math.max(0, task.workMs));
    previous.set(task.agentId, task);
  }

  const value = {
    totalMs: Math.round(Math.max(0, ...finish.values())),
    travelMs: Math.round(travelMs),
    workMs: Math.round(workMs),
    approvalTravelMs: 0,
    approvalCount,
  };
  CACHE.set(workflow.id, value);
  return value;
}

export function estimateWorkflowTotalMs(name?: string | null) {
  return estimateWorkflowTiming(name).totalMs;
}

function livePoint(snapshot: LiveWorkflowTimingSnapshot, agentId: string) {
  const agent = snapshot.agents?.find((item) => item.id === agentId);
  return agent && Number.isFinite(agent.lon) && Number.isFinite(agent.lat) ? { lon: agent.lon, lat: agent.lat } : undefined;
}

function progress(value: number | undefined) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value ?? 0 : 0));
}

/**
 * Recalculates the remaining critical path from live task state. Human decision
 * latency is excluded. Approval resumes work at the checkpoint where the agent
 * is already waiting, so it never adds a second travel leg.
 *
 * `postApprovalTaskIds` remains in the signature for compatibility with older
 * UI callers; it no longer changes timing because approved tasks do not replay
 * movement.
 */
export function estimateWorkflowRemainingTiming(
  name: string | null | undefined,
  snapshot: LiveWorkflowTimingSnapshot,
  postApprovalTaskIds: ReadonlySet<string> = new Set(),
): WorkflowRemainingEstimate {
  void postApprovalTaskIds;
  const workflow = definition(name);
  if (!workflow) return { totalMs: 0, travelMs: 0, workMs: 0, approvalTravelMs: 0, approvalCount: 0, completedTasks: 0, totalTasks: 0 };

  const state = new Map((snapshot.tasks ?? []).map((item) => [item.id, item]));
  const finish = new Map<string, number>();
  const previous = new Map<string, (typeof workflow.tasks)[number]>();
  let travelMs = 0;
  let workMs = 0;
  let completedTasks = 0;

  for (const task of workflow.tasks) {
    const current = state.get(task.id);
    const status = current?.status ?? "queued";
    const prior = previous.get(task.agentId);
    const deps = prior && !task.dependsOn.includes(prior.id) ? [...task.dependsOn, prior.id] : task.dependsOn;
    const ready = deps.reduce((value, id) => Math.max(value, finish.get(id) ?? 0), 0);

    if (status === "done") {
      completedTasks += 1;
      finish.set(task.id, 0);
      previous.set(task.agentId, task);
      continue;
    }

    const destination = ATLAS_LOCATIONS[task.locationId]?.point;
    const work = status === "working" ? Math.max(0, task.workMs * (1 - progress(current?.progress))) : Math.max(0, task.workMs);
    let inbound = 0;

    if (status === "moving") {
      inbound = travel(livePoint(snapshot, task.agentId), destination);
    } else if (status !== "working" && status !== "waiting_approval") {
      const origin = prior
        ? ATLAS_LOCATIONS[prior.locationId]?.point
        : task.dependsOn.length === 0
          ? demoOrigin(task.id, task.locationId)
          : livePoint(snapshot, task.agentId) ?? agentHome(task.agentId);
      inbound = travel(origin, destination);
    }

    travelMs += inbound;
    workMs += work;
    finish.set(task.id, ready + inbound + work);
    previous.set(task.agentId, task);
  }

  return {
    totalMs: Math.round(Math.max(0, ...finish.values())),
    travelMs: Math.round(travelMs),
    workMs: Math.round(workMs),
    approvalTravelMs: 0,
    approvalCount: workflow.tasks.filter((task) => task.requiresApproval).length,
    completedTasks,
    totalTasks: workflow.tasks.length,
  };
}

export function estimateWorkflowRemainingMs(name: string | null | undefined, snapshot: LiveWorkflowTimingSnapshot, postApprovalTaskIds: ReadonlySet<string> = new Set()) {
  return estimateWorkflowRemainingTiming(name, snapshot, postApprovalTaskIds).totalMs;
}

import { ATLAS_AGENTS, ATLAS_LOCATIONS, ATLAS_WORKFLOWS } from "@/lib/atlas-simulation";

export type DisplayTask = {
  id: string;
  agentId: string;
  status: string;
  progress: number;
  locationId?: string;
  workMs?: number;
};

export type DisplayAgent = {
  id: string;
  lon: number;
  lat: number;
  status: string;
};

export type EstimatedTaskProgress = {
  percent: number;
  totalMs: number;
  remainingMs: number;
  travelTotalMs: number;
  travelRemainingMs: number;
  workTotalMs: number;
};

// Mirrors the stable simulation engine. This is display-only and never advances world state.
const TRAVEL_DEGREES_PER_MS = 0.0000028;
const ARRIVAL_DISTANCE = 0.00034;
const UNKNOWN_WORK_MS = 2_000;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function coordinateDistance(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const lonScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * lonScale, a.lat - b.lat);
}

function taskDefinition(taskId: string) {
  for (const workflow of ATLAS_WORKFLOWS) {
    const index = workflow.tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) return { workflow, index, task: workflow.tasks[index] };
  }
  return null;
}

function taskDestination(taskState: DisplayTask) {
  const context = taskDefinition(taskState.id);
  const locationId = context?.task.locationId ?? taskState.locationId;
  return locationId ? ATLAS_LOCATIONS[locationId]?.point ?? null : null;
}

function startPoint(taskId: string, taskStates: DisplayTask[]) {
  const context = taskDefinition(taskId);
  if (!context) return null;
  const { workflow, index, task } = context;
  const stateById = new Map(taskStates.map((state) => [state.id, state]));

  for (let candidateIndex = index - 1; candidateIndex >= 0; candidateIndex -= 1) {
    const candidate = workflow.tasks[candidateIndex];
    if (candidate.agentId !== task.agentId) continue;
    if (stateById.get(candidate.id)?.status !== "done") continue;
    return ATLAS_LOCATIONS[candidate.locationId]?.point ?? null;
  }

  const agent = ATLAS_AGENTS.find((candidate) => candidate.id === task.agentId);
  return agent ? ATLAS_LOCATIONS[agent.homeLocationId]?.point ?? null : null;
}

export function currentTaskTravelDistance(
  taskState: DisplayTask,
  agentState: DisplayAgent | undefined,
) {
  if (!agentState) return null;
  const destination = taskDestination(taskState);
  if (!destination) return null;
  return coordinateDistance(agentState, destination);
}

export function estimateTaskProgress(
  taskState: DisplayTask,
  agentState: DisplayAgent | undefined,
  taskStates: DisplayTask[],
  actualTravelOriginDistance?: number,
): EstimatedTaskProgress {
  if (taskState.status === "done") {
    return { percent: 100, totalMs: 0, remainingMs: 0, travelTotalMs: 0, travelRemainingMs: 0, workTotalMs: 0 };
  }

  const context = taskDefinition(taskState.id);
  const destination = taskDestination(taskState);
  const fallbackOrigin = context ? startPoint(taskState.id, taskStates) : null;
  const workTotalMs = Math.max(1, context?.task.workMs ?? taskState.workMs ?? UNKNOWN_WORK_MS);

  let travelTotalMs = 0;
  let travelRemainingMs = 0;
  let travelCompletedMs = 0;

  if (destination) {
    const fallbackDistance = fallbackOrigin ? coordinateDistance(fallbackOrigin, destination) : 0;
    const measuredOriginDistance = Number.isFinite(actualTravelOriginDistance)
      ? Math.max(0, actualTravelOriginDistance ?? 0)
      : 0;
    const currentDistance = agentState ? coordinateDistance(agentState, destination) : 0;
    const routeDistance = measuredOriginDistance > ARRIVAL_DISTANCE
      ? measuredOriginDistance
      : fallbackDistance > ARRIVAL_DISTANCE
        ? fallbackDistance
        : currentDistance;
    const effectiveDistance = routeDistance <= ARRIVAL_DISTANCE ? 0 : routeDistance;
    travelTotalMs = effectiveDistance / TRAVEL_DEGREES_PER_MS;

    if (taskState.status === "queued") {
      travelRemainingMs = travelTotalMs;
    } else if (taskState.status === "moving" && agentState) {
      const remainingDistance = Math.min(effectiveDistance, currentDistance);
      travelRemainingMs = remainingDistance / TRAVEL_DEGREES_PER_MS;
      travelCompletedMs = Math.max(0, travelTotalMs - travelRemainingMs);
    } else {
      travelCompletedMs = travelTotalMs;
    }
  }

  let workCompletedMs = 0;
  if (taskState.status === "working") workCompletedMs = clamp01(taskState.progress) * workTotalMs;

  // If a dynamic task has no location metadata, retain the canonical task progress
  // rather than inventing movement. Dynamic world tasks that expose locationId get
  // the same distance-based travel estimate as built-in workflows.
  if (!context && !destination) {
    const percent = Math.round(clamp01(taskState.progress) * 100);
    return { percent, totalMs: workTotalMs, remainingMs: Math.round((1 - clamp01(taskState.progress)) * workTotalMs), travelTotalMs: 0, travelRemainingMs: 0, workTotalMs };
  }

  const totalMs = Math.max(1, travelTotalMs + workTotalMs);
  const completedMs = Math.min(totalMs, travelCompletedMs + workCompletedMs);
  const remainingMs = Math.max(0, totalMs - completedMs);

  return {
    percent: Math.round((completedMs / totalMs) * 100),
    totalMs: Math.round(totalMs),
    remainingMs: Math.round(remainingMs),
    travelTotalMs: Math.round(travelTotalMs),
    travelRemainingMs: Math.round(travelRemainingMs),
    workTotalMs: Math.round(workTotalMs),
  };
}

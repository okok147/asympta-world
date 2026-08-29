import { ATLAS_AGENTS, ATLAS_LOCATIONS, ATLAS_WORKFLOWS } from "./atlas-simulation.ts";

const TRAVEL_DEGREES_PER_MS = 0.0000028;
const ARRIVAL_DISTANCE = 0.00034;
const LOCATION_IDS = Object.keys(ATLAS_LOCATIONS);

export type WorkflowTimingEstimate = {
  totalMs: number;
  travelMs: number;
  workMs: number;
  approvalTravelMs: number;
  approvalCount: number;
};

const CACHE = new Map<string, WorkflowTimingEstimate>();

function coordinateDistance(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const lonScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * lonScale, a.lat - b.lat);
}

function travelMs(origin: { lon: number; lat: number } | undefined, destination: { lon: number; lat: number } | undefined) {
  if (!origin || !destination) return 0;
  const distance = coordinateDistance(origin, destination);
  if (distance <= ARRIVAL_DISTANCE) return 0;
  return Math.max(0, distance - ARRIVAL_DISTANCE) / TRAVEL_DEGREES_PER_MS;
}

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

// Mirrors atlas-demo.ts exactly: the demo intentionally relocates fresh active tasks
// to a visible origin so users can see agents travel on the map.
function demoVisibleOrigin(taskId: string, destinationId: string) {
  const candidates = LOCATION_IDS.filter((id) => id !== destinationId);
  const originId = candidates[hash(taskId) % candidates.length];
  return ATLAS_LOCATIONS[originId]?.point;
}

function workflowForName(workflowName: string | null | undefined) {
  if (!workflowName) return null;
  return ATLAS_WORKFLOWS.find((candidate) => candidate.name === workflowName || candidate.id === workflowName) ?? null;
}

export function estimateWorkflowTiming(workflowName: string | null | undefined): WorkflowTimingEstimate {
  const workflow = workflowForName(workflowName);
  if (!workflow) return { totalMs: 0, travelMs: 0, workMs: 0, approvalTravelMs: 0, approvalCount: 0 };

  const cached = CACHE.get(workflow.id);
  if (cached) return cached;

  const endByTask = new Map<string, number>();
  const previousTaskByAgent = new Map<string, { id: string; locationId: string }>();
  let totalTravelMs = 0;
  let totalWorkMs = 0;
  let totalApprovalTravelMs = 0;
  let approvalCount = 0;

  for (const task of workflow.tasks) {
    const agent = ATLAS_AGENTS.find((candidate) => candidate.id === task.agentId);
    const previousAgentTask = previousTaskByAgent.get(task.agentId);
    const dependencyIds = [...task.dependsOn];
    if (previousAgentTask && !dependencyIds.includes(previousAgentTask.id)) dependencyIds.push(previousAgentTask.id);
    const readyAtMs = dependencyIds.reduce((latest, dependencyId) => Math.max(latest, endByTask.get(dependencyId) ?? 0), 0);

    const destination = ATLAS_LOCATIONS[task.locationId]?.point;
    let origin: { lon: number; lat: number } | undefined;

    // At demo start, root tasks that immediately become active are deliberately moved to a
    // deterministic visible origin. Later first-use agents remain at home until their task starts.
    if (!previousAgentTask && task.dependsOn.length === 0) {
      origin = demoVisibleOrigin(task.id, task.locationId);
    } else if (previousAgentTask) {
      origin = ATLAS_LOCATIONS[previousAgentTask.locationId]?.point;
    } else if (agent) {
      origin = ATLAS_LOCATIONS[agent.homeLocationId]?.point;
    }

    const inboundTravelMs = travelMs(origin, destination);
    const workMs = Math.max(0, task.workMs);

    // Demo approvals intentionally create a second visible travel leg after approval:
    // resolveAtlasDemoApproval relocates the approved task to `${task.id}-approval` origin.
    const approvalTravelMs = task.requiresApproval
      ? travelMs(demoVisibleOrigin(`${task.id}-approval`, task.locationId), destination)
      : 0;

    if (task.requiresApproval) approvalCount += 1;
    totalTravelMs += inboundTravelMs;
    totalApprovalTravelMs += approvalTravelMs;
    totalWorkMs += workMs;

    endByTask.set(task.id, readyAtMs + inboundTravelMs + approvalTravelMs + workMs);
    previousTaskByAgent.set(task.agentId, { id: task.id, locationId: task.locationId });
  }

  const estimate = {
    totalMs: Math.round(Math.max(0, ...endByTask.values())),
    travelMs: Math.round(totalTravelMs),
    workMs: Math.round(totalWorkMs),
    approvalTravelMs: Math.round(totalApprovalTravelMs),
    approvalCount,
  };
  CACHE.set(workflow.id, estimate);
  return estimate;
}

export function estimateWorkflowTotalMs(workflowName: string | null | undefined) {
  return estimateWorkflowTiming(workflowName).totalMs;
}

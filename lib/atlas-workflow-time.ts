import { ATLAS_AGENTS, ATLAS_LOCATIONS, ATLAS_WORKFLOWS } from "@/lib/atlas-simulation";

const TRAVEL_DEGREES_PER_MS = 0.0000028;
const ARRIVAL_DISTANCE = 0.00034;

function coordinateDistance(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const lonScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * lonScale, a.lat - b.lat);
}

export function estimateWorkflowTotalMs(workflowName: string | null | undefined) {
  if (!workflowName) return 0;
  const workflow = ATLAS_WORKFLOWS.find((candidate) => candidate.name === workflowName || candidate.id === workflowName);
  if (!workflow) return 0;

  const endByTask = new Map<string, number>();
  const previousTaskByAgent = new Map<string, { id: string; locationId: string }>();

  for (const task of workflow.tasks) {
    const agent = ATLAS_AGENTS.find((candidate) => candidate.id === task.agentId);
    const previousAgentTask = previousTaskByAgent.get(task.agentId);
    const originLocationId = previousAgentTask?.locationId ?? agent?.homeLocationId;
    const origin = originLocationId ? ATLAS_LOCATIONS[originLocationId]?.point : undefined;
    const destination = ATLAS_LOCATIONS[task.locationId]?.point;

    const travelDistance = origin && destination
      ? Math.max(0, coordinateDistance(origin, destination) - ARRIVAL_DISTANCE)
      : 0;
    const travelMs = travelDistance / TRAVEL_DEGREES_PER_MS;
    const durationMs = travelMs + Math.max(0, task.workMs);

    const dependencyIds = [...task.dependsOn];
    if (previousAgentTask && !dependencyIds.includes(previousAgentTask.id)) dependencyIds.push(previousAgentTask.id);
    const readyAtMs = dependencyIds.reduce((latest, dependencyId) => Math.max(latest, endByTask.get(dependencyId) ?? 0), 0);
    endByTask.set(task.id, readyAtMs + durationMs);
    previousTaskByAgent.set(task.agentId, { id: task.id, locationId: task.locationId });
  }

  return Math.round(Math.max(0, ...endByTask.values()));
}

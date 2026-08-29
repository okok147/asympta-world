import {
  CITY_LIFE_COUNT,
  cityLifeActorAt,
  cityLifeSnapshot,
  demoDisclosure,
  type CityLifeActor,
  type CityLifeStatus,
} from "./atlas-demo.ts";
import {
  ATLAS_LOCATIONS,
  createAtlasWorld,
  loadPersistedAtlasWorld,
  persistAtlasWorld,
  resolveAtlasApproval,
  startAtlasWorkflow,
  type AtlasWorldState,
  type WorkflowId,
} from "./atlas-canonical-world.ts";

export { CITY_LIFE_COUNT, cityLifeActorAt, cityLifeSnapshot, demoDisclosure };
export type { CityLifeActor, CityLifeStatus };

const LOCATION_IDS = Object.keys(ATLAS_LOCATIONS);

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function visibleOrigin(taskId: string, destinationId: string) {
  const candidates = LOCATION_IDS.filter((id) => id !== destinationId);
  return candidates[hash(taskId) % candidates.length];
}

function forceTaskTravel(world: AtlasWorldState, taskId: string, suffix = "") {
  const task = world.tasks.find((item) => item.id === taskId);
  const agent = task ? world.agents.find((item) => item.id === task.agentId) : undefined;
  const destination = task ? ATLAS_LOCATIONS[task.locationId]?.point : undefined;
  if (!task || !agent || !destination) return;
  if (!["moving", "working"].includes(task.status)) return;
  const originId = visibleOrigin(`${task.id}${suffix}`, task.locationId);
  const origin = ATLAS_LOCATIONS[originId]?.point;
  if (!origin) return;
  agent.position = { ...origin };
  agent.target = { ...destination };
  agent.status = "moving";
  agent.taskId = task.id;
  task.status = "moving";
  task.progress = 0;
  delete task.workStartedAt;
}

function forceFreshActiveTasksToTravel(world: AtlasWorldState) {
  for (const task of world.tasks) {
    if (task.status === "moving" || (task.status === "working" && task.progress === 0)) {
      forceTaskTravel(world, task.id);
    }
  }
  return world;
}

export function startAtlasDemoWorkflow(current: AtlasWorldState, workflowId: WorkflowId) {
  const next = forceFreshActiveTasksToTravel(startAtlasWorkflow(current, workflowId));
  persistAtlasWorld(next);
  return next;
}

export function createAtlasDemoWorld(now = Date.now()) {
  const persisted = loadPersistedAtlasWorld();
  if (persisted && persisted.workflowId && persisted.phase !== "blocked") return persisted;
  return startAtlasDemoWorkflow(createAtlasWorld(now), "custom-order");
}

export function resolveAtlasDemoApproval(current: AtlasWorldState, approvalId: string, approved: boolean) {
  const approval = current.approvals.find((item) => item.id === approvalId);
  let next = resolveAtlasApproval(current, approvalId, approved);
  if (!approved) return next;
  if (approval?.kind === "webmcp-start") {
    next = forceFreshActiveTasksToTravel(next);
  } else if (approval?.taskId) {
    forceTaskTravel(next, approval.taskId, "-approval");
  }
  persistAtlasWorld(next);
  return next;
}

import {
  ATLAS_AGENTS,
  ATLAS_LOCATIONS,
  createAtlasWorld,
  resolveAtlasApproval,
  startAtlasWorkflow,
  type AtlasWorldState,
  type GeoPoint,
  type StakeholderSide,
  type WorkflowId,
} from "./atlas-simulation.ts";

export type CityLifeStatus = "moving" | "working";

export type CityLifeActor = {
  id: string;
  name: string;
  side: StakeholderSide;
  role: string;
  organisation: string;
  status: CityLifeStatus;
  task: string;
  position: GeoPoint;
  next: GeoPoint;
  fromLocationId: string;
  toLocationId: string;
  simulated: true;
};

const LOCATION_IDS = Object.keys(ATLAS_LOCATIONS);
const TRAVEL_MS = 9_500;
const WORK_MS = 3_300;

const CITY_NAMES = [
  "Aya", "Kento", "Mei", "Riku", "Hina", "Daichi", "Mio", "Sota",
  "Yuna", "Akira", "Noa", "Kota", "Rin", "Yuto", "Sara", "Itsuki",
  "Mika", "Renji", "Nao", "Kiri", "Haru", "Ema", "Sena", "Toru",
  "Ryo", "Ami", "Leo", "Nana", "Jun", "Maya", "Kei", "Saki",
];

const SIDE_SEQUENCE: StakeholderSide[] = [
  "user", "business", "logistics", "supplier", "customer", "business", "user", "operations",
  "logistics", "supplier", "support", "business", "user", "finance", "quality", "logistics",
  "business", "market", "supplier", "customer", "user", "operations", "logistics", "business",
  "support", "user", "supplier", "finance", "business", "logistics", "market", "customer",
];

const TASKS: Record<StakeholderSide, string[]> = {
  user: ["Comparing dinner options", "Finding a repair slot", "Planning a custom order", "Checking delivery choices"],
  customer: ["Reviewing an offer", "Confirming requirements", "Checking replacement timing", "Comparing service options"],
  business: ["Preparing a quote", "Responding to an order", "Checking merchant capacity", "Coordinating a service request"],
  supplier: ["Checking material stock", "Reserving production capacity", "Confirming lead time", "Preparing replenishment"],
  operations: ["Sequencing fulfilment", "Planning preparation", "Rebalancing workload", "Coordinating handoffs"],
  finance: ["Checking payment terms", "Reviewing margin exposure", "Approving a demo budget", "Reconciling an order"],
  logistics: ["Routing a courier", "Collecting a parcel", "Rebalancing deliveries", "Preparing a last-mile handoff"],
  support: ["Following up a customer", "Resolving a service issue", "Sending a recovery update", "Checking aftercare"],
  quality: ["Verifying a specification", "Checking a replacement", "Reviewing acceptance criteria", "Inspecting a demo order"],
  market: ["Watching demand signals", "Comparing local activity", "Estimating launch demand", "Reviewing customer interest"],
};

const ROLE: Record<StakeholderSide, string> = {
  user: "Other user agent",
  customer: "Customer-side agent",
  business: "Business agent",
  supplier: "Supplier agent",
  operations: "Operations agent",
  finance: "Finance agent",
  logistics: "Logistics agent",
  support: "Support agent",
  quality: "Quality agent",
  market: "Market agent",
};

const ORG: Record<StakeholderSide, string> = {
  user: "Simulated resident",
  customer: "Simulated customer",
  business: "Simulated merchant",
  supplier: "Simulated supplier",
  operations: "Simulated operations",
  finance: "Simulated finance",
  logistics: "Simulated delivery network",
  support: "Simulated support team",
  quality: "Simulated quality team",
  market: "Simulated market network",
};

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function ease(t: number) {
  return t * t * (3 - 2 * t);
}

function interpolate(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  const p = ease(Math.max(0, Math.min(1, t)));
  return { lon: a.lon + (b.lon - a.lon) * p, lat: a.lat + (b.lat - a.lat) * p };
}

function routeFor(index: number) {
  const start = (index * 3 + 1) % LOCATION_IDS.length;
  return [
    LOCATION_IDS[start],
    LOCATION_IDS[(start + 3 + (index % 2)) % LOCATION_IDS.length],
    LOCATION_IDS[(start + 7) % LOCATION_IDS.length],
    LOCATION_IDS[(start + 5) % LOCATION_IDS.length],
  ];
}

export const CITY_LIFE_COUNT = CITY_NAMES.length;

export function cityLifeSnapshot(now: number): CityLifeActor[] {
  return CITY_NAMES.map((name, index) => {
    const side = SIDE_SEQUENCE[index];
    const route = routeFor(index);
    const legMs = TRAVEL_MS + WORK_MS;
    const local = (now + index * 2_731) % (legMs * route.length);
    const legIndex = Math.floor(local / legMs);
    const within = local % legMs;
    const fromLocationId = route[legIndex];
    const toLocationId = route[(legIndex + 1) % route.length];
    const from = ATLAS_LOCATIONS[fromLocationId].point;
    const to = ATLAS_LOCATIONS[toLocationId].point;
    const moving = within < TRAVEL_MS;
    const taskOptions = TASKS[side];
    const task = taskOptions[(legIndex + index) % taskOptions.length];
    return {
      id: `city-${index + 1}`,
      name,
      side,
      role: ROLE[side],
      organisation: ORG[side],
      status: moving ? "moving" : "working",
      task,
      position: moving ? interpolate(from, to, within / TRAVEL_MS) : { ...to },
      next: { ...to },
      fromLocationId,
      toLocationId,
      simulated: true,
    };
  });
}

function pickVisibleOrigin(taskId: string, destinationId: string) {
  const candidates = LOCATION_IDS.filter((id) => id !== destinationId);
  return candidates[hash(taskId) % candidates.length];
}

function forceFreshActiveTasksToTravel(world: AtlasWorldState) {
  const next = JSON.parse(JSON.stringify(world)) as AtlasWorldState;
  for (const task of next.tasks) {
    if (task.status !== "moving" && !(task.status === "working" && task.progress === 0)) continue;
    const agent = next.agents.find((candidate) => candidate.id === task.agentId);
    const destination = ATLAS_LOCATIONS[task.locationId]?.point;
    if (!agent || !destination) continue;
    const originId = pickVisibleOrigin(task.id, task.locationId);
    const origin = ATLAS_LOCATIONS[originId].point;
    agent.position = { ...origin };
    agent.target = { ...destination };
    agent.status = "moving";
    agent.taskId = task.id;
    task.status = "moving";
    task.progress = 0;
    delete task.workStartedAt;
  }
  return next;
}

export function startAtlasDemoWorkflow(current: AtlasWorldState, workflowId: WorkflowId) {
  return forceFreshActiveTasksToTravel(startAtlasWorkflow(current, workflowId));
}

export function createAtlasDemoWorld(now = Date.now()) {
  return startAtlasDemoWorkflow(createAtlasWorld(now), "custom-order");
}

export function resolveAtlasDemoApproval(current: AtlasWorldState, approvalId: string, approved: boolean) {
  const before = current.approvals.find((approval) => approval.id === approvalId);
  const resolved = resolveAtlasApproval(current, approvalId, approved);
  if (!approved) return resolved;

  if (before?.kind === "webmcp-start") return forceFreshActiveTasksToTravel(resolved);
  if (before?.taskId) {
    const next = JSON.parse(JSON.stringify(resolved)) as AtlasWorldState;
    const task = next.tasks.find((candidate) => candidate.id === before.taskId);
    const agent = task ? next.agents.find((candidate) => candidate.id === task.agentId) : undefined;
    const destination = task ? ATLAS_LOCATIONS[task.locationId]?.point : undefined;
    if (task && agent && destination && task.status === "working") {
      const originId = pickVisibleOrigin(`${task.id}-approval`, task.locationId);
      agent.position = { ...ATLAS_LOCATIONS[originId].point };
      agent.target = { ...destination };
      agent.status = "moving";
      agent.taskId = task.id;
      task.status = "moving";
      task.progress = 0;
      delete task.workStartedAt;
    }
    return next;
  }
  return resolved;
}

export function demoDisclosure() {
  return "City movement is a visual simulation of agent/API coordination. Background users and businesses are synthetic demonstration actors, not live people or real company activity.";
}

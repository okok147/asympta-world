import {
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

export function cityLifeActorAt(index: number, now: number): CityLifeActor {
  const safeIndex = ((Math.trunc(index) % CITY_LIFE_COUNT) + CITY_LIFE_COUNT) % CITY_LIFE_COUNT;
  const name = CITY_NAMES[safeIndex];
  const side = SIDE_SEQUENCE[safeIndex];
  const route = routeFor(safeIndex);
  const legMs = TRAVEL_MS + WORK_MS;
  const local = (now + safeIndex * 2_731) % (legMs * route.length);
  const legIndex = Math.floor(local / legMs);
  const within = local % legMs;
  const fromLocationId = route[legIndex];
  const toLocationId = route[(legIndex + 1) % route.length];
  const from = ATLAS_LOCATIONS[fromLocationId].point;
  const to = ATLAS_LOCATIONS[toLocationId].point;
  const moving = within < TRAVEL_MS;
  const taskOptions = TASKS[side];
  const task = taskOptions[(legIndex + safeIndex) % taskOptions.length];

  return {
    id: `city-${safeIndex + 1}`,
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
}

export function cityLifeSnapshot(now: number): CityLifeActor[] {
  return Array.from({ length: CITY_LIFE_COUNT }, (_, index) => cityLifeActorAt(index, now));
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

let resetNextDemoWorldToIdle = false;

/**
 * A completed workflow can arm an explicit clean reset. The landing world is
 * also intentionally idle: background synthetic city actors provide visual life,
 * but no foreground business workflow may run until a human/WebMCP request
 * actually starts one. This prevents hidden demo work from reaching an approval
 * checkpoint and surfacing a seemingly random approval card.
 */
export function prepareAtlasDemoWorkflowReset() {
  resetNextDemoWorldToIdle = true;
}

export function startAtlasDemoWorkflow(current: AtlasWorldState, workflowId: WorkflowId) {
  const started = startAtlasWorkflow(current, workflowId);
  return String(workflowId) === "marketplace-intent" ? started : forceFreshActiveTasksToTravel(started);
}

export function createAtlasDemoWorld(now = Date.now()) {
  if (resetNextDemoWorldToIdle) resetNextDemoWorldToIdle = false;
  return createAtlasWorld(now);
}

export function resolveAtlasDemoApproval(current: AtlasWorldState, approvalId: string, approved: boolean) {
  const before = current.approvals.find((approval) => approval.id === approvalId);
  const resolved = resolveAtlasApproval(current, approvalId, approved);
  if (!approved) return resolved;

  // Starting a requested workflow may create tasks at their destinations, so the
  // demo can add one initial visible travel leg. A task approval is different:
  // the agent has already arrived at the checkpoint. Repositioning the agent
  // after approval used to replay travel, making an authorised payment look
  // stalled. Preserve the engine's canonical continuation instead: approved
  // work resumes immediately and dependent tasks start on the next engine tick.
  if (before?.kind === "webmcp-start") return forceFreshActiveTasksToTravel(resolved);
  return resolved;
}

export function demoDisclosure() {
  return "City movement is a visual simulation of agent/API coordination. Background users and businesses are synthetic demonstration actors, not live people or real company activity.";
}

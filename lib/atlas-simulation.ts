export type StakeholderSide =
  | "user"
  | "customer"
  | "business"
  | "supplier"
  | "operations"
  | "finance"
  | "logistics"
  | "support"
  | "quality"
  | "market";

export type WorkflowId = "custom-order" | "dinner-network" | "launch-stock" | "service-recovery";
export type ExternalAction = "reserve_capacity" | "authorize_payment" | "release_shipment" | "send_customer_update";
export type AgentStatus = "idle" | "moving" | "working" | "sharing" | "waiting" | "returning";
export type TaskStatus = "queued" | "moving" | "working" | "waiting_approval" | "done" | "blocked";
export type WorldPhase = "idle" | "running" | "waiting_approval" | "completed" | "blocked";

export type GeoPoint = { lon: number; lat: number };

export type AtlasLocation = {
  id: string;
  name: string;
  point: GeoPoint;
};

export type AtlasAgentBlueprint = {
  id: string;
  name: string;
  side: StakeholderSide;
  role: string;
  organisation: string;
  homeLocationId: string;
};

export type AtlasTaskBlueprint = {
  id: string;
  title: string;
  detail: string;
  agentId: string;
  locationId: string;
  dependsOn: string[];
  workMs: number;
  requiresApproval?: boolean;
  approvalLabel?: string;
  actionType?: ExternalAction;
};

export type AtlasWorkflowDefinition = {
  id: WorkflowId;
  name: string;
  shortName: string;
  summary: string;
  outcome: string;
  tasks: AtlasTaskBlueprint[];
};

export type AtlasAgentState = AtlasAgentBlueprint & {
  status: AgentStatus;
  position: GeoPoint;
  target: GeoPoint;
  taskId?: string;
  statusUntil?: number;
};

export type AtlasTaskState = AtlasTaskBlueprint & {
  status: TaskStatus;
  progress: number;
  startedAt?: number;
  workStartedAt?: number;
  completedAt?: number;
  approvalStatus?: "none" | "pending" | "approved" | "declined";
};

export type AtlasMessage = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  text: string;
  createdAt: number;
  expiresAt: number;
};

export type AtlasEvent = {
  id: string;
  title: string;
  detail: string;
  createdAt: number;
  agentId?: string;
  taskId?: string;
};

export type AtlasApproval = {
  id: string;
  source: "workflow" | "webmcp";
  kind: "task" | "webmcp-start" | "webmcp-action";
  status: "pending" | "approved" | "declined";
  title: string;
  detail: string;
  consequence: string;
  requestedAt: number;
  resolvedAt?: number;
  taskId?: string;
  workflowId?: WorkflowId;
  agentId?: string;
  actionType?: ExternalAction;
};

export type AtlasWorldState = {
  revision: number;
  now: number;
  phase: WorldPhase;
  workflowId?: WorkflowId;
  agents: AtlasAgentState[];
  tasks: AtlasTaskState[];
  messages: AtlasMessage[];
  events: AtlasEvent[];
  approvals: AtlasApproval[];
};

const EVENT_LIMIT = 90;
const MESSAGE_LIFETIME_MS = 4_600;
const TRAVEL_DEGREES_PER_MS = 0.0000028;
const ARRIVAL_DISTANCE = 0.00034;

export const ATLAS_LOCATIONS: Record<string, AtlasLocation> = {
  shibuya: { id: "shibuya", name: "Shibuya", point: { lon: 139.7005, lat: 35.6595 } },
  shinjuku: { id: "shinjuku", name: "Shinjuku", point: { lon: 139.7034, lat: 35.6938 } },
  marunouchi: { id: "marunouchi", name: "Marunouchi", point: { lon: 139.7639, lat: 35.6812 } },
  otemachi: { id: "otemachi", name: "Otemachi", point: { lon: 139.7666, lat: 35.6868 } },
  nihonbashi: { id: "nihonbashi", name: "Nihonbashi", point: { lon: 139.7744, lat: 35.6837 } },
  toyosu: { id: "toyosu", name: "Toyosu", point: { lon: 139.7967, lat: 35.655 } },
  tsukiji: { id: "tsukiji", name: "Tsukiji", point: { lon: 139.7707, lat: 35.6655 } },
  shinagawa: { id: "shinagawa", name: "Shinagawa", point: { lon: 139.7387, lat: 35.6285 } },
  hamamatsucho: { id: "hamamatsucho", name: "Hamamatsucho", point: { lon: 139.7568, lat: 35.6556 } },
  roppongi: { id: "roppongi", name: "Roppongi", point: { lon: 139.7314, lat: 35.6628 } },
  ueno: { id: "ueno", name: "Ueno", point: { lon: 139.7773, lat: 35.7138 } },
};

export const ATLAS_AGENTS: AtlasAgentBlueprint[] = [
  { id: "agent-user", name: "Mina", side: "user", role: "Personal intent agent", organisation: "You", homeLocationId: "shibuya" },
  { id: "agent-customer", name: "Ren", side: "customer", role: "Customer advocate", organisation: "Customer side", homeLocationId: "shinjuku" },
  { id: "agent-business", name: "Aoi", side: "business", role: "Business coordinator", organisation: "Merchant network", homeLocationId: "marunouchi" },
  { id: "agent-supplier", name: "Sora", side: "supplier", role: "Supplier agent", organisation: "Supply network", homeLocationId: "toyosu" },
  { id: "agent-operations", name: "Kai", side: "operations", role: "Operations planner", organisation: "Operations", homeLocationId: "shinagawa" },
  { id: "agent-finance", name: "Nami", side: "finance", role: "Finance controller", organisation: "Finance", homeLocationId: "otemachi" },
  { id: "agent-logistics", name: "Haru", side: "logistics", role: "Logistics dispatcher", organisation: "Delivery network", homeLocationId: "hamamatsucho" },
  { id: "agent-support", name: "Yui", side: "support", role: "Service recovery agent", organisation: "Customer support", homeLocationId: "roppongi" },
  { id: "agent-quality", name: "Toma", side: "quality", role: "Quality verifier", organisation: "Quality assurance", homeLocationId: "nihonbashi" },
  { id: "agent-market", name: "Emi", side: "market", role: "Market intelligence agent", organisation: "Market intelligence", homeLocationId: "ueno" },
];

const task = (
  id: string,
  title: string,
  detail: string,
  agentId: string,
  locationId: string,
  dependsOn: string[],
  workMs: number,
  options: Pick<AtlasTaskBlueprint, "requiresApproval" | "approvalLabel" | "actionType"> = {},
): AtlasTaskBlueprint => ({ id, title, detail, agentId, locationId, dependsOn, workMs, ...options });

export const ATLAS_WORKFLOWS: AtlasWorkflowDefinition[] = [
  {
    id: "custom-order",
    name: "Custom Order Network",
    shortName: "Order",
    summary: "Customer intent becomes a coordinated quote, supplier reservation, payment, fulfilment and delivery chain.",
    outcome: "A simulated custom order is negotiated, reserved, authorised, packed, dispatched and handed over with aftercare.",
    tasks: [
      task("co-intent", "Understand the custom request", "Convert the user's request into a structured requirement package.", "agent-user", "shibuya", [], 2_200),
      task("co-customer", "Validate customer fit", "Check constraints, timing and acceptance criteria from the customer side.", "agent-customer", "shinjuku", ["co-intent"], 2_700),
      task("co-business", "Build commercial offer", "Create a commercial offer and clarify merchant commitments.", "agent-business", "marunouchi", ["co-intent"], 3_000),
      task("co-supply", "Check supplier capacity", "Check material availability, lead time and minimum commitment.", "agent-supplier", "toyosu", ["co-intent"], 3_100),
      task("co-quality", "Verify specification", "Reconcile customer acceptance criteria with available material and quality constraints.", "agent-quality", "nihonbashi", ["co-customer", "co-supply"], 2_800),
      task("co-finance", "Model margin and payment", "Calculate simulated total cost, margin exposure and payment milestones.", "agent-finance", "otemachi", ["co-business", "co-supply"], 2_700),
      task("co-negotiate", "Converge commercial terms", "Merge quality, customer, supplier and finance constraints into one executable offer.", "agent-business", "marunouchi", ["co-quality", "co-finance"], 3_100),
      task("co-ops", "Plan production and fulfilment", "Sequence procurement, preparation, packing and handoff windows.", "agent-operations", "shinagawa", ["co-quality", "co-finance"], 3_300),
      task("co-reserve", "Reserve supplier capacity", "Hold the simulated supplier capacity needed for the agreed plan.", "agent-supplier", "toyosu", ["co-negotiate", "co-ops"], 1_900, { requiresApproval: true, approvalLabel: "Allow supplier capacity reservation", actionType: "reserve_capacity" }),
      task("co-pay", "Authorise payment milestone", "Authorise the simulated payment milestone before fulfilment continues.", "agent-finance", "otemachi", ["co-reserve"], 1_700, { requiresApproval: true, approvalLabel: "Allow simulated payment authorisation", actionType: "authorize_payment" }),
      task("co-pack", "Prepare and quality-check order", "Prepare, pack and verify the order against the accepted specification.", "agent-operations", "shinagawa", ["co-pay"], 3_600),
      task("co-dispatch", "Release shipment", "Release the simulated shipment into the delivery network.", "agent-logistics", "hamamatsucho", ["co-pack"], 1_800, { requiresApproval: true, approvalLabel: "Allow simulated shipment release", actionType: "release_shipment" }),
      task("co-deliver", "Deliver to customer", "Move the completed order through the last-mile handoff.", "agent-logistics", "shibuya", ["co-dispatch"], 3_000),
      task("co-aftercare", "Confirm satisfaction and aftercare", "Confirm handover, capture feedback and open aftercare if needed.", "agent-support", "shibuya", ["co-deliver"], 2_400, { requiresApproval: true, approvalLabel: "Allow customer completion update", actionType: "send_customer_update" }),
    ],
  },
  {
    id: "dinner-network",
    name: "Dinner Coordination",
    shortName: "Dinner",
    summary: "A dinner request coordinates customer preference, restaurant capacity, ingredient supply, payment and courier handoff.",
    outcome: "A simulated dinner plan moves from preference matching through kitchen supply and last-mile delivery.",
    tasks: [
      task("dn-intent", "Interpret dinner need", "Resolve cuisine, timing, dietary and budget constraints.", "agent-user", "shibuya", [], 2_000),
      task("dn-customer", "Confirm customer preferences", "Validate preference trade-offs and hard dietary constraints.", "agent-customer", "shinjuku", ["dn-intent"], 2_200),
      task("dn-business", "Check restaurant capacity", "Check simulated kitchen capacity, menu availability and preparation window.", "agent-business", "marunouchi", ["dn-intent"], 2_600),
      task("dn-supplier", "Verify ingredient supply", "Check ingredient availability and substitutions across the supply side.", "agent-supplier", "tsukiji", ["dn-intent"], 2_700),
      task("dn-quality", "Validate substitutions", "Make sure substitutions preserve dietary and quality requirements.", "agent-quality", "nihonbashi", ["dn-customer", "dn-supplier"], 2_300),
      task("dn-plan", "Synchronise kitchen and courier", "Align preparation completion with courier pickup capacity.", "agent-operations", "hamamatsucho", ["dn-business", "dn-quality"], 2_700),
      task("dn-authorize", "Confirm dinner order", "Authorise the simulated order before preparation begins.", "agent-finance", "otemachi", ["dn-plan"], 1_600, { requiresApproval: true, approvalLabel: "Allow simulated dinner order", actionType: "authorize_payment" }),
      task("dn-prepare", "Prepare dinner", "Simulate kitchen preparation and final quality check.", "agent-business", "marunouchi", ["dn-authorize"], 3_500),
      task("dn-dispatch", "Release courier pickup", "Release the simulated courier once preparation is ready.", "agent-logistics", "hamamatsucho", ["dn-prepare"], 1_600, { requiresApproval: true, approvalLabel: "Allow simulated courier dispatch", actionType: "release_shipment" }),
      task("dn-deliver", "Complete dinner delivery", "Simulate last-mile movement and customer handoff.", "agent-logistics", "shibuya", ["dn-dispatch"], 2_800),
      task("dn-feedback", "Close the service loop", "Send a completion update and capture service feedback.", "agent-support", "shibuya", ["dn-deliver"], 1_900, { requiresApproval: true, approvalLabel: "Allow completion message", actionType: "send_customer_update" }),
    ],
  },
  {
    id: "launch-stock",
    name: "Launch Stock Orchestration",
    shortName: "Launch",
    summary: "Business, market, supplier, finance, operations, quality and logistics agents coordinate a new stock launch.",
    outcome: "A simulated launch inventory plan is demand-tested, financed, reserved, quality-gated and released to distribution.",
    tasks: [
      task("ls-brief", "Frame launch objective", "Translate the launch ambition into a measurable inventory and service target.", "agent-business", "marunouchi", [], 2_400),
      task("ls-market", "Estimate customer demand", "Estimate launch demand, uncertainty and customer segments.", "agent-market", "ueno", ["ls-brief"], 3_200),
      task("ls-customer", "Stress-test customer value", "Challenge positioning and identify failure points from the customer side.", "agent-customer", "shinjuku", ["ls-brief"], 2_700),
      task("ls-supply", "Map supplier constraints", "Check simulated capacity, lead time, lot size and alternate supply.", "agent-supplier", "toyosu", ["ls-brief"], 3_200),
      task("ls-finance", "Model launch exposure", "Model working capital, margin and downside exposure.", "agent-finance", "otemachi", ["ls-market", "ls-supply"], 2_900),
      task("ls-quality", "Define launch quality gate", "Define acceptance thresholds and failure handling before stock is committed.", "agent-quality", "nihonbashi", ["ls-customer", "ls-supply"], 2_700),
      task("ls-plan", "Build operating plan", "Create launch waves, stock buffers and escalation paths.", "agent-operations", "shinagawa", ["ls-finance", "ls-quality"], 3_400),
      task("ls-reserve", "Reserve launch capacity", "Reserve simulated supplier capacity for the launch plan.", "agent-supplier", "toyosu", ["ls-plan"], 1_800, { requiresApproval: true, approvalLabel: "Allow simulated launch capacity reservation", actionType: "reserve_capacity" }),
      task("ls-budget", "Authorise launch budget", "Authorise the simulated launch budget envelope.", "agent-finance", "otemachi", ["ls-reserve"], 1_700, { requiresApproval: true, approvalLabel: "Allow simulated launch budget", actionType: "authorize_payment" }),
      task("ls-stage", "Stage launch inventory", "Simulate production, receiving, inspection and inventory staging.", "agent-operations", "shinagawa", ["ls-budget"], 3_900),
      task("ls-release", "Release launch inventory", "Release simulated inventory to the distribution network.", "agent-logistics", "hamamatsucho", ["ls-stage"], 1_800, { requiresApproval: true, approvalLabel: "Allow launch inventory release", actionType: "release_shipment" }),
      task("ls-monitor", "Open launch support loop", "Notify the support side and start customer feedback monitoring.", "agent-support", "roppongi", ["ls-release"], 2_300, { requiresApproval: true, approvalLabel: "Allow launch customer update", actionType: "send_customer_update" }),
    ],
  },
  {
    id: "service-recovery",
    name: "Service Recovery Network",
    shortName: "Recovery",
    summary: "A service failure triggers parallel customer impact, supplier replacement, finance, quality and logistics recovery.",
    outcome: "A simulated failure is triaged, replacement capacity is secured, remedies are authorised and the customer is updated.",
    tasks: [
      task("sr-triage", "Triage service failure", "Classify the failure, urgency and immediate customer risk.", "agent-support", "roppongi", [], 2_200),
      task("sr-customer", "Assess customer impact", "Estimate customer impact, commitments and recovery expectations.", "agent-customer", "shinjuku", ["sr-triage"], 2_500),
      task("sr-quality", "Trace failure cause", "Trace the likely quality failure and define containment criteria.", "agent-quality", "nihonbashi", ["sr-triage"], 2_900),
      task("sr-supplier", "Find replacement capacity", "Check simulated supplier replacement stock and timing.", "agent-supplier", "toyosu", ["sr-triage"], 2_800),
      task("sr-finance", "Model remedy options", "Compare replacement, credit and expedited delivery exposure.", "agent-finance", "otemachi", ["sr-customer", "sr-supplier"], 2_600),
      task("sr-plan", "Build recovery plan", "Coordinate containment, replacement, priority logistics and communication.", "agent-operations", "shinagawa", ["sr-quality", "sr-finance"], 3_100),
      task("sr-reserve", "Reserve recovery stock", "Reserve simulated replacement capacity for the recovery plan.", "agent-supplier", "toyosu", ["sr-plan"], 1_700, { requiresApproval: true, approvalLabel: "Allow recovery stock reservation", actionType: "reserve_capacity" }),
      task("sr-credit", "Authorise customer remedy", "Authorise the simulated remedy or credit envelope.", "agent-finance", "otemachi", ["sr-reserve"], 1_600, { requiresApproval: true, approvalLabel: "Allow simulated remedy authorisation", actionType: "authorize_payment" }),
      task("sr-dispatch", "Dispatch priority replacement", "Release the simulated priority replacement into logistics.", "agent-logistics", "hamamatsucho", ["sr-credit"], 1_700, { requiresApproval: true, approvalLabel: "Allow priority replacement dispatch", actionType: "release_shipment" }),
      task("sr-update", "Send recovery update", "Send the simulated customer recovery update with expected handoff timing.", "agent-support", "shinjuku", ["sr-dispatch"], 1_700, { requiresApproval: true, approvalLabel: "Allow recovery customer update", actionType: "send_customer_update" }),
    ],
  },
];

function cloneWorld(world: AtlasWorldState): AtlasWorldState {
  return JSON.parse(JSON.stringify(world)) as AtlasWorldState;
}

function nextId(world: AtlasWorldState, prefix: string) {
  world.revision += 1;
  return `${prefix}-${world.revision.toString(36)}-${Math.floor(world.now).toString(36)}`;
}

function pushEvent(world: AtlasWorldState, title: string, detail: string, refs: Pick<AtlasEvent, "agentId" | "taskId"> = {}) {
  world.events = [
    { id: nextId(world, "event"), title, detail, createdAt: world.now, ...refs },
    ...world.events,
  ].slice(0, EVENT_LIMIT);
}

function pushMessage(world: AtlasWorldState, fromAgentId: string, toAgentId: string, text: string) {
  world.messages = [
    ...world.messages,
    {
      id: nextId(world, "message"),
      fromAgentId,
      toAgentId,
      text,
      createdAt: world.now,
      expiresAt: world.now + MESSAGE_LIFETIME_MS,
    },
  ].slice(-24);
}

function homePoint(agent: AtlasAgentState) {
  return ATLAS_LOCATIONS[agent.homeLocationId].point;
}

function spawnAgents(): AtlasAgentState[] {
  return ATLAS_AGENTS.map((agent) => {
    const point = ATLAS_LOCATIONS[agent.homeLocationId].point;
    return {
      ...agent,
      status: "idle" as const,
      position: { ...point },
      target: { ...point },
    };
  });
}

export function createAtlasWorld(now = Date.now()): AtlasWorldState {
  return {
    revision: 0,
    now,
    phase: "idle",
    agents: spawnAgents(),
    tasks: [],
    messages: [],
    events: [],
    approvals: [],
  };
}

export function workflowFor(id: WorkflowId) {
  return ATLAS_WORKFLOWS.find((workflow) => workflow.id === id) ?? ATLAS_WORKFLOWS[0];
}

export function startAtlasWorkflow(current: AtlasWorldState, workflowId: WorkflowId) {
  const definition = workflowFor(workflowId);
  const world = createAtlasWorld(current.now);
  world.revision = current.revision;
  world.workflowId = workflowId;
  world.phase = "running";
  world.tasks = definition.tasks.map((item) => ({
    ...item,
    dependencies: [...item.dependsOn],
    dependsOn: [...item.dependsOn],
    status: "queued" as const,
    progress: 0,
    approvalStatus: item.requiresApproval ? "none" : undefined,
  })) as AtlasTaskState[];
  pushEvent(world, definition.name, definition.summary);
  beginReadyTasks(world);
  return world;
}

function dependenciesDone(world: AtlasWorldState, taskState: AtlasTaskState) {
  return taskState.dependsOn.every((id) => world.tasks.find((candidate) => candidate.id === id)?.status === "done");
}

function agentHasActiveTask(world: AtlasWorldState, agentId: string) {
  return world.tasks.some((taskState) =>
    taskState.agentId === agentId && ["moving", "working", "waiting_approval"].includes(taskState.status),
  );
}

function coordinateDistance(a: GeoPoint, b: GeoPoint) {
  const lonScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * lonScale, a.lat - b.lat);
}

function moveToward(agent: AtlasAgentState, target: GeoPoint, deltaMs: number) {
  const lonScale = Math.cos(((agent.position.lat + target.lat) / 2) * Math.PI / 180);
  const dx = (target.lon - agent.position.lon) * lonScale;
  const dy = target.lat - agent.position.lat;
  const distance = Math.hypot(dx, dy);
  agent.target = { ...target };
  if (distance <= ARRIVAL_DISTANCE) {
    agent.position = { ...target };
    return true;
  }
  const travel = Math.min(distance, TRAVEL_DEGREES_PER_MS * deltaMs);
  const ratio = travel / distance;
  agent.position = {
    lon: agent.position.lon + ((target.lon - agent.position.lon) * ratio),
    lat: agent.position.lat + ((target.lat - agent.position.lat) * ratio),
  };
  return coordinateDistance(agent.position, target) <= ARRIVAL_DISTANCE;
}

function addTaskApproval(world: AtlasWorldState, taskState: AtlasTaskState, agent: AtlasAgentState) {
  if (world.approvals.some((approval) => approval.taskId === taskState.id && approval.status === "pending")) return;
  taskState.status = "waiting_approval";
  taskState.approvalStatus = "pending";
  agent.status = "waiting";
  const title = taskState.approvalLabel ?? `Allow ${taskState.title}`;
  world.approvals.push({
    id: nextId(world, "approval"),
    source: "workflow",
    kind: "task",
    status: "pending",
    title,
    detail: taskState.detail,
    consequence: "This demo will advance the simulated workflow only. It will not place a real order, charge money, reserve real inventory or dispatch a real shipment.",
    requestedAt: world.now,
    taskId: taskState.id,
    agentId: agent.id,
    actionType: taskState.actionType,
  });
  pushEvent(world, "Human approval required", `${agent.name} is waiting before: ${taskState.title}.`, { agentId: agent.id, taskId: taskState.id });
  pushMessage(world, agent.id, "human", title);
}

function arriveAtTask(world: AtlasWorldState, taskState: AtlasTaskState, agent: AtlasAgentState) {
  if (taskState.requiresApproval && taskState.approvalStatus !== "approved") {
    addTaskApproval(world, taskState, agent);
    return;
  }
  taskState.status = "working";
  taskState.workStartedAt = world.now;
  agent.status = "working";
  pushEvent(world, taskState.title, `${agent.name} arrived at ${ATLAS_LOCATIONS[taskState.locationId].name} and started work.`, { agentId: agent.id, taskId: taskState.id });
}

function beginReadyTasks(world: AtlasWorldState) {
  if (!world.workflowId || world.phase === "blocked") return;
  for (const taskState of world.tasks) {
    if (taskState.status !== "queued" || !dependenciesDone(world, taskState) || agentHasActiveTask(world, taskState.agentId)) continue;
    const agent = world.agents.find((candidate) => candidate.id === taskState.agentId);
    if (!agent) continue;
    const destination = ATLAS_LOCATIONS[taskState.locationId].point;
    taskState.startedAt = world.now;
    taskState.status = "moving";
    agent.status = "moving";
    agent.taskId = taskState.id;
    agent.target = { ...destination };
    pushEvent(world, `${agent.name} moving`, `${agent.role} is travelling to ${ATLAS_LOCATIONS[taskState.locationId].name} for ${taskState.title}.`, { agentId: agent.id, taskId: taskState.id });
    if (coordinateDistance(agent.position, destination) <= ARRIVAL_DISTANCE) arriveAtTask(world, taskState, agent);
  }
}

function completeTask(world: AtlasWorldState, taskState: AtlasTaskState, agent: AtlasAgentState) {
  taskState.status = "done";
  taskState.progress = 1;
  taskState.completedAt = world.now;
  agent.status = "sharing";
  agent.statusUntil = world.now + 720;
  delete agent.taskId;
  pushEvent(world, `${taskState.title} complete`, `${agent.name} completed the work and published the result to dependent agents.`, { agentId: agent.id, taskId: taskState.id });

  for (const dependent of world.tasks.filter((candidate) => candidate.dependsOn.includes(taskState.id))) {
    if (dependent.agentId !== agent.id) {
      const recipient = world.agents.find((candidate) => candidate.id === dependent.agentId);
      if (recipient) pushMessage(world, agent.id, recipient.id, `${taskState.title} → ready for ${dependent.title}`);
    }
  }
}

function updatePhase(world: AtlasWorldState) {
  if (!world.workflowId || world.phase === "blocked") return;
  if (world.tasks.length > 0 && world.tasks.every((taskState) => taskState.status === "done")) {
    if (world.phase !== "completed") {
      world.phase = "completed";
      const definition = workflowFor(world.workflowId);
      pushEvent(world, "Workflow complete", definition.outcome);
      for (const agent of world.agents) {
        if (coordinateDistance(agent.position, homePoint(agent)) > ARRIVAL_DISTANCE) {
          agent.status = "returning";
          agent.target = { ...homePoint(agent) };
          delete agent.taskId;
        } else {
          agent.status = "idle";
        }
      }
    }
    return;
  }

  const hasActive = world.tasks.some((taskState) => taskState.status === "moving" || taskState.status === "working");
  const hasPendingApproval = world.tasks.some((taskState) => taskState.status === "waiting_approval");
  world.phase = !hasActive && hasPendingApproval ? "waiting_approval" : "running";
}

export function advanceAtlasWorld(current: AtlasWorldState, deltaMs: number) {
  const world = cloneWorld(current);
  const safeDelta = Math.min(140, Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0));
  world.now += safeDelta;
  world.messages = world.messages.filter((message) => message.expiresAt > world.now);

  for (const agent of world.agents) {
    if (agent.status === "sharing" && agent.statusUntil && world.now >= agent.statusUntil) {
      agent.status = "idle";
      delete agent.statusUntil;
    }
    if (agent.status === "returning") {
      if (moveToward(agent, homePoint(agent), safeDelta)) agent.status = "idle";
    }
  }

  if (!world.workflowId || world.phase === "idle" || world.phase === "blocked" || world.phase === "completed") return world;

  for (const taskState of world.tasks) {
    const agent = world.agents.find((candidate) => candidate.id === taskState.agentId);
    if (!agent) continue;
    if (taskState.status === "moving") {
      const destination = ATLAS_LOCATIONS[taskState.locationId].point;
      if (moveToward(agent, destination, safeDelta)) arriveAtTask(world, taskState, agent);
    } else if (taskState.status === "working") {
      const elapsed = Math.max(0, world.now - (taskState.workStartedAt ?? world.now));
      taskState.progress = Math.min(1, elapsed / Math.max(1, taskState.workMs));
      if (taskState.progress >= 1) completeTask(world, taskState, agent);
    }
  }

  beginReadyTasks(world);
  updatePhase(world);
  return world;
}

function approveTask(world: AtlasWorldState, taskId: string, approved: boolean) {
  const taskState = world.tasks.find((candidate) => candidate.id === taskId);
  const agent = taskState ? world.agents.find((candidate) => candidate.id === taskState.agentId) : undefined;
  if (!taskState || !agent) return;
  if (!approved) {
    taskState.approvalStatus = "declined";
    taskState.status = "blocked";
    agent.status = "waiting";
    world.phase = "blocked";
    pushEvent(world, "Action declined", `${taskState.title} was declined. The workflow is blocked at this checkpoint.`, { agentId: agent.id, taskId: taskState.id });
    return;
  }
  taskState.approvalStatus = "approved";
  taskState.status = "working";
  taskState.workStartedAt = world.now;
  agent.status = "working";
  pushEvent(world, "Action allowed", `${taskState.title} is continuing in simulation mode.`, { agentId: agent.id, taskId: taskState.id });
}

export function resolveAtlasApproval(current: AtlasWorldState, approvalId: string, approved: boolean) {
  const world = cloneWorld(current);
  const approval = world.approvals.find((candidate) => candidate.id === approvalId && candidate.status === "pending");
  if (!approval) return world;
  approval.status = approved ? "approved" : "declined";
  approval.resolvedAt = world.now;

  if (approval.kind === "task" && approval.taskId) {
    approveTask(world, approval.taskId, approved);
  } else if (approval.kind === "webmcp-start" && approval.workflowId) {
    if (approved) {
      const started = startAtlasWorkflow(world, approval.workflowId);
      pushEvent(started, "WebMCP request allowed", `The user allowed WebMCP to start ${workflowFor(approval.workflowId).name}.`);
      return started;
    }
    pushEvent(world, "WebMCP request declined", `The user declined ${workflowFor(approval.workflowId).name}.`);
  } else if (approval.kind === "webmcp-action") {
    if (approved && approval.taskId) {
      approveTask(world, approval.taskId, true);
    } else if (approved) {
      pushEvent(world, "WebMCP action allowed", `${approval.title} ran in simulation mode only.`, { agentId: approval.agentId });
      if (approval.agentId) pushMessage(world, approval.agentId, "human", `${approval.title} · simulated`);
    } else {
      pushEvent(world, "WebMCP action declined", approval.title, { agentId: approval.agentId });
    }
  }

  updatePhase(world);
  return world;
}

export function requestWebMcpWorkflow(current: AtlasWorldState, workflowId: WorkflowId) {
  const world = cloneWorld(current);
  if (world.approvals.some((approval) => approval.kind === "webmcp-start" && approval.workflowId === workflowId && approval.status === "pending")) return world;
  const definition = workflowFor(workflowId);
  world.approvals.push({
    id: nextId(world, "approval"),
    source: "webmcp",
    kind: "webmcp-start",
    status: "pending",
    title: `Allow WebMCP to start ${definition.name}`,
    detail: definition.summary,
    consequence: "Approving starts a local simulation workflow. It does not contact external companies or perform real-world transactions.",
    requestedAt: world.now,
    workflowId,
  });
  pushEvent(world, "WebMCP requested a workflow", `${definition.name} is waiting for user approval.`);
  return world;
}

export function requestWebMcpAction(current: AtlasWorldState, actionType: ExternalAction, agentId: string, reason: string) {
  const world = cloneWorld(current);
  const pendingTask = world.tasks.find((taskState) => taskState.actionType === actionType && taskState.status === "waiting_approval");
  if (pendingTask) {
    const existing = world.approvals.find((approval) => approval.taskId === pendingTask.id && approval.status === "pending");
    if (existing) {
      existing.source = "webmcp";
      existing.detail = `${existing.detail} WebMCP reason: ${reason.slice(0, 180)}`;
      pushEvent(world, "WebMCP surfaced a pending action", existing.title, { agentId: pendingTask.agentId, taskId: pendingTask.id });
      return world;
    }
  }

  const agent = world.agents.find((candidate) => candidate.id === agentId) ?? world.agents[0];
  const labels: Record<ExternalAction, string> = {
    reserve_capacity: "Reserve capacity",
    authorize_payment: "Authorise payment",
    release_shipment: "Release shipment",
    send_customer_update: "Send customer update",
  };
  world.approvals.push({
    id: nextId(world, "approval"),
    source: "webmcp",
    kind: "webmcp-action",
    status: "pending",
    title: `Allow WebMCP: ${labels[actionType]}`,
    detail: reason.slice(0, 220) || "WebMCP requested this simulated action.",
    consequence: "Approving records and visualises a simulated action only. No external side effect is claimed or performed.",
    requestedAt: world.now,
    taskId: pendingTask?.id,
    agentId: agent?.id,
    actionType,
  });
  pushEvent(world, "WebMCP action requested", `${labels[actionType]} is waiting for user approval.`, { agentId: agent?.id });
  return world;
}

export function atlasSnapshot(world: AtlasWorldState) {
  return {
    phase: world.phase,
    workflowId: world.workflowId ?? null,
    workflow: world.workflowId ? workflowFor(world.workflowId).name : null,
    tasks: world.tasks.map((taskState) => ({
      id: taskState.id,
      title: taskState.title,
      agentId: taskState.agentId,
      locationId: taskState.locationId,
      status: taskState.status,
      approvalStatus: taskState.approvalStatus ?? null,
      progress: Number(taskState.progress.toFixed(3)),
      dependencies: taskState.dependsOn,
      actionType: taskState.actionType ?? null,
    })),
    agents: world.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      side: agent.side,
      role: agent.role,
      status: agent.status,
      lon: Number(agent.position.lon.toFixed(6)),
      lat: Number(agent.position.lat.toFixed(6)),
      taskId: agent.taskId ?? null,
    })),
    pendingApprovals: world.approvals.filter((approval) => approval.status === "pending").map((approval) => ({
      id: approval.id,
      source: approval.source,
      title: approval.title,
      detail: approval.detail,
      consequence: approval.consequence,
      actionType: approval.actionType ?? null,
      taskId: approval.taskId ?? null,
    })),
    messages: world.messages.slice(-8).map((message) => ({
      from: message.fromAgentId,
      to: message.toAgentId,
      text: message.text,
    })),
    recentEvents: world.events.slice(0, 8).map((event) => ({ title: event.title, detail: event.detail })),
  };
}

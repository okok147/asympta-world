const now = () => new Date().toISOString();

export const WORLD_WIDTH = 1680;
export const WORLD_HEIGHT = 1040;

export const ENTITY_KINDS = Object.freeze({
  HOME: "home",
  MARKET: "market",
  FARM: "farm",
  WAREHOUSE: "warehouse",
  COURIER: "courier",
  WORKSHOP: "workshop",
  COMMUNITY: "community",
  SERVICE: "service",
});

const entityList = [
  {
    id: "home",
    name: "Home",
    nameZh: "家",
    kind: ENTITY_KINDS.HOME,
    x: 245,
    y: 690,
    width: 170,
    height: 130,
    hue: "clay",
    capabilities: ["receive_delivery", "confirm_outcome"],
  },
  {
    id: "market",
    name: "Neighbour Market",
    nameZh: "社區市場",
    kind: ENTITY_KINDS.MARKET,
    x: 735,
    y: 515,
    width: 205,
    height: 145,
    hue: "mint",
    capabilities: ["sell_food", "quote", "prepare_order"],
  },
  {
    id: "farm",
    name: "Green Farm",
    nameZh: "綠野農場",
    kind: ENTITY_KINDS.FARM,
    x: 1285,
    y: 230,
    width: 220,
    height: 155,
    hue: "leaf",
    capabilities: ["supply_food", "restock"],
  },
  {
    id: "warehouse",
    name: "Supply Hub",
    nameZh: "供應樞紐",
    kind: ENTITY_KINDS.WAREHOUSE,
    x: 1115,
    y: 600,
    width: 230,
    height: 155,
    hue: "sand",
    capabilities: ["store_resource", "reserve", "handoff"],
  },
  {
    id: "courier-hub",
    name: "Courier Hub",
    nameZh: "配送站",
    kind: ENTITY_KINDS.COURIER,
    x: 500,
    y: 235,
    width: 185,
    height: 135,
    hue: "sky",
    capabilities: ["pickup", "deliver", "route"],
  },
  {
    id: "workshop",
    name: "Maker Workshop",
    nameZh: "創作工房",
    kind: ENTITY_KINDS.WORKSHOP,
    x: 1190,
    y: 845,
    width: 205,
    height: 135,
    hue: "amber",
    capabilities: ["repair", "make", "teach_skill"],
  },
  {
    id: "community",
    name: "Community Exchange",
    nameZh: "社區交換所",
    kind: ENTITY_KINDS.COMMUNITY,
    x: 530,
    y: 865,
    width: 220,
    height: 125,
    hue: "lavender",
    capabilities: ["find_skill", "coordinate", "verify_identity"],
  },
];

const agents = [
  {
    id: "personal-agent",
    name: "Ari",
    role: "Personal agent",
    roleZh: "個人代理",
    location: "home",
    x: 325,
    y: 690,
    color: "#183f46",
    accent: "#9ce3c7",
  },
  {
    id: "market-agent",
    name: "Mira",
    role: "Market agent",
    roleZh: "市場代理",
    location: "market",
    x: 820,
    y: 520,
    color: "#204b40",
    accent: "#c6efbc",
  },
  {
    id: "supply-agent",
    name: "Sol",
    role: "Supply agent",
    roleZh: "供應代理",
    location: "warehouse",
    x: 1210,
    y: 605,
    color: "#5b4629",
    accent: "#f0cc87",
  },
  {
    id: "courier-agent",
    name: "Kite",
    role: "Courier agent",
    roleZh: "配送代理",
    location: "courier-hub",
    x: 580,
    y: 245,
    color: "#24445a",
    accent: "#9ed9ef",
  },
  {
    id: "workshop-agent",
    name: "Forge",
    role: "Workshop agent",
    roleZh: "工房代理",
    location: "workshop",
    x: 1285,
    y: 845,
    color: "#65451f",
    accent: "#f5be70",
  },
  {
    id: "community-agent",
    name: "Nori",
    role: "Community agent",
    roleZh: "社區代理",
    location: "community",
    x: 625,
    y: 865,
    color: "#493e64",
    accent: "#d4c4f4",
  },
];

const resources = {
  market: {
    groceries: { available: 40, reserved: 0, unit: "basket" },
    meal: { available: 24, reserved: 0, unit: "set" },
    food: { available: 60, reserved: 0, unit: "item" },
  },
  farm: {
    vegetables: { available: 180, reserved: 0, unit: "kg" },
    fruit: { available: 90, reserved: 0, unit: "kg" },
  },
  warehouse: {
    packaging: { available: 120, reserved: 0, unit: "box" },
    materials: { available: 80, reserved: 0, unit: "unit" },
  },
  workshop: {
    repair_slot: { available: 8, reserved: 0, unit: "slot" },
    maker_hour: { available: 16, reserved: 0, unit: "hour" },
  },
  community: {
    skill_match: { available: 32, reserved: 0, unit: "match" },
  },
};

export function createInitialWorld() {
  return {
    schemaVersion: 2,
    revision: 0,
    updatedAt: now(),
    entities: Object.fromEntries(entityList.map((entity) => [entity.id, { ...entity }])),
    agents: Object.fromEntries(agents.map((agent) => [agent.id, { ...agent, status: "idle" }])),
    resources: structuredCloneSafe(resources),
    orders: {},
    reservations: {},
    quotes: {},
    messages: [],
    evidence: [],
    events: [],
    tasks: {},
    activeTaskId: null,
    activity: {},
  };
}

export function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function entityCenter(entity) {
  return {
    x: entity.x + (entity.width ?? 0) / 2,
    y: entity.y + (entity.height ?? 0) / 2,
  };
}

export function getWorldSummary(world) {
  return {
    revision: world.revision,
    entities: Object.values(world.entities).map((entity) => ({
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      capabilities: entity.capabilities,
      resources: world.resources[entity.id] ?? {},
    })),
    agents: Object.values(world.agents).map((agent) => ({
      id: agent.id,
      role: agent.role,
      location: agent.location,
      status: agent.status,
    })),
    openOrders: Object.values(world.orders).filter((order) => order.status !== "delivered"),
    activeTask: world.activeTaskId ? world.tasks[world.activeTaskId] : null,
  };
}

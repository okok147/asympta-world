export type GlobalResourceKind = "food" | "material" | "merchandise" | "power" | "medicine";
export type GlobalTransportMode = "ship" | "air" | "rail" | "truck" | "van" | "car" | "grid";
export type GlobalNodeKind =
  | "farm"
  | "fishery"
  | "mine"
  | "factory"
  | "port"
  | "airport"
  | "power"
  | "warehouse"
  | "market"
  | "city";

export type GlobalPoint = { lon: number; lat: number };

export type GlobalNode = GlobalPoint & {
  id: string;
  name: string;
  country: string;
  kind: GlobalNodeKind;
  resources: GlobalResourceKind[];
  capacity: number;
};

export type GlobalCorridor = {
  id: string;
  fromId: string;
  toId: string;
  mode: GlobalTransportMode;
  distanceKm: number;
  realHours: number;
  demoDurationMs: number;
  handlingMs: number;
  capacityUnits: number;
  costPerUnit: number;
  energyKwhPerUnit: number;
};

export type GlobalFlow = {
  id: string;
  label: string;
  resource: GlobalResourceKind;
  commodity: string;
  originId: string;
  destinationId: string;
  corridorIds: string[];
  batchUnits: number;
  unit: string;
  unitValue: number;
  priority: 1 | 2 | 3 | 4 | 5;
  perishability: number;
  convoys: number;
  dispatchGapMs: number;
  dwellMs: number;
  agentChain: string[];
};

export type GlobalShipment = {
  id: string;
  flowId: string;
  elapsedMs: number;
  blockedUntil: number;
  rerouteAt: number;
  disruptionCode?: GlobalDisruptionCode;
  rerouteCode?: string;
  deliveredCycles: number;
};

export type GlobalInventory = {
  nodeId: string;
  resource: GlobalResourceKind;
  onHand: number;
  capacity: number;
  productionPerSecond: number;
};

export type GlobalWorldEvent = {
  id: string;
  at: number;
  title: string;
  detail: string;
  flowId?: string;
  actor?: string;
};

export type GlobalWorldMetrics = {
  deliveredBatches: number;
  deliveredUnits: number;
  deliveredValue: number;
  operatingCost: number;
  energyKwh: number;
  reroutes: number;
  shortages: number;
  powerSupplyMw: number;
  powerDemandMw: number;
  storageDispatchMw: number;
  powerBalanceMw: number;
  coldChainIntegrity: number;
  reliability: number;
};

export type GlobalWorldState = {
  version: 1;
  seed: number;
  revision: number;
  now: number;
  shipments: GlobalShipment[];
  inventories: GlobalInventory[];
  events: GlobalWorldEvent[];
  metrics: GlobalWorldMetrics;
  lastDisruptionCycle: number;
  lastPowerCycle: number;
};

export type GlobalShipmentPhase = {
  status: "moving" | "handling" | "rerouting" | "waiting_supply";
  flow: GlobalFlow;
  shipment: GlobalShipment;
  corridor: GlobalCorridor | null;
  legIndex: number;
  legProgress: number;
  point: GlobalPoint;
  heading: number;
  responsibleAgent: string;
};

export type GlobalVehicleSnapshot = GlobalShipmentPhase & {
  mode: GlobalTransportMode;
  resource: GlobalResourceKind;
  label: string;
  cargo: string;
};

export type GlobalWorldSnapshot = {
  now: number;
  activeShipments: number;
  activeFlows: number;
  modes: Record<GlobalTransportMode, number>;
  resources: Record<GlobalResourceKind, number>;
  deliveredValue: number;
  operatingCost: number;
  powerBalanceMw: number;
  reliability: number;
  coldChainIntegrity: number;
  reroutes: number;
  shortages: number;
  recentEvents: GlobalWorldEvent[];
};

export type GlobalDisruptionCode = "ocean-weather" | "airport-congestion" | "rail-capacity" | "grid-peak" | "cold-chain-risk";

export const GLOBAL_SIMULATION_STEP_MS = 180;
export const GLOBAL_SOURCE_REFRESH_MS = 650;
export const GLOBAL_CULL_REFRESH_MS = 900;
export const GLOBAL_UI_REFRESH_MS = 600;
export const GLOBAL_MAX_SHIPMENTS = 48;
export const GLOBAL_MAX_RENDERED_VEHICLES_DESKTOP = 28;
export const GLOBAL_MAX_RENDERED_VEHICLES_MOBILE = 18;

const EMPTY_MODE_COUNTS: Record<GlobalTransportMode, number> = {
  ship: 0,
  air: 0,
  rail: 0,
  truck: 0,
  van: 0,
  car: 0,
  grid: 0,
};

const EMPTY_RESOURCE_COUNTS: Record<GlobalResourceKind, number> = {
  food: 0,
  material: 0,
  merchandise: 0,
  power: 0,
  medicine: 0,
};

export const GLOBAL_NODES: readonly GlobalNode[] = [
  { id: "tokyo-city", name: "Tokyo", country: "Japan", kind: "city", lon: 139.6917, lat: 35.6895, resources: ["food", "material", "merchandise", "power", "medicine"], capacity: 2_400 },
  { id: "tokyo-market", name: "Tokyo Food Market", country: "Japan", kind: "market", lon: 139.782, lat: 35.665, resources: ["food"], capacity: 1_200 },
  { id: "tokyo-dc", name: "Tokyo Distribution", country: "Japan", kind: "warehouse", lon: 139.82, lat: 35.62, resources: ["food", "material", "merchandise", "medicine"], capacity: 1_800 },
  { id: "tokyo-grid", name: "Tokyo Grid", country: "Japan", kind: "power", lon: 139.74, lat: 35.72, resources: ["power"], capacity: 1_600 },
  { id: "yokohama-port", name: "Yokohama Port", country: "Japan", kind: "port", lon: 139.638, lat: 35.454, resources: ["food", "material", "merchandise", "power"], capacity: 3_200 },
  { id: "narita-airport", name: "Narita Cargo", country: "Japan", kind: "airport", lon: 140.3929, lat: 35.7767, resources: ["food", "merchandise", "medicine"], capacity: 1_700 },
  { id: "hokkaido-farm", name: "Hokkaido Farms", country: "Japan", kind: "farm", lon: 142.2, lat: 43.2, resources: ["food"], capacity: 1_100 },
  { id: "hokkaido-wind", name: "Hokkaido Wind", country: "Japan", kind: "power", lon: 141.1, lat: 44.4, resources: ["power"], capacity: 1_100 },
  { id: "adelaide-farm", name: "South Australia Grain", country: "Australia", kind: "farm", lon: 138.6, lat: -34.9, resources: ["food"], capacity: 2_000 },
  { id: "adelaide-port", name: "Port Adelaide", country: "Australia", kind: "port", lon: 138.5, lat: -34.78, resources: ["food"], capacity: 2_400 },
  { id: "port-hedland", name: "Pilbara Lithium", country: "Australia", kind: "mine", lon: 118.61, lat: -20.31, resources: ["material"], capacity: 1_900 },
  { id: "bergen-fishery", name: "Bergen Fisheries", country: "Norway", kind: "fishery", lon: 5.32, lat: 60.39, resources: ["food"], capacity: 900 },
  { id: "oslo-airport", name: "Oslo Air Cargo", country: "Norway", kind: "airport", lon: 11.1, lat: 60.19, resources: ["food"], capacity: 900 },
  { id: "north-sea-wind", name: "North Sea Wind", country: "North Sea", kind: "power", lon: 3.2, lat: 56.8, resources: ["power"], capacity: 1_800 },
  { id: "rotterdam-port", name: "Rotterdam", country: "Netherlands", kind: "port", lon: 4.48, lat: 51.95, resources: ["food", "material", "merchandise", "power"], capacity: 4_400 },
  { id: "frankfurt-factory", name: "Frankfurt Medical Works", country: "Germany", kind: "factory", lon: 8.68, lat: 50.11, resources: ["medicine", "material"], capacity: 1_200 },
  { id: "frankfurt-airport", name: "Frankfurt Cargo", country: "Germany", kind: "airport", lon: 8.57, lat: 50.04, resources: ["medicine", "merchandise"], capacity: 2_100 },
  { id: "bangkok-food", name: "Chao Phraya Food Basin", country: "Thailand", kind: "farm", lon: 100.5, lat: 13.75, resources: ["food"], capacity: 2_200 },
  { id: "laem-chabang", name: "Laem Chabang", country: "Thailand", kind: "port", lon: 100.89, lat: 13.08, resources: ["food", "merchandise"], capacity: 3_000 },
  { id: "shenzhen-factory", name: "Shenzhen Manufacturing", country: "China", kind: "factory", lon: 114.06, lat: 22.54, resources: ["material", "merchandise"], capacity: 3_200 },
  { id: "hong-kong-airport", name: "Hong Kong Air Cargo", country: "Hong Kong", kind: "airport", lon: 113.9185, lat: 22.308, resources: ["merchandise", "medicine"], capacity: 3_200 },
  { id: "singapore-port", name: "Singapore Port", country: "Singapore", kind: "port", lon: 103.75, lat: 1.25, resources: ["food", "material", "merchandise", "power"], capacity: 5_200 },
  { id: "singapore-airport", name: "Changi Cargo", country: "Singapore", kind: "airport", lon: 103.99, lat: 1.36, resources: ["food", "merchandise", "medicine"], capacity: 2_900 },
  { id: "qatar-lng", name: "Ras Laffan Energy", country: "Qatar", kind: "power", lon: 51.52, lat: 25.93, resources: ["power"], capacity: 3_800 },
  { id: "santos-farm", name: "Brazil Food Cooperative", country: "Brazil", kind: "farm", lon: -47.0, lat: -22.3, resources: ["food"], capacity: 2_100 },
  { id: "santos-port", name: "Port of Santos", country: "Brazil", kind: "port", lon: -46.32, lat: -23.96, resources: ["food", "material"], capacity: 3_600 },
  { id: "california-produce", name: "California Produce", country: "United States", kind: "farm", lon: -120.7, lat: 36.7, resources: ["food"], capacity: 1_900 },
  { id: "los-angeles-port", name: "Port of Los Angeles", country: "United States", kind: "port", lon: -118.27, lat: 33.74, resources: ["food", "material", "merchandise"], capacity: 4_600 },
  { id: "los-angeles-airport", name: "Los Angeles Air Cargo", country: "United States", kind: "airport", lon: -118.4085, lat: 33.9416, resources: ["food", "merchandise", "medicine"], capacity: 2_500 },
  { id: "los-angeles-market", name: "Los Angeles Market", country: "United States", kind: "market", lon: -118.2437, lat: 34.0522, resources: ["food", "merchandise"], capacity: 1_600 },
  { id: "antofagasta-mine", name: "Atacama Copper", country: "Chile", kind: "mine", lon: -70.4, lat: -23.65, resources: ["material"], capacity: 2_500 },
  { id: "valparaiso-port", name: "Valparaíso", country: "Chile", kind: "port", lon: -71.63, lat: -33.04, resources: ["material"], capacity: 2_900 },
] as const;

const corridor = (
  id: string,
  fromId: string,
  toId: string,
  mode: GlobalTransportMode,
  distanceKm: number,
  realHours: number,
  demoDurationMs: number,
  handlingMs: number,
  capacityUnits: number,
  costPerUnit: number,
  energyKwhPerUnit: number,
): GlobalCorridor => ({ id, fromId, toId, mode, distanceKm, realHours, demoDurationMs, handlingMs, capacityUnits, costPerUnit, energyKwhPerUnit });

export const GLOBAL_CORRIDORS: readonly GlobalCorridor[] = [
  corridor("adelaide-farm-port", "adelaide-farm", "adelaide-port", "truck", 28, 0.7, 1_250, 320, 90, 9, 4),
  corridor("adelaide-yokohama", "adelaide-port", "yokohama-port", "ship", 8_150, 300, 6_800, 650, 1_400, 34, 28),
  corridor("yokohama-tokyo-rail", "yokohama-port", "tokyo-dc", "rail", 42, 1.5, 1_650, 280, 420, 7, 2),
  corridor("tokyo-dc-market-van", "tokyo-dc", "tokyo-market", "van", 24, 0.8, 1_100, 180, 70, 8, 3),
  corridor("tokyo-market-city-car", "tokyo-market", "tokyo-city", "car", 11, 0.45, 900, 120, 90, 5, 2),
  corridor("bergen-oslo-cold", "bergen-fishery", "oslo-airport", "truck", 465, 7.2, 2_200, 320, 40, 28, 15),
  corridor("oslo-narita-air", "oslo-airport", "narita-airport", "air", 8_450, 13.5, 5_100, 560, 70, 118, 210),
  corridor("narita-tokyo-cold", "narita-airport", "tokyo-market", "truck", 78, 1.7, 1_650, 240, 50, 20, 8),
  corridor("hokkaido-tokyo-rail", "hokkaido-farm", "tokyo-market", "rail", 1_160, 15, 3_200, 280, 300, 15, 5),
  corridor("hokkaido-tokyo-grid", "hokkaido-wind", "tokyo-grid", "grid", 1_120, 0.08, 1_650, 100, 1_100, 3, 1),
  corridor("qatar-yokohama-lng", "qatar-lng", "yokohama-port", "ship", 10_200, 360, 7_200, 680, 1_900, 48, 35),
  corridor("yokohama-tokyo-grid", "yokohama-port", "tokyo-grid", "grid", 39, 0.03, 1_000, 90, 1_200, 4, 2),
  corridor("northsea-rotterdam-grid", "north-sea-wind", "rotterdam-port", "grid", 380, 0.04, 1_300, 90, 1_500, 3, 1),
  corridor("pilbara-shenzhen", "port-hedland", "shenzhen-factory", "ship", 5_150, 190, 5_400, 550, 1_600, 39, 31),
  corridor("shenzhen-hkg-truck", "shenzhen-factory", "hong-kong-airport", "truck", 58, 1.4, 1_450, 260, 150, 14, 6),
  corridor("hkg-narita-air", "hong-kong-airport", "narita-airport", "air", 2_950, 4.2, 3_100, 420, 180, 75, 112),
  corridor("narita-tokyo-dc", "narita-airport", "tokyo-dc", "truck", 82, 1.8, 1_600, 230, 150, 16, 7),
  corridor("tokyo-dc-city-van", "tokyo-dc", "tokyo-city", "van", 31, 1.0, 1_150, 180, 90, 9, 4),
  corridor("shenzhen-singapore", "shenzhen-factory", "singapore-port", "ship", 2_650, 96, 4_100, 480, 1_700, 25, 19),
  corridor("singapore-losangeles", "singapore-port", "los-angeles-port", "ship", 14_100, 420, 8_100, 720, 2_200, 54, 42),
  corridor("la-port-market-truck", "los-angeles-port", "los-angeles-market", "truck", 37, 1.2, 1_300, 220, 180, 14, 7),
  corridor("california-lax-truck", "california-produce", "los-angeles-airport", "truck", 340, 5.6, 2_100, 260, 70, 22, 12),
  corridor("lax-narita-air", "los-angeles-airport", "narita-airport", "air", 8_760, 12.2, 5_300, 540, 90, 124, 225),
  corridor("bangkok-laem-truck", "bangkok-food", "laem-chabang", "truck", 125, 2.7, 1_650, 260, 180, 17, 8),
  corridor("laem-yokohama", "laem-chabang", "yokohama-port", "ship", 4_650, 170, 5_000, 520, 1_500, 29, 22),
  corridor("frankfurt-airport-truck", "frankfurt-factory", "frankfurt-airport", "truck", 15, 0.45, 900, 180, 120, 10, 4),
  corridor("frankfurt-narita-air", "frankfurt-airport", "narita-airport", "air", 9_350, 13.1, 5_600, 560, 140, 132, 235),
  corridor("narita-tokyo-medicine", "narita-airport", "tokyo-city", "van", 76, 1.6, 1_550, 210, 60, 18, 7),
  corridor("santos-port-truck", "santos-farm", "santos-port", "truck", 190, 4.2, 1_900, 260, 160, 18, 9),
  corridor("santos-rotterdam", "santos-port", "rotterdam-port", "ship", 9_800, 330, 7_000, 620, 1_900, 44, 34),
  corridor("rotterdam-frankfurt-rail", "rotterdam-port", "frankfurt-factory", "rail", 450, 7.5, 2_300, 260, 420, 12, 5),
  corridor("atacama-valparaiso-rail", "antofagasta-mine", "valparaiso-port", "rail", 1_350, 24, 3_100, 300, 520, 21, 8),
  corridor("valparaiso-rotterdam", "valparaiso-port", "rotterdam-port", "ship", 12_100, 390, 7_600, 650, 2_000, 51, 39),
] as const;

const flow = (
  id: string,
  label: string,
  resource: GlobalResourceKind,
  commodity: string,
  originId: string,
  destinationId: string,
  corridorIds: string[],
  batchUnits: number,
  unit: string,
  unitValue: number,
  priority: GlobalFlow["priority"],
  perishability: number,
  convoys: number,
  dispatchGapMs: number,
  dwellMs: number,
  agentChain: string[],
): GlobalFlow => ({
  id,
  label,
  resource,
  commodity,
  originId,
  destinationId,
  corridorIds,
  batchUnits,
  unit,
  unitValue,
  priority,
  perishability,
  convoys,
  dispatchGapMs,
  dwellMs,
  agentChain,
});

export const GLOBAL_FLOWS: readonly GlobalFlow[] = [
  flow("food-grain-tokyo", "Australian grain → Tokyo dinner network", "food", "wheat and cooking grain", "adelaide-farm", "tokyo-city", ["adelaide-farm-port", "adelaide-yokohama", "yokohama-tokyo-rail", "tokyo-dc-market-van", "tokyo-market-city-car"], 42, "t", 18_000, 3, 0.12, 2, 3_700, 1_100, ["Sourcing agent", "Port agent", "Ocean freight agent", "Rail agent", "Last-mile agent"]),
  flow("food-seafood-tokyo", "Norwegian seafood → Tokyo cold chain", "food", "fresh salmon and seafood", "bergen-fishery", "tokyo-city", ["bergen-oslo-cold", "oslo-narita-air", "narita-tokyo-cold", "tokyo-market-city-car"], 12, "t", 52_000, 5, 0.92, 2, 3_100, 900, ["Food supplier agent", "Cold-chain agent", "Air cargo agent", "Customs agent", "Delivery agent"]),
  flow("food-hokkaido-tokyo", "Hokkaido produce → Tokyo kitchens", "food", "fresh vegetables and dairy", "hokkaido-farm", "tokyo-city", ["hokkaido-tokyo-rail", "tokyo-market-city-car"], 24, "t", 28_000, 4, 0.72, 2, 2_400, 800, ["Farm agent", "Rail agent", "Market agent", "Local delivery agent"]),
  flow("food-rice-tokyo", "Thai rice → Tokyo food suppliers", "food", "rice and shelf-stable food", "bangkok-food", "tokyo-city", ["bangkok-laem-truck", "laem-yokohama", "yokohama-tokyo-rail", "tokyo-dc-market-van"], 48, "t", 20_000, 3, 0.18, 2, 3_500, 1_050, ["Cooperative agent", "Port agent", "Ocean freight agent", "Warehouse agent"]),
  flow("food-california-tokyo", "California produce → Tokyo premium market", "food", "fruit and fresh produce", "california-produce", "tokyo-city", ["california-lax-truck", "lax-narita-air", "narita-tokyo-cold", "tokyo-market-city-car"], 10, "t", 46_000, 4, 0.86, 1, 4_100, 950, ["Farm agent", "Air cargo agent", "Cold-chain agent", "Retail delivery agent"]),
  flow("material-lithium-tokyo", "Pilbara lithium → Shenzhen assembly → Tokyo", "material", "lithium battery cells", "port-hedland", "tokyo-dc", ["pilbara-shenzhen", "shenzhen-hkg-truck", "hkg-narita-air", "narita-tokyo-dc"], 18, "t", 92_000, 5, 0.04, 2, 4_200, 1_200, ["Mine agent", "Factory agent", "Trade agent", "Air cargo agent", "Inventory agent"]),
  flow("material-copper-europe", "Atacama copper → European manufacturing", "material", "copper concentrate", "antofagasta-mine", "frankfurt-factory", ["atacama-valparaiso-rail", "valparaiso-rotterdam", "rotterdam-frankfurt-rail"], 65, "t", 31_000, 3, 0.02, 2, 4_800, 1_250, ["Mine agent", "Rail agent", "Ocean freight agent", "Factory supply agent"]),
  flow("merchandise-electronics-tokyo", "Shenzhen electronics → Tokyo customers", "merchandise", "consumer electronics", "shenzhen-factory", "tokyo-city", ["shenzhen-hkg-truck", "hkg-narita-air", "narita-tokyo-dc", "tokyo-dc-city-van"], 32, "pallets", 64_000, 4, 0.03, 3, 2_900, 850, ["Factory agent", "Export agent", "Air cargo agent", "Warehouse agent", "Delivery agent"]),
  flow("merchandise-pacific-retail", "Shenzhen merchandise → Singapore → Los Angeles", "merchandise", "retail merchandise", "shenzhen-factory", "los-angeles-market", ["shenzhen-singapore", "singapore-losangeles", "la-port-market-truck"], 90, "containers", 120_000, 3, 0.01, 2, 4_500, 1_350, ["Factory agent", "Transshipment agent", "Ocean freight agent", "Port agent", "Retail agent"]),
  flow("medicine-europe-tokyo", "Frankfurt medicine → Tokyo care network", "medicine", "temperature-controlled medicine", "frankfurt-factory", "tokyo-city", ["frankfurt-airport-truck", "frankfurt-narita-air", "narita-tokyo-medicine"], 8, "pallets", 180_000, 5, 0.68, 2, 3_000, 700, ["Medical supplier agent", "Quality agent", "Air cargo agent", "Customs agent", "Care delivery agent"]),
  flow("food-brazil-europe", "Brazil cooperative → European food processors", "food", "coffee and food ingredients", "santos-farm", "frankfurt-factory", ["santos-port-truck", "santos-rotterdam", "rotterdam-frankfurt-rail"], 70, "t", 24_000, 2, 0.09, 2, 4_300, 1_200, ["Cooperative agent", "Port agent", "Ocean freight agent", "Processor supply agent"]),
  flow("power-hokkaido-tokyo", "Hokkaido wind → Tokyo demand", "power", "renewable electricity", "hokkaido-wind", "tokyo-grid", ["hokkaido-tokyo-grid"], 420, "MW", 2_600, 5, 0, 3, 1_200, 300, ["Generation agent", "Grid balancing agent", "Demand agent"]),
  flow("power-lng-tokyo", "Qatar LNG reserve → Tokyo grid", "power", "dispatchable energy reserve", "qatar-lng", "tokyo-grid", ["qatar-yokohama-lng", "yokohama-tokyo-grid"], 260, "MW-equivalent", 3_800, 4, 0, 2, 4_200, 850, ["Energy sourcing agent", "LNG carrier agent", "Port agent", "Grid agent"]),
  flow("power-northsea-europe", "North Sea wind → Rotterdam industry", "power", "renewable electricity", "north-sea-wind", "rotterdam-port", ["northsea-rotterdam-grid"], 620, "MW", 2_300, 5, 0, 3, 1_100, 250, ["Offshore generation agent", "Grid agent", "Industrial demand agent"]),
] as const;

const NODE_BY_ID = new Map(GLOBAL_NODES.map((node) => [node.id, node]));
const CORRIDOR_BY_ID = new Map(GLOBAL_CORRIDORS.map((item) => [item.id, item]));
const FLOW_BY_ID = new Map(GLOBAL_FLOWS.map((item) => [item.id, item]));
const EVENT_LIMIT = 36;
const DISRUPTION_INTERVAL_MS = 14_000;
const POWER_EVENT_INTERVAL_MS = 18_000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mod(value: number, divisor: number) {
  const result = value % divisor;
  return result < 0 ? result + divisor : result;
}

function nextEventId(world: GlobalWorldState) {
  world.revision += 1;
  return `global-${world.seed.toString(36)}-${world.revision.toString(36)}`;
}

function pushEvent(world: GlobalWorldState, title: string, detail: string, flowId?: string, actor?: string) {
  world.events = [{ id: nextEventId(world), at: world.now, title, detail, flowId, actor }, ...world.events].slice(0, EVENT_LIMIT);
}

export function nodeFor(id: string) {
  return NODE_BY_ID.get(id) ?? null;
}

export function corridorFor(id: string) {
  return CORRIDOR_BY_ID.get(id) ?? null;
}

export function flowFor(id: string) {
  return FLOW_BY_ID.get(id) ?? null;
}

export function globalFlowJourneyDuration(flow: GlobalFlow) {
  return flow.corridorIds.reduce((sum, id) => {
    const item = corridorFor(id);
    return sum + (item ? item.demoDurationMs + item.handlingMs : 0);
  }, 0) + flow.dwellMs;
}

export function globalFlowRealHours(flow: GlobalFlow) {
  return flow.corridorIds.reduce((sum, id) => sum + (corridorFor(id)?.realHours ?? 0), 0);
}

function inventoryKey(nodeId: string, resource: GlobalResourceKind) {
  return `${nodeId}:${resource}`;
}

function initialInventories(): GlobalInventory[] {
  const production: Array<[string, GlobalResourceKind, number, number, number]> = [
    ["adelaide-farm", "food", 620, 980, 12],
    ["bergen-fishery", "food", 190, 310, 4.5],
    ["hokkaido-farm", "food", 420, 650, 12],
    ["bangkok-food", "food", 760, 1_080, 16],
    ["california-produce", "food", 300, 460, 4],
    ["santos-farm", "food", 860, 1_260, 18],
    ["port-hedland", "material", 380, 620, 5],
    ["antofagasta-mine", "material", 920, 1_360, 14],
    ["shenzhen-factory", "merchandise", 620, 980, 32],
    ["shenzhen-factory", "material", 320, 560, 6],
    ["frankfurt-factory", "medicine", 160, 260, 3.5],
    ["hokkaido-wind", "power", 1_000, 1_100, 9],
    ["qatar-lng", "power", 2_800, 3_800, 15],
    ["north-sea-wind", "power", 1_600, 1_800, 12],
  ];
  return production.map(([nodeId, resource, onHand, capacity, productionPerSecond]) => ({ nodeId, resource, onHand, capacity, productionPerSecond }));
}

function seedShipment(flow: GlobalFlow, convoyIndex: number, index: number): GlobalShipment {
  const duration = globalFlowJourneyDuration(flow);
  const spacing = duration / Math.max(1, flow.convoys);
  return {
    id: `${flow.id}-${convoyIndex + 1}`,
    flowId: flow.id,
    elapsedMs: spacing * convoyIndex + index * 173,
    blockedUntil: 0,
    rerouteAt: 0,
    deliveredCycles: 0,
  };
}

export function createGlobalWorld(seed = 2_026_0830): GlobalWorldState {
  const shipments: GlobalShipment[] = [];
  GLOBAL_FLOWS.forEach((item, flowIndex) => {
    for (let convoyIndex = 0; convoyIndex < item.convoys; convoyIndex += 1) {
      shipments.push(seedShipment(item, convoyIndex, flowIndex));
    }
  });

  const world: GlobalWorldState = {
    version: 1,
    seed,
    revision: 0,
    now: 0,
    shipments: shipments.slice(0, GLOBAL_MAX_SHIPMENTS),
    inventories: initialInventories(),
    events: [],
    metrics: {
      deliveredBatches: 0,
      deliveredUnits: 0,
      deliveredValue: 0,
      operatingCost: 0,
      energyKwh: 0,
      reroutes: 0,
      shortages: 0,
      powerSupplyMw: 0,
      powerDemandMw: 0,
      storageDispatchMw: 0,
      powerBalanceMw: 0,
      coldChainIntegrity: 100,
      reliability: 99.2,
    },
    lastDisruptionCycle: 0,
    lastPowerCycle: 0,
  };
  pushEvent(world, "World network online", `${GLOBAL_FLOWS.length} coordinated supply flows connected across ${new Set(GLOBAL_NODES.map((node) => node.country)).size} regions.`, undefined, "Global coordinator");
  return world;
}

function corridorSequence(flow: GlobalFlow) {
  return flow.corridorIds.map((id) => corridorFor(id)).filter((item): item is GlobalCorridor => Boolean(item));
}

function shipmentCycleElapsed(flow: GlobalFlow, shipment: GlobalShipment, lookAheadMs = 0) {
  return mod(shipment.elapsedMs + Math.max(0, lookAheadMs), globalFlowJourneyDuration(flow));
}

function responsibleAgent(flow: GlobalFlow, legIndex: number) {
  return flow.agentChain[Math.min(flow.agentChain.length - 1, Math.max(0, legIndex))] ?? "Global coordinator";
}

function shortestLongitudeDelta(fromLon: number, toLon: number) {
  let delta = toLon - fromLon;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function normalizeLongitude(lon: number) {
  let value = lon;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

export function interpolateGlobalPoint(from: GlobalPoint, to: GlobalPoint, progress: number, mode: GlobalTransportMode): GlobalPoint {
  const t = clamp(progress, 0, 1);
  const smooth = t * t * (3 - 2 * t);
  const lonDelta = shortestLongitudeDelta(from.lon, to.lon);
  const arc = Math.sin(Math.PI * smooth) * (mode === "air" ? 11 : mode === "ship" ? 4.2 : mode === "grid" ? 1.4 : 0.4);
  const northBias = from.lat + to.lat >= 0 ? arc : -arc * 0.35;
  return {
    lon: normalizeLongitude(from.lon + lonDelta * smooth),
    lat: clamp(from.lat + (to.lat - from.lat) * smooth + northBias, -78, 82),
  };
}

function headingBetween(from: GlobalPoint, to: GlobalPoint) {
  const dx = shortestLongitudeDelta(from.lon, to.lon) * Math.cos(((from.lat + to.lat) / 2) * Math.PI / 180);
  const dy = to.lat - from.lat;
  return Math.atan2(dx, dy) * 180 / Math.PI;
}

export function globalShipmentPhase(world: GlobalWorldState, shipment: GlobalShipment, lookAheadMs = 0): GlobalShipmentPhase | null {
  const flow = flowFor(shipment.flowId);
  if (!flow) return null;
  const corridors = corridorSequence(flow);
  if (!corridors.length) return null;
  const isBlocked = shipment.blockedUntil > world.now;
  const rerouting = isBlocked && shipment.rerouteAt > 0 && world.now >= shipment.rerouteAt;
  let elapsed = shipmentCycleElapsed(flow, shipment, isBlocked ? 0 : lookAheadMs);

  for (let index = 0; index < corridors.length; index += 1) {
    const item = corridors[index];
    const from = nodeFor(item.fromId);
    const to = nodeFor(item.toId);
    if (!from || !to) return null;
    if (elapsed <= item.demoDurationMs) {
      const progress = clamp(elapsed / Math.max(1, item.demoDurationMs), 0, 1);
      const point = interpolateGlobalPoint(from, to, progress, item.mode);
      return {
        status: isBlocked ? (rerouting ? "rerouting" : "waiting_supply") : "moving",
        flow,
        shipment,
        corridor: item,
        legIndex: index,
        legProgress: progress,
        point,
        heading: headingBetween(from, to),
        responsibleAgent: responsibleAgent(flow, index),
      };
    }
    elapsed -= item.demoDurationMs;
    if (elapsed <= item.handlingMs) {
      return {
        status: isBlocked ? (rerouting ? "rerouting" : "waiting_supply") : "handling",
        flow,
        shipment,
        corridor: item,
        legIndex: index,
        legProgress: 1,
        point: { lon: to.lon, lat: to.lat },
        heading: headingBetween(from, to),
        responsibleAgent: responsibleAgent(flow, index + 1),
      };
    }
    elapsed -= item.handlingMs;
  }

  const destination = nodeFor(flow.destinationId) ?? nodeFor(corridors.at(-1)?.toId ?? "");
  return destination ? {
    status: "handling",
    flow,
    shipment,
    corridor: corridors.at(-1) ?? null,
    legIndex: corridors.length - 1,
    legProgress: 1,
    point: { lon: destination.lon, lat: destination.lat },
    heading: 0,
    responsibleAgent: flow.agentChain.at(-1) ?? "Destination agent",
  } : null;
}

export function globalVehicleSnapshot(world: GlobalWorldState, shipment: GlobalShipment, lookAheadMs = 0): GlobalVehicleSnapshot | null {
  const phase = globalShipmentPhase(world, shipment, lookAheadMs);
  if (!phase) return null;
  return {
    ...phase,
    mode: phase.corridor?.mode ?? "truck",
    resource: phase.flow.resource,
    label: phase.flow.label,
    cargo: `${phase.flow.batchUnits.toLocaleString("en-US")} ${phase.flow.unit} ${phase.flow.commodity}`,
  };
}

function shipmentCostRate(flow: GlobalFlow, corridor: GlobalCorridor) {
  return (flow.batchUnits * corridor.costPerUnit) / Math.max(1, corridor.demoDurationMs);
}

function shipmentEnergyRate(flow: GlobalFlow, corridor: GlobalCorridor) {
  return (flow.batchUnits * corridor.energyKwhPerUnit) / Math.max(1, corridor.demoDurationMs);
}

function replenishInventories(world: GlobalWorldState, deltaMs: number) {
  const seconds = deltaMs / 1_000;
  for (const item of world.inventories) {
    item.onHand = Math.min(item.capacity, item.onHand + item.productionPerSecond * seconds);
  }
}

function consumeOriginForNextBatch(world: GlobalWorldState, flow: GlobalFlow) {
  const item = world.inventories.find((candidate) => candidate.nodeId === flow.originId && candidate.resource === flow.resource);
  if (!item || flow.resource === "power") return true;
  if (item.onHand + 0.001 >= flow.batchUnits) {
    item.onHand = Math.max(0, item.onHand - flow.batchUnits);
    return true;
  }
  world.metrics.shortages += 1;
  pushEvent(world, "Supply constraint detected", `${flow.commodity} stock at ${nodeFor(flow.originId)?.name ?? flow.originId} fell below the next batch. Sourcing agents split the order across the cooperative network.`, flow.id, "Sourcing agent");
  item.onHand = Math.max(0, item.onHand - Math.min(item.onHand, flow.batchUnits));
  return false;
}

function deliverBatch(world: GlobalWorldState, flow: GlobalFlow, shipment: GlobalShipment) {
  const destination = world.inventories.find((candidate) => candidate.nodeId === flow.destinationId && candidate.resource === flow.resource);
  if (destination) destination.onHand = Math.min(destination.capacity, destination.onHand + flow.batchUnits);
  world.metrics.deliveredBatches += 1;
  world.metrics.deliveredUnits += flow.batchUnits;
  world.metrics.deliveredValue += flow.batchUnits * flow.unitValue;
  shipment.deliveredCycles += 1;
  if (flow.perishability > 0.6) {
    world.metrics.coldChainIntegrity = clamp(world.metrics.coldChainIntegrity + 0.04, 92, 100);
  }
}

function advanceShipment(world: GlobalWorldState, shipment: GlobalShipment, deltaMs: number) {
  const flow = flowFor(shipment.flowId);
  if (!flow) return;
  const phase = globalShipmentPhase(world, shipment);
  if (phase?.corridor && phase.status === "moving") {
    world.metrics.operatingCost += shipmentCostRate(flow, phase.corridor) * deltaMs;
    world.metrics.energyKwh += shipmentEnergyRate(flow, phase.corridor) * deltaMs;
  }

  if (shipment.blockedUntil > world.now) return;
  if (shipment.disruptionCode && shipment.blockedUntil <= world.now) {
    shipment.disruptionCode = undefined;
    shipment.rerouteAt = 0;
  }

  const duration = globalFlowJourneyDuration(flow);
  const previousCycle = Math.floor(shipment.elapsedMs / duration);
  shipment.elapsedMs += deltaMs;
  const nextCycle = Math.floor(shipment.elapsedMs / duration);
  if (nextCycle <= previousCycle) return;

  const completed = nextCycle - previousCycle;
  for (let index = 0; index < completed; index += 1) {
    deliverBatch(world, flow, shipment);
    const fullySupplied = consumeOriginForNextBatch(world, flow);
    if (!fullySupplied) {
      shipment.blockedUntil = world.now + 900;
      shipment.rerouteAt = world.now + 360;
      shipment.disruptionCode = "cold-chain-risk";
      shipment.rerouteCode = "cooperative-split-source";
      world.metrics.reroutes += 1;
    }
  }
}

function chooseDisruption(world: GlobalWorldState) {
  const candidates = world.shipments
    .map((shipment) => globalShipmentPhase(world, shipment))
    .filter((phase): phase is GlobalShipmentPhase => Boolean(phase?.corridor) && phase?.status === "moving");
  if (!candidates.length) return;
  const index = Math.abs((world.seed + world.lastDisruptionCycle * 17) % candidates.length);
  const phase = candidates[index];
  const mode = phase.corridor?.mode ?? "truck";
  const code: GlobalDisruptionCode = mode === "ship"
    ? "ocean-weather"
    : mode === "air"
      ? "airport-congestion"
      : mode === "rail"
        ? "rail-capacity"
        : mode === "grid"
          ? "grid-peak"
          : phase.flow.perishability > 0.6
            ? "cold-chain-risk"
            : "rail-capacity";
  const shipment = world.shipments.find((item) => item.id === phase.shipment.id);
  if (!shipment) return;
  shipment.disruptionCode = code;
  shipment.blockedUntil = world.now + 1_650;
  shipment.rerouteAt = world.now + 620;
  shipment.rerouteCode = code === "ocean-weather"
    ? "alternate-port-slot"
    : code === "airport-congestion"
      ? "priority-cargo-window"
      : code === "grid-peak"
        ? "storage-and-reserve-dispatch"
        : code === "cold-chain-risk"
          ? "cold-store-cross-dock"
          : "alternate-rail-capacity";
  world.metrics.reroutes += 1;
  world.metrics.reliability = clamp(world.metrics.reliability - 0.18, 92, 100);
  if (code === "cold-chain-risk") world.metrics.coldChainIntegrity = clamp(world.metrics.coldChainIntegrity - 0.45, 90, 100);
  pushEvent(world, "Network constraint", `${phase.responsibleAgent} detected ${code.replaceAll("-", " ")} on ${phase.flow.label}.`, phase.flow.id, phase.responsibleAgent);
  pushEvent(world, "Agents rerouted the flow", `${phase.flow.agentChain.at(-1) ?? "Global coordinator"} reserved ${shipment.rerouteCode?.replaceAll("-", " ")} and protected the committed delivery.`, phase.flow.id, "Global coordinator");
}

function updatePower(world: GlobalWorldState) {
  const wave = Math.sin(world.now / 6_500);
  const windWave = Math.sin(world.now / 4_300 + 0.8);
  const supply = 1_760 + windWave * 165;
  const demand = 1_820 + wave * 210;
  const storage = clamp(demand - supply, 0, 180);
  world.metrics.powerSupplyMw = supply;
  world.metrics.powerDemandMw = demand;
  world.metrics.storageDispatchMw = storage;
  world.metrics.powerBalanceMw = supply + storage - demand;
  const reliabilityTarget = 99.4 - world.metrics.shortages * 0.08 - Math.max(0, -world.metrics.powerBalanceMw) * 0.002;
  world.metrics.reliability += (clamp(reliabilityTarget, 92, 99.8) - world.metrics.reliability) * 0.035;
}

function maybeTriggerPowerCoordination(world: GlobalWorldState) {
  const cycle = Math.floor(world.now / POWER_EVENT_INTERVAL_MS);
  if (cycle <= world.lastPowerCycle) return;
  world.lastPowerCycle = cycle;
  const dispatch = Math.round(world.metrics.storageDispatchMw);
  pushEvent(world, "Power agents balanced demand", `Grid agents dispatched ${dispatch} MW of storage and reserve while preserving food cold-chain and port operations.`, "power-hokkaido-tokyo", "Grid balancing agent");
}

export function advanceGlobalWorld(current: GlobalWorldState, deltaMs: number): GlobalWorldState {
  const world = clone(current);
  const safeDelta = clamp(Number.isFinite(deltaMs) ? deltaMs : 0, 0, 900);
  world.now += safeDelta;
  replenishInventories(world, safeDelta);
  for (const shipment of world.shipments) advanceShipment(world, shipment, safeDelta);
  updatePower(world);

  const disruptionCycle = Math.floor(world.now / DISRUPTION_INTERVAL_MS);
  if (disruptionCycle > world.lastDisruptionCycle) {
    world.lastDisruptionCycle = disruptionCycle;
    if (disruptionCycle > 0) chooseDisruption(world);
  }
  maybeTriggerPowerCoordination(world);
  world.metrics.operatingCost = Math.max(0, world.metrics.operatingCost);
  world.metrics.energyKwh = Math.max(0, world.metrics.energyKwh);
  return world;
}

export function globalWorldSnapshot(world: GlobalWorldState): GlobalWorldSnapshot {
  const modes = { ...EMPTY_MODE_COUNTS };
  const resources = { ...EMPTY_RESOURCE_COUNTS };
  for (const shipment of world.shipments) {
    const phase = globalShipmentPhase(world, shipment);
    if (!phase?.corridor) continue;
    modes[phase.corridor.mode] += 1;
    resources[phase.flow.resource] += 1;
  }
  return {
    now: world.now,
    activeShipments: world.shipments.length,
    activeFlows: GLOBAL_FLOWS.length,
    modes,
    resources,
    deliveredValue: Math.round(world.metrics.deliveredValue),
    operatingCost: Math.round(world.metrics.operatingCost),
    powerBalanceMw: Math.round(world.metrics.powerBalanceMw),
    reliability: Number(world.metrics.reliability.toFixed(1)),
    coldChainIntegrity: Number(world.metrics.coldChainIntegrity.toFixed(1)),
    reroutes: world.metrics.reroutes,
    shortages: world.metrics.shortages,
    recentEvents: world.events.slice(0, 8),
  };
}

export function globalMissionForWorkflow(workflowName: string | null | undefined): GlobalResourceKind {
  if (!workflowName) return "food";
  const value = workflowName.toLowerCase();
  if (value.includes("dinner")) return "food";
  if (value.includes("launch")) return "merchandise";
  if (value.includes("recovery")) return "medicine";
  if (value.includes("order")) return "material";
  return "power";
}

export function globalFlowsForResource(resource: GlobalResourceKind) {
  return GLOBAL_FLOWS.filter((item) => item.resource === resource);
}

function angularDistance(a: GlobalPoint, b: GlobalPoint) {
  const lon = shortestLongitudeDelta(a.lon, b.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const lat = a.lat - b.lat;
  return Math.hypot(lon, lat);
}

function allowedModesAtZoom(zoom: number) {
  if (zoom <= 2.6) return new Set<GlobalTransportMode>(["ship", "air", "grid"]);
  if (zoom <= 5.5) return new Set<GlobalTransportMode>(["ship", "air", "grid", "rail", "truck"]);
  return new Set<GlobalTransportMode>(["rail", "truck", "van", "car", "air", "grid"]);
}

export function selectGlobalVehicles(
  world: GlobalWorldState,
  center: GlobalPoint,
  zoom: number,
  maximum: number,
  lookAheadMs = 0,
): GlobalVehicleSnapshot[] {
  const modes = allowedModesAtZoom(zoom);
  const max = Math.max(1, Math.min(GLOBAL_MAX_RENDERED_VEHICLES_DESKTOP, Math.floor(maximum)));
  return world.shipments
    .map((shipment) => globalVehicleSnapshot(world, shipment, lookAheadMs))
    .filter((item): item is GlobalVehicleSnapshot => item !== null && modes.has(item.mode))
    .filter((item) => zoom <= 2.6 || angularDistance(item.point, center) <= (zoom <= 5.5 ? 120 : 30))
    .sort((a, b) => {
      const priority = b.flow.priority - a.flow.priority;
      if (priority) return priority;
      return angularDistance(a.point, center) - angularDistance(b.point, center);
    })
    .slice(0, max);
}

export function globalCorridorPolyline(corridorId: string, segments = 24) {
  const item = corridorFor(corridorId);
  if (!item) return [] as GlobalPoint[];
  const from = nodeFor(item.fromId);
  const to = nodeFor(item.toId);
  if (!from || !to) return [] as GlobalPoint[];
  const count = Math.max(2, Math.min(64, Math.floor(segments)));
  return Array.from({ length: count + 1 }, (_, index) => interpolateGlobalPoint(from, to, index / count, item.mode));
}

export function globalWorldInvariantViolations(world: GlobalWorldState) {
  const violations: string[] = [];
  if (world.version !== 1) violations.push("unsupported-version");
  if (world.shipments.length > GLOBAL_MAX_SHIPMENTS) violations.push("shipment-budget-exceeded");
  if (new Set(world.shipments.map((item) => item.id)).size !== world.shipments.length) violations.push("duplicate-shipment-id");
  for (const item of GLOBAL_CORRIDORS) {
    if (!nodeFor(item.fromId) || !nodeFor(item.toId)) violations.push(`corridor-node-missing:${item.id}`);
    if (item.demoDurationMs <= 0 || item.capacityUnits <= 0) violations.push(`invalid-corridor:${item.id}`);
  }
  for (const item of GLOBAL_FLOWS) {
    if (!nodeFor(item.originId) || !nodeFor(item.destinationId)) violations.push(`flow-node-missing:${item.id}`);
    if (!item.corridorIds.length || item.corridorIds.some((id) => !corridorFor(id))) violations.push(`flow-corridor-missing:${item.id}`);
    const minimumCapacity = Math.min(...item.corridorIds.map((id) => corridorFor(id)?.capacityUnits ?? 0));
    if (item.batchUnits > minimumCapacity) violations.push(`flow-capacity-exceeded:${item.id}`);
  }
  for (const item of world.inventories) {
    if (!Number.isFinite(item.onHand) || item.onHand < -0.001 || item.onHand > item.capacity + 0.001) violations.push(`invalid-inventory:${inventoryKey(item.nodeId, item.resource)}`);
  }
  for (const value of Object.values(world.metrics)) {
    if (!Number.isFinite(value)) violations.push("non-finite-metric");
  }
  return [...new Set(violations)];
}

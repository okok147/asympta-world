import { ATLAS_LOCATIONS, type StakeholderSide } from "@/lib/atlas-simulation";

export type BusinessResourceKey =
  | "cash"
  | "materials"
  | "inventory"
  | "capacity"
  | "delivery"
  | "trust"
  | "demand"
  | "skills";

export type BusinessCaseId =
  | "retail-restock"
  | "equipment-breakdown"
  | "b2b-procurement"
  | "popup-launch"
  | "product-recall"
  | "field-service";

export type BusinessAction =
  | "forecast"
  | "reserve"
  | "transfer"
  | "approve"
  | "reroute"
  | "inspect"
  | "recover"
  | "negotiate";

export type PrincipalRole =
  | "consumer"
  | "businessOwner"
  | "merchandiser"
  | "retailBuyer"
  | "procurementLead"
  | "supplierOwner"
  | "factoryManager"
  | "operationsManager"
  | "warehouseManager"
  | "financeDirector"
  | "logisticsManager"
  | "qualityAuditor"
  | "supportLead"
  | "marketStrategist"
  | "serviceTechnician";

export type ResourceWallet = Record<BusinessResourceKey, number>;

export type BusinessPrincipal = {
  id: string;
  name: string;
  side: StakeholderSide;
  role: PrincipalRole;
  organisation: string;
  locationId: keyof typeof ATLAS_LOCATIONS;
  resources: ResourceWallet;
};

export type BusinessEvent = {
  id: string;
  from: string;
  to: string;
  action: BusinessAction;
  resource: BusinessResourceKey;
  amount: number;
  missionImpact: number;
};

export type BusinessCase = {
  id: BusinessCaseId;
  participants: string[];
  events: BusinessEvent[];
};

export type BusinessNetworkState = {
  caseId: BusinessCaseId;
  step: number;
  cycle: number;
  missionScore: number;
  wallets: Record<string, ResourceWallet>;
  latestEvent: BusinessEvent | null;
};

export type BusinessNetworkSnapshot = {
  caseId: BusinessCaseId;
  step: number;
  cycle: number;
  missionScore: number;
  missionImpact: number;
  resources: ResourceWallet;
  participants: BusinessPrincipal[];
  latestEvent: BusinessEvent | null;
};

const wallet = (
  cash: number,
  materials: number,
  inventory: number,
  capacity: number,
  delivery: number,
  trust: number,
  demand: number,
  skills: number,
): ResourceWallet => ({ cash, materials, inventory, capacity, delivery, trust, demand, skills });

export const BUSINESS_PRINCIPALS: BusinessPrincipal[] = [
  { id: "principal-consumer", name: "Mina", side: "customer", role: "consumer", organisation: "Household demand", locationId: "shibuya", resources: wallet(48, 8, 4, 10, 18, 74, 82, 30) },
  { id: "principal-owner", name: "Aoi", side: "business", role: "businessOwner", organisation: "Independent business", locationId: "marunouchi", resources: wallet(76, 34, 44, 64, 40, 66, 70, 60) },
  { id: "principal-merch", name: "Mori", side: "market", role: "merchandiser", organisation: "Merchandising team", locationId: "ueno", resources: wallet(54, 24, 62, 50, 38, 68, 86, 72) },
  { id: "principal-buyer", name: "Ren", side: "customer", role: "retailBuyer", organisation: "Retail buying office", locationId: "shinjuku", resources: wallet(70, 28, 58, 46, 32, 62, 78, 66) },
  { id: "principal-procurement", name: "Rin", side: "operations", role: "procurementLead", organisation: "Procurement desk", locationId: "nihonbashi", resources: wallet(68, 48, 44, 58, 30, 64, 54, 76) },
  { id: "principal-supplier", name: "Sora", side: "supplier", role: "supplierOwner", organisation: "Primary supplier", locationId: "toyosu", resources: wallet(58, 86, 70, 78, 38, 60, 42, 68) },
  { id: "principal-factory", name: "Tetsu", side: "supplier", role: "factoryManager", organisation: "Production plant", locationId: "shinagawa", resources: wallet(52, 74, 48, 88, 26, 64, 40, 82) },
  { id: "principal-ops", name: "Kai", side: "operations", role: "operationsManager", organisation: "Operations control", locationId: "hamamatsucho", resources: wallet(60, 44, 52, 76, 58, 70, 48, 84) },
  { id: "principal-warehouse", name: "Nao", side: "operations", role: "warehouseManager", organisation: "Distribution centre", locationId: "shinagawa", resources: wallet(46, 54, 82, 72, 68, 62, 40, 70) },
  { id: "principal-finance", name: "Nami", side: "finance", role: "financeDirector", organisation: "Finance control", locationId: "otemachi", resources: wallet(92, 18, 20, 34, 28, 72, 44, 74) },
  { id: "principal-logistics", name: "Haru", side: "logistics", role: "logisticsManager", organisation: "Delivery network", locationId: "hamamatsucho", resources: wallet(50, 22, 38, 58, 92, 62, 44, 78) },
  { id: "principal-quality", name: "Toma", side: "quality", role: "qualityAuditor", organisation: "Quality assurance", locationId: "nihonbashi", resources: wallet(44, 34, 32, 46, 28, 90, 36, 88) },
  { id: "principal-support", name: "Yui", side: "support", role: "supportLead", organisation: "Customer operations", locationId: "roppongi", resources: wallet(42, 18, 28, 44, 34, 88, 62, 82) },
  { id: "principal-market", name: "Emi", side: "market", role: "marketStrategist", organisation: "Market intelligence", locationId: "ueno", resources: wallet(48, 16, 22, 38, 24, 72, 94, 86) },
  { id: "principal-technician", name: "Daiki", side: "quality", role: "serviceTechnician", organisation: "Field service", locationId: "roppongi", resources: wallet(38, 52, 26, 54, 42, 76, 28, 96) },
];

const event = (
  id: string,
  from: string,
  to: string,
  action: BusinessAction,
  resource: BusinessResourceKey,
  amount: number,
  missionImpact: number,
): BusinessEvent => ({ id, from, to, action, resource, amount, missionImpact });

export const BUSINESS_CASES: BusinessCase[] = [
  {
    id: "retail-restock",
    participants: ["principal-consumer", "principal-owner", "principal-merch", "principal-buyer", "principal-supplier", "principal-warehouse", "principal-finance", "principal-logistics"],
    events: [
      event("rr-demand", "principal-consumer", "principal-merch", "forecast", "demand", 12, -2),
      event("rr-buy", "principal-merch", "principal-buyer", "transfer", "demand", 9, 2),
      event("rr-reserve", "principal-buyer", "principal-supplier", "reserve", "inventory", 10, 4),
      event("rr-fund", "principal-finance", "principal-owner", "approve", "cash", 8, 3),
      event("rr-slot", "principal-supplier", "principal-warehouse", "reserve", "capacity", 8, 4),
      event("rr-stock", "principal-warehouse", "principal-owner", "transfer", "inventory", 9, 5),
      event("rr-route", "principal-logistics", "principal-owner", "reroute", "delivery", 7, 3),
      event("rr-trust", "principal-owner", "principal-consumer", "recover", "trust", 6, 4),
    ],
  },
  {
    id: "equipment-breakdown",
    participants: ["principal-owner", "principal-factory", "principal-technician", "principal-supplier", "principal-ops", "principal-finance", "principal-quality", "principal-support"],
    events: [
      event("eb-fail", "principal-factory", "principal-ops", "forecast", "capacity", 12, -8),
      event("eb-diagnose", "principal-technician", "principal-factory", "inspect", "skills", 8, 4),
      event("eb-part", "principal-supplier", "principal-technician", "transfer", "materials", 9, 5),
      event("eb-budget", "principal-finance", "principal-owner", "approve", "cash", 7, 3),
      event("eb-plan", "principal-ops", "principal-factory", "reroute", "capacity", 7, 4),
      event("eb-fix", "principal-technician", "principal-factory", "recover", "skills", 10, 7),
      event("eb-qa", "principal-quality", "principal-owner", "inspect", "trust", 6, 5),
      event("eb-update", "principal-support", "principal-owner", "recover", "trust", 5, 3),
    ],
  },
  {
    id: "b2b-procurement",
    participants: ["principal-owner", "principal-buyer", "principal-procurement", "principal-supplier", "principal-quality", "principal-finance", "principal-warehouse", "principal-logistics"],
    events: [
      event("bp-rfq", "principal-buyer", "principal-procurement", "forecast", "demand", 8, 1),
      event("bp-quote", "principal-supplier", "principal-procurement", "negotiate", "materials", 7, 2),
      event("bp-sample", "principal-supplier", "principal-quality", "transfer", "materials", 5, 3),
      event("bp-quality", "principal-quality", "principal-buyer", "inspect", "trust", 7, 5),
      event("bp-credit", "principal-finance", "principal-owner", "approve", "cash", 10, 4),
      event("bp-contract", "principal-procurement", "principal-supplier", "reserve", "capacity", 9, 5),
      event("bp-space", "principal-warehouse", "principal-owner", "reserve", "inventory", 8, 4),
      event("bp-ship", "principal-logistics", "principal-owner", "transfer", "delivery", 8, 4),
    ],
  },
  {
    id: "popup-launch",
    participants: ["principal-owner", "principal-merch", "principal-market", "principal-supplier", "principal-finance", "principal-warehouse", "principal-logistics", "principal-ops"],
    events: [
      event("pl-demand", "principal-market", "principal-merch", "forecast", "demand", 11, 3),
      event("pl-range", "principal-merch", "principal-owner", "negotiate", "inventory", 8, 3),
      event("pl-stock", "principal-supplier", "principal-warehouse", "reserve", "inventory", 10, 4),
      event("pl-budget", "principal-finance", "principal-owner", "approve", "cash", 9, 4),
      event("pl-space", "principal-ops", "principal-owner", "reserve", "capacity", 8, 4),
      event("pl-pick", "principal-warehouse", "principal-logistics", "transfer", "inventory", 8, 4),
      event("pl-deliver", "principal-logistics", "principal-owner", "reroute", "delivery", 9, 5),
      event("pl-open", "principal-owner", "principal-market", "recover", "trust", 7, 5),
    ],
  },
  {
    id: "product-recall",
    participants: ["principal-quality", "principal-owner", "principal-supplier", "principal-warehouse", "principal-logistics", "principal-support", "principal-finance", "principal-market"],
    events: [
      event("pr-alert", "principal-quality", "principal-owner", "inspect", "trust", 10, -8),
      event("pr-quarantine", "principal-owner", "principal-warehouse", "reserve", "inventory", 11, 4),
      event("pr-return", "principal-logistics", "principal-warehouse", "reroute", "delivery", 8, 3),
      event("pr-notify", "principal-support", "principal-market", "transfer", "trust", 8, 2),
      event("pr-reserve", "principal-finance", "principal-owner", "approve", "cash", 8, 3),
      event("pr-root", "principal-supplier", "principal-quality", "inspect", "materials", 7, 4),
      event("pr-replace", "principal-supplier", "principal-warehouse", "transfer", "inventory", 9, 5),
      event("pr-recover", "principal-market", "principal-support", "recover", "trust", 8, 7),
    ],
  },
  {
    id: "field-service",
    participants: ["principal-consumer", "principal-support", "principal-ops", "principal-technician", "principal-supplier", "principal-logistics", "principal-finance", "principal-quality"],
    events: [
      event("fs-ticket", "principal-consumer", "principal-support", "forecast", "trust", 7, -3),
      event("fs-triage", "principal-support", "principal-ops", "transfer", "skills", 6, 2),
      event("fs-dispatch", "principal-ops", "principal-technician", "reroute", "capacity", 7, 4),
      event("fs-diagnose", "principal-technician", "principal-supplier", "inspect", "skills", 8, 4),
      event("fs-part", "principal-supplier", "principal-logistics", "transfer", "materials", 7, 4),
      event("fs-delivery", "principal-logistics", "principal-technician", "reroute", "delivery", 7, 4),
      event("fs-warranty", "principal-finance", "principal-consumer", "approve", "cash", 6, 3),
      event("fs-close", "principal-quality", "principal-consumer", "recover", "trust", 8, 6),
    ],
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function businessPrincipal(id: string) {
  return BUSINESS_PRINCIPALS.find((principal) => principal.id === id) ?? BUSINESS_PRINCIPALS[0];
}

export function businessCase(id: BusinessCaseId) {
  return BUSINESS_CASES.find((item) => item.id === id) ?? BUSINESS_CASES[0];
}

function cloneWallet(value: ResourceWallet): ResourceWallet {
  return { ...value };
}

export function createBusinessNetwork(caseId: BusinessCaseId = "retail-restock"): BusinessNetworkState {
  const config = businessCase(caseId);
  const wallets: Record<string, ResourceWallet> = {};
  for (const id of config.participants) wallets[id] = cloneWallet(businessPrincipal(id).resources);
  return { caseId, step: 0, cycle: 0, missionScore: 50, wallets, latestEvent: null };
}

export function advanceBusinessNetwork(current: BusinessNetworkState): BusinessNetworkState {
  const config = businessCase(current.caseId);
  if (!config.events.length) return current;
  const eventItem = config.events[current.step % config.events.length];
  const wallets = Object.fromEntries(Object.entries(current.wallets).map(([id, value]) => [id, cloneWallet(value)])) as Record<string, ResourceWallet>;
  const fromWallet = wallets[eventItem.from];
  const toWallet = wallets[eventItem.to];
  if (fromWallet && toWallet) {
    const available = Math.max(0, fromWallet[eventItem.resource]);
    const moved = Math.min(eventItem.amount, available * 0.22 + eventItem.amount * 0.78);
    fromWallet[eventItem.resource] = clamp(fromWallet[eventItem.resource] - moved * 0.32);
    toWallet[eventItem.resource] = clamp(toWallet[eventItem.resource] + moved * 0.68);
  }
  const nextStep = (current.step + 1) % config.events.length;
  return {
    caseId: current.caseId,
    step: nextStep,
    cycle: current.cycle + (nextStep === 0 ? 1 : 0),
    missionScore: clamp(current.missionScore + eventItem.missionImpact, 18, 92),
    wallets,
    latestEvent: eventItem,
  };
}

function aggregateResource(state: BusinessNetworkState, key: BusinessResourceKey) {
  const values = Object.values(state.wallets).map((item) => item[key]);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function businessNetworkSnapshot(state: BusinessNetworkState): BusinessNetworkSnapshot {
  const config = businessCase(state.caseId);
  return {
    caseId: state.caseId,
    step: state.step,
    cycle: state.cycle,
    missionScore: Math.round(state.missionScore),
    missionImpact: Math.round(state.missionScore - 50),
    resources: {
      cash: aggregateResource(state, "cash"),
      materials: aggregateResource(state, "materials"),
      inventory: aggregateResource(state, "inventory"),
      capacity: aggregateResource(state, "capacity"),
      delivery: aggregateResource(state, "delivery"),
      trust: aggregateResource(state, "trust"),
      demand: aggregateResource(state, "demand"),
      skills: aggregateResource(state, "skills"),
    },
    participants: config.participants.map(businessPrincipal),
    latestEvent: state.latestEvent,
  };
}

import type {
  AsymptaAgentId,
  AsymptaLocationId,
  IntentAgentState,
  StakeholderSide,
  WorldPoint,
} from "./types.ts";

export type IntentLocation = {
  id: AsymptaLocationId;
  label: string;
  shortLabel: string;
  point: WorldPoint;
};

export const INTENT_LOCATIONS: Readonly<Record<AsymptaLocationId, IntentLocation>> = {
  "intent-studio": { id: "intent-studio", label: "Intent studio", shortLabel: "Intent", point: { x: 14, y: 70 } },
  "customer-desk": { id: "customer-desk", label: "Customer desk", shortLabel: "Customer", point: { x: 22, y: 25 } },
  "market-library": { id: "market-library", label: "Market library", shortLabel: "Evidence", point: { x: 39, y: 13 } },
  "business-hub": { id: "business-hub", label: "Business hub", shortLabel: "Business", point: { x: 50, y: 42 } },
  "supplier-yard": { id: "supplier-yard", label: "Supplier yard", shortLabel: "Supply", point: { x: 72, y: 18 } },
  "operations-floor": { id: "operations-floor", label: "Operations floor", shortLabel: "Operations", point: { x: 67, y: 60 } },
  "finance-gate": { id: "finance-gate", label: "Finance gate", shortLabel: "Finance", point: { x: 43, y: 76 } },
  "quality-lab": { id: "quality-lab", label: "Quality lab", shortLabel: "Quality", point: { x: 79, y: 78 } },
  "dispatch-bay": { id: "dispatch-bay", label: "Dispatch bay", shortLabel: "Dispatch", point: { x: 90, y: 43 } },
  "support-desk": { id: "support-desk", label: "Support desk", shortLabel: "Support", point: { x: 24, y: 88 } },
};

type AgentBlueprint = {
  id: AsymptaAgentId;
  name: string;
  role: string;
  organisation: string;
  side: StakeholderSide;
  homeLocationId: AsymptaLocationId;
};

export const INTENT_AGENT_BLUEPRINTS: readonly AgentBlueprint[] = [
  { id: "agent-user", name: "Mina", role: "Intent steward", organisation: "You", side: "user", homeLocationId: "intent-studio" },
  { id: "agent-customer", name: "Ren", role: "Constraint advocate", organisation: "User side", side: "customer", homeLocationId: "customer-desk" },
  { id: "agent-market", name: "Emi", role: "Evidence scout", organisation: "Research network", side: "market", homeLocationId: "market-library" },
  { id: "agent-business", name: "Aoi", role: "Coordination lead", organisation: "Business network", side: "business", homeLocationId: "business-hub" },
  { id: "agent-supplier", name: "Sora", role: "Supply coordinator", organisation: "Supply network", side: "supplier", homeLocationId: "supplier-yard" },
  { id: "agent-operations", name: "Kai", role: "Execution planner", organisation: "Operations", side: "operations", homeLocationId: "operations-floor" },
  { id: "agent-finance", name: "Nami", role: "Commitment controller", organisation: "Finance", side: "finance", homeLocationId: "finance-gate" },
  { id: "agent-quality", name: "Toma", role: "Outcome verifier", organisation: "Quality assurance", side: "quality", homeLocationId: "quality-lab" },
  { id: "agent-logistics", name: "Haru", role: "Handoff coordinator", organisation: "Delivery network", side: "logistics", homeLocationId: "dispatch-bay" },
  { id: "agent-support", name: "Yui", role: "Completion steward", organisation: "Support", side: "support", homeLocationId: "support-desk" },
] as const;

export const INTENT_AGENT_BY_ID = Object.freeze(Object.fromEntries(
  INTENT_AGENT_BLUEPRINTS.map((agent) => [agent.id, agent]),
)) as Readonly<Record<AsymptaAgentId, AgentBlueprint>>;

export function createIntentAgents(): IntentAgentState[] {
  return INTENT_AGENT_BLUEPRINTS.map((agent) => {
    const point = INTENT_LOCATIONS[agent.homeLocationId].point;
    return {
      ...agent,
      position: { ...point },
      target: { ...point },
      status: "idle",
      taskId: null,
      statusUntil: null,
    };
  });
}

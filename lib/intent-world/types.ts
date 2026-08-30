export const ASYMPTA_AGENT_IDS = [
  "agent-user",
  "agent-customer",
  "agent-business",
  "agent-supplier",
  "agent-operations",
  "agent-finance",
  "agent-logistics",
  "agent-support",
  "agent-quality",
  "agent-market",
] as const;

export type AsymptaAgentId = (typeof ASYMPTA_AGENT_IDS)[number];

export const ASYMPTA_LOCATION_IDS = [
  "intent-studio",
  "customer-desk",
  "market-library",
  "business-hub",
  "supplier-yard",
  "operations-floor",
  "finance-gate",
  "quality-lab",
  "dispatch-bay",
  "support-desk",
] as const;

export type AsymptaLocationId = (typeof ASYMPTA_LOCATION_IDS)[number];

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

export const ASYMPTA_ACTION_TYPES = [
  "reason",
  "research",
  "communicate",
  "create_artifact",
  "schedule",
  "reserve_capacity",
  "place_order",
  "authorize_payment",
  "commit_contract",
  "release_shipment",
  "send_external_message",
] as const;

export type AsymptaActionType = (typeof ASYMPTA_ACTION_TYPES)[number];

export const CONSEQUENTIAL_ACTIONS: ReadonlySet<AsymptaActionType> = new Set([
  "reserve_capacity",
  "place_order",
  "authorize_payment",
  "commit_contract",
  "release_shipment",
  "send_external_message",
]);

export type IntentConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type IntentTaskSpec = {
  id: string;
  title: string;
  detail: string;
  agentId: AsymptaAgentId;
  locationId: AsymptaLocationId;
  dependsOn: string[];
  workMs: number;
  actionType: AsymptaActionType;
  requiresApproval: boolean;
  consequence: string;
  validation: string;
};

export type IntentPlan = {
  id: string;
  title: string;
  summary: string;
  outcome: string;
  acceptanceCriteria: string[];
  tasks: IntentTaskSpec[];
};

export type PlannerClarification = {
  ready: false;
  assistantMessage: string;
  questions: string[];
  plan: null;
};

export type PlannerReady = {
  ready: true;
  assistantMessage: string;
  questions: [];
  plan: IntentPlan;
};

export type PlannerResult = PlannerClarification | PlannerReady;

export type PlannerProvenance = {
  provider: "openrouter" | "deterministic-fallback";
  model: string;
  fallbackReason: string | null;
};

export type IntentPlannerResponse = {
  ok: true;
  result: PlannerResult;
  provenance: PlannerProvenance;
};

export type WorldPoint = { x: number; y: number };

export type IntentAgentStatus = "idle" | "moving" | "working" | "waiting" | "sharing";

export type IntentAgentState = {
  id: AsymptaAgentId;
  name: string;
  role: string;
  organisation: string;
  side: StakeholderSide;
  homeLocationId: AsymptaLocationId;
  position: WorldPoint;
  target: WorldPoint;
  status: IntentAgentStatus;
  taskId: string | null;
  statusUntil: number | null;
};

export type IntentTaskStatus =
  | "queued"
  | "moving"
  | "working"
  | "awaiting_approval"
  | "blocked"
  | "completed";

export type IntentTaskState = IntentTaskSpec & {
  status: IntentTaskStatus;
  progress: number;
  approvalStatus: "none" | "pending" | "approved" | "declined";
  startedAt: number | null;
  completedAt: number | null;
};

export type IntentApproval = {
  id: string;
  taskId: string;
  agentId: AsymptaAgentId;
  title: string;
  detail: string;
  consequence: string;
  actionType: AsymptaActionType;
  status: "pending" | "approved" | "declined";
  requestedAt: number;
  resolvedAt: number | null;
};

export type IntentWorldMessage = {
  id: string;
  fromAgentId: AsymptaAgentId;
  toAgentId: AsymptaAgentId;
  kind: "handoff" | "status" | "question" | "answer" | "validation";
  text: string;
  createdAt: number;
};

export type IntentWorldEvent = {
  id: string;
  kind: "plan" | "transition" | "approval" | "validation" | "completion" | "error";
  title: string;
  detail: string;
  createdAt: number;
  taskId: string | null;
  agentId: AsymptaAgentId | null;
};

export type IntentWorldPhase = "idle" | "running" | "waiting_approval" | "blocked" | "completed";

export type IntentWorldState = {
  version: 1;
  revision: number;
  now: number;
  phase: IntentWorldPhase;
  intent: string | null;
  plan: IntentPlan | null;
  provenance: PlannerProvenance | null;
  agents: IntentAgentState[];
  tasks: IntentTaskState[];
  approvals: IntentApproval[];
  messages: IntentWorldMessage[];
  events: IntentWorldEvent[];
  validationErrors: string[];
};

export type IntentWorldSnapshot = {
  version: 1;
  revision: number;
  phase: IntentWorldPhase;
  intent: string | null;
  plan: Pick<IntentPlan, "id" | "title" | "summary" | "outcome" | "acceptanceCriteria"> | null;
  provenance: PlannerProvenance | null;
  progress: number;
  agents: Array<Pick<IntentAgentState, "id" | "name" | "role" | "organisation" | "side" | "status" | "taskId">>;
  tasks: Array<Pick<IntentTaskState, "id" | "title" | "detail" | "agentId" | "locationId" | "dependsOn" | "status" | "progress" | "requiresApproval" | "approvalStatus" | "actionType" | "validation">>;
  pendingApprovals: IntentApproval[];
  messages: IntentWorldMessage[];
  events: IntentWorldEvent[];
  validationErrors: string[];
  simulationDisclosure: string;
};

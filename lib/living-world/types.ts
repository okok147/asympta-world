export type Locale = "en" | "zh-Hant";
export type LocalizedText = Record<Locale, string>;

export type ScenarioId = "order" | "dinner" | "work" | "shopping" | "email";
export type NeedCategory = "commerce" | "food" | "work" | "shopping" | "communication";
export type NeedStatus = "idle" | "understanding" | "working" | "converging" | "ready" | "waiting_for_human" | "completed";
export type WorldPhase = "idle" | "understanding" | "coordinating" | "converging" | "reporting" | "ready" | "waiting_for_human" | "completed";
export type AgentStatus = "waiting" | "moving" | "working" | "sharing" | "returning" | "done";
export type TaskStatus = "queued" | "moving" | "working" | "done";
export type AgentMessageType = "info" | "request" | "result" | "delegation" | "approval";
export type ToolMode = "live" | "demo" | "simulated";
export type ToolRunStatus = "running" | "succeeded" | "failed";
export type StakeholderSide = "human" | "personal" | "business" | "supplier" | "operations" | "finance" | "logistics" | "support";

export type WorldZoneId = "human" | "context" | "research" | "market" | "communication" | "planning" | "external" | "convergence";
export type LocationSource = "pending" | "device" | "demo" | "denied" | "unavailable";
export type Point = { x: number; y: number };

export type LocationContext = {
  source: LocationSource;
  cellId: string;
  worldName: LocalizedText;
  areaName: LocalizedText;
  groupId: string;
  updatedAt: number;
};

export type AgentArt = {
  style: "folded-paper" | "watercolour" | "nocturne" | "botanical" | "mosaic" | "ink" | "workshop" | "modernist" | "desert" | "editorial" | "street-map" | "porcelain" | "glass" | "quilt" | "ocean" | "sunrise" | "charcoal";
  primary: string;
  secondary: string;
  ink: string;
  surface: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  species: string;
  role: LocalizedText;
  competence: LocalizedText;
  organisation?: LocalizedText;
  side?: StakeholderSide;
  art: AgentArt;
};

export type ServiceDefinition = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  mode: ToolMode;
  zone: WorldZoneId;
  latencyMs: number;
  result: LocalizedText;
};

export type TaskBlueprint = {
  id: string;
  agentId: string;
  title: LocalizedText;
  thought: LocalizedText;
  completion: LocalizedText;
  zone: WorldZoneId;
  durationMs: number;
  dependencies: string[];
  toolId?: string;
  kind?: "interpret" | "specialist" | "synthesis" | "report";
  stageId?: string;
  requiresApproval?: boolean;
  approvalLabel?: LocalizedText;
};

export type ResultAction = { id: string; label: LocalizedText; consequential: boolean };
export type ScenarioResult = {
  eyebrow: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  facts: Array<{ label: LocalizedText; value: LocalizedText }>;
  reasons: LocalizedText[];
  resources: Array<{ label: LocalizedText; value: LocalizedText }>;
  primaryAction: ResultAction;
  secondaryAction: ResultAction;
  disclosure: LocalizedText;
};

export type ScenarioJourneyStage = {
  id: string;
  label: LocalizedText;
  shortLabel: LocalizedText;
  organisation: LocalizedText;
  zone: WorldZoneId;
  taskIds: string[];
};

export type ScenarioDefinition = {
  id: ScenarioId;
  category: NeedCategory;
  label: LocalizedText;
  prompt: LocalizedText;
  shortPrompt: LocalizedText;
  icon: "package" | "bowl" | "brief" | "display" | "mail";
  context: Array<{ label: LocalizedText; value: LocalizedText; simulated?: boolean }>;
  agents: AgentProfile[];
  services: ServiceDefinition[];
  tasks: TaskBlueprint[];
  journey?: ScenarioJourneyStage[];
  result: ScenarioResult;
};

export type HumanNeed = {
  id: string;
  category: NeedCategory;
  scenarioId: ScenarioId;
  text: string;
  status: NeedStatus;
  createdAt: number;
  completedAt?: number;
};

export type AgentTask = TaskBlueprint & {
  status: TaskStatus;
  progress: number;
  startedAt?: number;
  workStartedAt?: number;
  completedAt?: number;
  toolRunId?: string;
  approvalStatus?: "none" | "pending" | "approved" | "declined";
};

export type LivingAgent = {
  id: string;
  profile: AgentProfile;
  status: AgentStatus;
  position: Point;
  target: Point;
  taskId?: string;
  thought: LocalizedText;
  lastOutput?: LocalizedText;
  facing: "left" | "right";
};

export type ToolRun = {
  id: string;
  toolId: string;
  agentId: string;
  taskId: string;
  mode: ToolMode;
  status: ToolRunStatus;
  startedAt: number;
  completedAt?: number;
  completesAt: number;
  result?: LocalizedText;
};

export type AgentMessage = { id: string; fromId: string; toId: string; type: AgentMessageType; text: LocalizedText; createdAt: number; expiresAt: number };
export type InformationPacket = { id: string; fromId: string; toId: string; text: LocalizedText; createdAt: number; expiresAt: number };
export type WorldEventType = "need_created" | "need_classified" | "task_created" | "agent_assigned" | "agent_moving" | "agent_working" | "tool_requested" | "tool_result" | "agent_message" | "result_candidate" | "human_approval_required" | "human_approved" | "action_completed" | "need_completed" | "location_changed" | "world_reset";
export type WorldEvent = { id: string; type: WorldEventType; title: LocalizedText; detail?: LocalizedText; createdAt: number; agentId?: string; taskId?: string };
export type ApprovalState = { status: "none" | "pending" | "approved" | "declined"; kind?: "task" | "result"; actionId?: string; taskId?: string; requestedAt?: number; resolvedAt?: number };

export type LivingWorldState = {
  version: 1;
  revision: number;
  seed: number;
  now: number;
  phase: WorldPhase;
  scenarioId?: ScenarioId;
  need?: HumanNeed;
  tasks: AgentTask[];
  agents: LivingAgent[];
  toolRuns: ToolRun[];
  messages: AgentMessage[];
  packets: InformationPacket[];
  events: WorldEvent[];
  result?: ScenarioResult;
  approval: ApprovalState;
  celebrationUntil?: number;
  location: LocationContext;
};

export type WorldSnapshot = {
  coordinateSystem: string;
  phase: WorldPhase;
  location: { source: LocationSource; worldName: string; areaName: string };
  need: null | { text: string; status: NeedStatus; scenario: ScenarioId };
  agents: Array<{ id: string; name: string; species: string; role: string; status: AgentStatus; thought: string; x: number; y: number }>;
  tasks: Array<{ id: string; title: string; status: TaskStatus; progress: number; dependencies: string[]; requiresApproval: boolean; approvalStatus?: "none" | "pending" | "approved" | "declined" }>;
  activeMessages: Array<{ from: string; to: string; type: AgentMessageType; text: string }>;
  toolRuns: Array<{ tool: string; mode: ToolMode; status: ToolRunStatus }>;
  resultReady: boolean;
  approval: ApprovalState["status"];
};

export const WORLD_ZONES: Record<WorldZoneId, { point: Point; label: LocalizedText; shortLabel: LocalizedText }> = {
  human: { point: { x: 12, y: 70 }, label: { en: "You · Home", "zh-Hant": "你 · 所在地" }, shortLabel: { en: "You", "zh-Hant": "你" } },
  context: { point: { x: 24, y: 25 }, label: { en: "Outer world", "zh-Hant": "外部世界" }, shortLabel: { en: "World", "zh-Hant": "世界" } },
  research: { point: { x: 43, y: 22 }, label: { en: "Evidence", "zh-Hant": "證據" }, shortLabel: { en: "Evidence", "zh-Hant": "證據" } },
  market: { point: { x: 70, y: 29 }, label: { en: "Supply network", "zh-Hant": "供應網絡" }, shortLabel: { en: "Supply", "zh-Hant": "供應" } },
  communication: { point: { x: 34, y: 45 }, label: { en: "Business communication", "zh-Hant": "商業溝通" }, shortLabel: { en: "Business", "zh-Hant": "商戶" } },
  planning: { point: { x: 47, y: 69 }, label: { en: "Operations", "zh-Hant": "營運" }, shortLabel: { en: "Operations", "zh-Hant": "營運" } },
  external: { point: { x: 87, y: 59 }, label: { en: "Logistics & external services", "zh-Hant": "物流與外部服務" }, shortLabel: { en: "Delivery", "zh-Hant": "派送" } },
  convergence: { point: { x: 58, y: 49 }, label: { en: "Coordination", "zh-Hant": "協調中心" }, shortLabel: { en: "Converge", "zh-Hant": "匯合" } },
};

export function localize(value: LocalizedText, locale: Locale) { return value[locale]; }

export type Locale = "en" | "zh-Hant";

export type LocalizedText = Record<Locale, string>;

export type ScenarioId = "dinner" | "work" | "shopping" | "email";

export type NeedCategory =
  | "food"
  | "work"
  | "shopping"
  | "communication";

export type NeedStatus =
  | "idle"
  | "understanding"
  | "working"
  | "converging"
  | "ready"
  | "waiting_for_human"
  | "completed";

export type WorldPhase =
  | "idle"
  | "understanding"
  | "coordinating"
  | "converging"
  | "reporting"
  | "ready"
  | "waiting_for_human"
  | "completed";

export type AgentStatus =
  | "waiting"
  | "moving"
  | "working"
  | "sharing"
  | "returning"
  | "done";

export type TaskStatus = "queued" | "moving" | "working" | "done";

export type AgentMessageType =
  | "info"
  | "request"
  | "result"
  | "delegation"
  | "approval";

export type ToolMode = "live" | "demo" | "simulated";

export type ToolRunStatus = "running" | "succeeded" | "failed";

export type WorldZoneId =
  | "human"
  | "context"
  | "research"
  | "market"
  | "communication"
  | "planning"
  | "external"
  | "convergence";

export type LocationSource =
  | "pending"
  | "device"
  | "demo"
  | "denied"
  | "unavailable";

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
  style:
    | "folded-paper"
    | "watercolour"
    | "nocturne"
    | "botanical"
    | "mosaic"
    | "ink"
    | "workshop"
    | "modernist"
    | "desert"
    | "editorial"
    | "street-map"
    | "porcelain"
    | "glass"
    | "quilt"
    | "ocean"
    | "sunrise"
    | "charcoal";
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
};

export type ResultAction = {
  id: string;
  label: LocalizedText;
  consequential: boolean;
};

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

export type ScenarioDefinition = {
  id: ScenarioId;
  category: NeedCategory;
  label: LocalizedText;
  prompt: LocalizedText;
  shortPrompt: LocalizedText;
  icon: "bowl" | "brief" | "display" | "mail";
  context: Array<{
    label: LocalizedText;
    value: LocalizedText;
    simulated?: boolean;
  }>;
  agents: AgentProfile[];
  services: ServiceDefinition[];
  tasks: TaskBlueprint[];
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

export type AgentMessage = {
  id: string;
  fromId: string;
  toId: string;
  type: AgentMessageType;
  text: LocalizedText;
  createdAt: number;
  expiresAt: number;
};

export type InformationPacket = {
  id: string;
  fromId: string;
  toId: string;
  text: LocalizedText;
  createdAt: number;
  expiresAt: number;
};

export type WorldEventType =
  | "need_created"
  | "need_classified"
  | "task_created"
  | "agent_assigned"
  | "agent_moving"
  | "agent_working"
  | "tool_requested"
  | "tool_result"
  | "agent_message"
  | "result_candidate"
  | "human_approval_required"
  | "human_approved"
  | "action_completed"
  | "need_completed"
  | "location_changed"
  | "world_reset";

export type WorldEvent = {
  id: string;
  type: WorldEventType;
  title: LocalizedText;
  detail?: LocalizedText;
  createdAt: number;
  agentId?: string;
  taskId?: string;
};

export type ApprovalState = {
  status: "none" | "pending" | "approved" | "declined";
  actionId?: string;
  requestedAt?: number;
  resolvedAt?: number;
};

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
  location: {
    source: LocationSource;
    worldName: string;
    areaName: string;
  };
  need: null | {
    text: string;
    status: NeedStatus;
    scenario: ScenarioId;
  };
  agents: Array<{
    id: string;
    name: string;
    species: string;
    role: string;
    status: AgentStatus;
    thought: string;
    x: number;
    y: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    progress: number;
    dependencies: string[];
  }>;
  activeMessages: Array<{
    from: string;
    to: string;
    type: AgentMessageType;
    text: string;
  }>;
  toolRuns: Array<{
    tool: string;
    mode: ToolMode;
    status: ToolRunStatus;
  }>;
  resultReady: boolean;
  approval: ApprovalState["status"];
};

export const WORLD_ZONES: Record<
  WorldZoneId,
  { point: Point; label: LocalizedText; shortLabel: LocalizedText }
> = {
  human: {
    point: { x: 15, y: 67 },
    label: { en: "You · Home", "zh-Hant": "你 · 所在地" },
    shortLabel: { en: "You", "zh-Hant": "你" },
  },
  context: {
    point: { x: 23, y: 25 },
    label: { en: "Context", "zh-Hant": "情境" },
    shortLabel: { en: "Context", "zh-Hant": "情境" },
  },
  research: {
    point: { x: 48, y: 21 },
    label: { en: "Research", "zh-Hant": "研究" },
    shortLabel: { en: "Research", "zh-Hant": "研究" },
  },
  market: {
    point: { x: 78, y: 25 },
    label: { en: "Local services", "zh-Hant": "附近服務" },
    shortLabel: { en: "Services", "zh-Hant": "服務" },
  },
  communication: {
    point: { x: 80, y: 67 },
    label: { en: "Communication", "zh-Hant": "溝通" },
    shortLabel: { en: "Comms", "zh-Hant": "溝通" },
  },
  planning: {
    point: { x: 52, y: 76 },
    label: { en: "Planning", "zh-Hant": "規劃" },
    shortLabel: { en: "Plan", "zh-Hant": "規劃" },
  },
  external: {
    point: { x: 89, y: 45 },
    label: { en: "External world", "zh-Hant": "外部世界" },
    shortLabel: { en: "External", "zh-Hant": "外部" },
  },
  convergence: {
    point: { x: 53, y: 49 },
    label: { en: "Coordination", "zh-Hant": "協調中心" },
    shortLabel: { en: "Converge", "zh-Hant": "匯合" },
  },
};

export function localize(text: LocalizedText, locale: Locale) {
  return text[locale];
}

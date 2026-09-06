import type {
  AtlasApproval,
  AtlasMessage,
  AtlasTaskState,
  AtlasWorldState,
  StakeholderSide,
  WorkflowId,
  WorldPhase,
} from "../atlas-simulation.ts";

export type AgentRuntimeMode = "deterministic" | "ai";
export type AgentRuntimeAction = "send_message" | "request_tool" | "complete_task" | "wait" | "delegate";
export type AgentEventKind = "workflow" | "task" | "message" | "approval";

export type CanonicalDomainEventType =
  | "workflow.observed"
  | "task.observed"
  | "message.sent"
  | "approval.requested"
  | "approval.approved"
  | "approval.declined";

/**
 * Stable, language-independent event envelope for replay, causal inspection,
 * graph/trajectory datasets, and future server-owned kernels.
 *
 * The current browser demo still derives these envelopes from Atlas records.
 * A production kernel should emit the same shape at commit time so revision,
 * causation, and evidence metadata are authoritative rather than reconstructed.
 */
export type CanonicalDomainEvent = {
  version: 1;
  eventId: string;
  type: CanonicalDomainEventType;
  runtimeKind: AgentEventKind;
  worldRevision: number;
  occurredAt: number;
  causationId: string | null;
  correlationId: string | null;
  actorId: string | null;
  targetAgentIds: readonly string[];
  workflowId: WorkflowId | null;
  taskId: string | null;
  evidenceRef: string;
  payload: Readonly<Record<string, unknown>>;
};

export type AgentEventSubscription = {
  kinds: readonly AgentEventKind[];
};

export type AgentRuntimeEvent = {
  id: string;
  kind: AgentEventKind;
  createdAt: number;
  worldRevision: number;
  title: string;
  detail: string;
  sourceAgentId: string | null;
  targetAgentIds: readonly string[];
  taskId: string | null;
  canonical: CanonicalDomainEvent;
};

export type AgentEventCursor = {
  version: 1;
  seenByAgent: Record<string, readonly string[]>;
};

export type AgentProfile = {
  id: string;
  displayName: string;
  role: string;
  organisation: string;
  side: StakeholderSide;
  goals: readonly string[];
  instructions: readonly string[];
  allowedActions: readonly AgentRuntimeAction[];
  allowedTools: readonly string[];
  subscriptions: AgentEventSubscription;
  context: {
    maxMessages: number;
    maxEvents: number;
  };
};

export type AgentContextTask = {
  input?: { trust: "untrusted_source_data"; packet: Record<string, unknown> };
  id: string;
  title: string;
  objective: string;
  status: AtlasTaskState["status"];
  progress: number;
  agentId: string;
  dependsOn: readonly string[];
  requiresApproval: boolean;
  approvalStatus: AtlasTaskState["approvalStatus"] | "none";
  actionType: string | null;
};

export type AgentContextMessage = Pick<AtlasMessage, "id" | "fromAgentId" | "toAgentId" | "text" | "createdAt">;
export type AgentContextApproval = Pick<AtlasApproval, "id" | "source" | "kind" | "status" | "title" | "detail" | "consequence" | "taskId" | "agentId" | "actionType">;

export type AgentRuntimeContext = {
  version: 1;
  worldRevision: number;
  worldPhase: WorldPhase;
  workflowId: WorkflowId | null;
  simulationMode: true;
  agent: {
    id: string;
    displayName: string;
    role: string;
    organisation: string;
    side: StakeholderSide;
    status: string;
    goals: readonly string[];
    instructions: readonly string[];
  };
  triggerEvents: readonly AgentRuntimeEvent[];
  activeTask: AgentContextTask | null;
  dependencies: readonly AgentContextTask[];
  recentMessages: readonly AgentContextMessage[];
  pendingApprovals: readonly AgentContextApproval[];
  participants: ReadonlyArray<{
    id: string;
    displayName: string;
    role: string;
    side: StakeholderSide;
  }>;
  allowedActions: readonly AgentRuntimeAction[];
  allowedTools: readonly string[];
  worldSummary: {
    completedTasks: number;
    totalTasks: number;
    pendingApprovals: number;
  };
};

export type AgentDecision =
  | { action: "send_message"; targetAgentId: string; message: string }
  | { action: "request_tool"; tool: string; arguments: Record<string, unknown>; reason: string }
  | { action: "complete_task"; summary: string }
  | { action: "wait"; reason: string }
  | { action: "delegate"; targetAgentId: string; objective: string };

export type AgentInferenceRequest = {
  context: AgentRuntimeContext;
  responseSchema: Record<string, unknown>;
  systemInstructions: readonly string[];
};

export type AgentProvider = {
  id: string;
  kind: AgentRuntimeMode;
  model?: string;
  decide(request: AgentInferenceRequest): Promise<unknown>;
};

export type AgentTurnResult = {
  context: AgentRuntimeContext;
  decision: AgentDecision;
  providerId: string;
  providerKind: AgentRuntimeMode;
  providerModel: string | null;
  fallbackUsed: boolean;
  validationError: string | null;
};

export type AgentEventDelivery = {
  agentId: string;
  eventIds: readonly string[];
  turn: AgentTurnResult;
};

export type AgentEventDispatchResult = {
  cursor: AgentEventCursor;
  deliveries: readonly AgentEventDelivery[];
  observedEventIds: readonly string[];
};

export type AgentProposalCommitter = (input: {
  world: AtlasWorldState;
  delivery: AgentEventDelivery;
}) => AtlasWorldState | Promise<AtlasWorldState>;

export type AgentEventCycleResult = {
  world: AtlasWorldState;
  cursor: AgentEventCursor;
  rounds: number;
  deliveries: readonly AgentEventDelivery[];
};

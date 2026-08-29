import type {
  AtlasApproval,
  AtlasMessage,
  AtlasTaskState,
  StakeholderSide,
  WorkflowId,
  WorldPhase,
} from "../atlas-simulation";

export type AgentRuntimeMode = "deterministic" | "ai";
export type AgentRuntimeAction = "send_message" | "request_tool" | "complete_task" | "wait" | "delegate";

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
  context: {
    maxMessages: number;
  };
};

export type AgentContextTask = {
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
  activeTask: AgentContextTask | null;
  dependencies: readonly AgentContextTask[];
  recentMessages: readonly AgentContextMessage[];
  pendingApprovals: readonly AgentContextApproval[];
  participants: readonly Array<{
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

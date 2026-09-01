export type AsymptaTaskLocale = "en" | "zh-Hant" | "ja";
export type AsymptaTaskMode = "live" | "simulated";
export type AsymptaTaskRisk = "none" | "low" | "medium" | "high" | "critical";

export type AsymptaTaskPhase =
  | "interpreting"
  | "resolving_requirements"
  | "awaiting_human"
  | "planning"
  | "discovering"
  | "coordinating"
  | "awaiting_approval"
  | "executing"
  | "verifying"
  | "completed"
  | "cancelled"
  | "blocked"
  | "failed";

export type AsymptaTaskRequirementStatus =
  | "unknown"
  | "resolved"
  | "confirmed"
  | "not_applicable"
  | "blocked";

export type AsymptaTaskFactSource =
  | "explicit"
  | "human_confirmation"
  | "profile"
  | "world"
  | "tool"
  | "policy"
  | "agent_inference"
  | "simulation";

export type AsymptaTaskControl = "single_choice" | "text" | "number" | "boolean";
export type AsymptaTaskAnswerValue = string | number | boolean;

export type AsymptaTaskOption = {
  value: AsymptaTaskAnswerValue;
  label: string;
  description?: string;
};

export type AsymptaTaskRequirement = {
  id: string;
  raw: string;
  key: string;
  semantic: string;
  label: string;
  prompt: string;
  reason: string;
  control: AsymptaTaskControl;
  options: AsymptaTaskOption[];
  allowCustom: boolean;
  customPlaceholder?: string;
  required: true;
  sensitive: boolean;
  consequential: boolean;
  status: AsymptaTaskRequirementStatus;
  value?: AsymptaTaskAnswerValue;
  displayValue?: string;
  provenance?: {
    source: AsymptaTaskFactSource;
    actorId?: string;
    confidence: number;
    at: string;
  };
  lockedBy?: "human" | "policy";
};

export type AsymptaTaskAssignmentStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type AsymptaTaskAssignment = {
  id: string;
  agentId: string;
  role: "interpreter" | "specialist" | "researcher" | "coordinator" | "executor" | "verifier";
  capability: string;
  scopeRequirementIds: string[];
  depth: number;
  status: AsymptaTaskAssignmentStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type AsymptaTaskApproval = {
  id: string;
  kind: "live_write" | "payment" | "external_commitment";
  status: "pending" | "approved" | "rejected";
  prompt: string;
  consequence: string;
  requestedAt: string;
  decidedAt?: string;
};

export type AsymptaTaskEvidenceKind =
  | "interpretation"
  | "plan"
  | "offer_set"
  | "delivery_plan"
  | "tool_result"
  | "verification"
  | "receipt"
  | "outcome";

export type AsymptaTaskEvidence = {
  id: string;
  source: string;
  kind: AsymptaTaskEvidenceKind;
  summary: string;
  simulated: boolean;
  verified: boolean;
  value?: unknown;
  createdAt: string;
};

export type AsymptaTaskPlanStep = {
  id: string;
  title: string;
  ownerAgentId: string;
  capability: string;
  status: "queued" | "completed" | "blocked";
};

export type AsymptaTaskPlan = {
  id: string;
  summary: string;
  steps: AsymptaTaskPlanStep[];
  proposal: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

export type AsymptaTaskOutcomeKind = "information" | "simulated_action" | "external_action";
export type AsymptaTaskOutcomeStatus = "waiting_external" | "completed";

export type AsymptaTaskOutcome = {
  id: string;
  kind: AsymptaTaskOutcomeKind;
  status: AsymptaTaskOutcomeStatus;
  simulated: boolean;
  provider: string;
  summary: string;
  approvalId?: string;
  receiptId?: string;
  value?: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AsymptaTaskCompletionContract = {
  requiresVerifiedOutcome: true;
  requiresApproval: boolean;
  requiresReceipt: boolean;
  outcomeKind: AsymptaTaskOutcomeKind;
};

export type AsymptaTaskLivenessState =
  | "running"
  | "awaiting_input"
  | "awaiting_approval"
  | "waiting_external"
  | "completed"
  | "cancelled";

export type AsymptaTaskLiveness = {
  state: AsymptaTaskLivenessState;
  continuationCount: number;
  recoveryCount: number;
  lastProgressRevision: number;
  lastProgressAt: string;
  nextAttemptAt?: string;
  obstacle?: {
    code: string;
    message: string;
    recoverable: true;
    at: string;
  };
};

export type AsymptaTaskResult = {
  completed: boolean;
  simulated: boolean;
  summary: string;
  value?: unknown;
  verification: {
    status: "verified" | "partially_verified" | "not_verified";
    criteria: Record<string, boolean>;
    details: string;
  };
  completedAt: string;
};

export type AsymptaTaskWorldWorkflow = {
  driver: "atlas_world";
  workflowId: string;
  runId: string;
  name: string;
  status: "queued" | "running" | "waiting_approval" | "blocked" | "completed";
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  activeAgentId: string | null;
  completedTaskCount: number;
  totalTaskCount: number;
  agentIds: string[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type AsymptaTaskEventKind =
  | "task_created"
  | "requirements_compiled"
  | "requirement_resolved"
  | "requirement_confirmed"
  | "assignment_created"
  | "assignment_started"
  | "assignment_completed"
  | "agent_patch_applied"
  | "approval_requested"
  | "approval_decided"
  | "outcome_recorded"
  | "continuation_scheduled"
  | "task_recovered"
  | "phase_changed"
  | "task_completed"
  | "task_cancelled"
  | "task_failed";

export type AsymptaTaskEvent = {
  id: string;
  taskId: string;
  revision: number;
  kind: AsymptaTaskEventKind;
  actorId: string;
  summary: string;
  data?: Record<string, unknown>;
  at: string;
};

export type AsymptaTaskLimits = {
  maxAssignments: number;
  maxDelegationDepth: number;
  maxParallelAgents: number;
  maxAgentSteps: number;
};

export type AsymptaTaskState = {
  version: "asympta.task/0.4";
  taskId: string;
  activityId: string | null;
  revision: number;
  rootIntent: {
    raw: string;
    locale: AsymptaTaskLocale;
  };
  domain: string;
  actionFamily: string;
  mode: AsymptaTaskMode;
  risk: AsymptaTaskRisk;
  phase: AsymptaTaskPhase;
  title: string;
  summary: string;
  requirements: AsymptaTaskRequirement[];
  assignments: AsymptaTaskAssignment[];
  approvals: AsymptaTaskApproval[];
  evidence: AsymptaTaskEvidence[];
  events: AsymptaTaskEvent[];
  processedCommandIds: string[];
  limits: AsymptaTaskLimits;
  completion: AsymptaTaskCompletionContract;
  liveness: AsymptaTaskLiveness;
  plan: AsymptaTaskPlan | null;
  outcome: AsymptaTaskOutcome | null;
  result: AsymptaTaskResult | null;
  /** Browser-only projection into the visible Atlas world. */
  worldWorkflow?: AsymptaTaskWorldWorkflow;
  failure: {
    code: string;
    message: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAsymptaTaskInput = {
  taskId?: string;
  activityId?: string | null;
  rootIntent: string;
  locale?: string;
  domain?: string;
  actionFamily?: string;
  mode?: AsymptaTaskMode;
  risk?: AsymptaTaskRisk;
  confirmationRequired?: boolean;
  title?: string;
  summary?: string;
  missingFields: string[];
  now?: string | number | Date;
};

export type AnswerRequirementCommand = {
  commandId: string;
  taskId: string;
  requirementId: string;
  expectedRevision: number;
  value: AsymptaTaskAnswerValue;
  label: string;
  actorId?: string;
  now?: string | number | Date;
  /** Keep the resolved task at planning so a visible execution driver can claim it. */
  deferCoordination?: boolean;
};

export type ApproveTaskCommand = {
  commandId: string;
  taskId: string;
  approvalId: string;
  expectedRevision: number;
  approved: boolean;
  actorId?: string;
  now?: string | number | Date;
};

export type CancelTaskCommand = {
  commandId: string;
  taskId: string;
  expectedRevision: number;
  reason?: string;
  actorId?: string;
  now?: string | number | Date;
};

export type AsymptaAgentPatchOperation =
  | {
      op: "propose_fact";
      requirementId: string;
      value: AsymptaTaskAnswerValue;
      label: string;
      confidence: number;
      source: Extract<AsymptaTaskFactSource, "world" | "tool" | "policy" | "agent_inference" | "simulation">;
    }
  | {
      op: "add_plan";
      plan: AsymptaTaskPlan;
    }
  | {
      op: "add_evidence";
      evidence: AsymptaTaskEvidence;
    }
  | {
      op: "request_delegation";
      capability: string;
      role: AsymptaTaskAssignment["role"];
      scopeRequirementIds: string[];
    }
  | {
      op: "request_approval";
      approval: AsymptaTaskApproval;
    }
  | {
      op: "set_phase";
      phase: AsymptaTaskPhase;
      summary: string;
    }
  | {
      op: "set_outcome";
      outcome: AsymptaTaskOutcome;
    }
  | {
      op: "set_result";
      result: AsymptaTaskResult;
    }
  | {
      op: "report_obstacle";
      code: string;
      message: string;
      retryAfterMs?: number;
    }
  | {
      op: "complete_assignment";
    }
  | {
      op: "fail";
      code: string;
      message: string;
    };

export type AsymptaAgentPatch = {
  taskId: string;
  baseRevision: number;
  assignmentId: string;
  agentId: string;
  operations: AsymptaAgentPatchOperation[];
};

export type AsymptaTaskKernelUpdateReason =
  | "created"
  | "answered"
  | "agent_progress"
  | "approval"
  | "cancelled"
  | "restored"
  | "migrated"
  | "resumed";

export type AsymptaTaskKernelEventDetail = {
  reason: AsymptaTaskKernelUpdateReason;
  task: AsymptaTaskState;
  previous: AsymptaTaskState | null;
};

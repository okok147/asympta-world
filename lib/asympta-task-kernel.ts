import {
  createAdaptiveInteractionSchema,
  type AdaptiveInteractionSchema,
} from "./asympta-automatic-clarification-options.ts";
import {
  createDelegatedAssignment,
  initialAgentAssignments,
  runLogicalAgent,
  taskHasApprovedApproval,
} from "./asympta-agent-mesh.ts";
import {
  createTaskCompletionContract,
  inferTaskClassification,
  taskApprovalCopy,
} from "./asympta-task-policy.ts";
import type {
  AnswerRequirementCommand,
  ApproveTaskCommand,
  AsymptaAgentPatch,
  AsymptaTaskAnswerValue,
  AsymptaTaskAssignment,
  AsymptaTaskEventKind,
  AsymptaTaskPhase,
  AsymptaTaskRequirement,
  AsymptaTaskResult,
  AsymptaTaskState,
  CancelTaskCommand,
  CreateAsymptaTaskInput,
} from "./asympta-task-kernel-types.ts";

const TRUE_TERMINAL_PHASES = new Set<AsymptaTaskPhase>(["completed", "cancelled"]);
const LEGACY_DEAD_END_PHASES = new Set<AsymptaTaskPhase>(["blocked", "failed"]);

function nowIso(value?: string | number | Date) {
  return new Date(value ?? Date.now()).toISOString();
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneTask(task: AsymptaTaskState): AsymptaTaskState {
  return cloneValue(task);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeLocale(value: string | undefined) {
  const locale = (value ?? "en").toLowerCase();
  if (locale.startsWith("zh")) return "zh-Hant" as const;
  if (locale.startsWith("ja")) return "ja" as const;
  return "en" as const;
}

function requirementSemantic(key: string) {
  if (key === "screen_size") return "size";
  if (key === "brand") return "brand";
  if (key === "delivery_location") return "delivery_location";
  if (key === "fulfilment") return "delivery_location";
  if (key === "event_intent") return "event";
  return key || "generic";
}

function sensitiveRequirement(key: string) {
  return /(?:payment|card|account|identity|contact|document|address|medical|symptom)/iu.test(key);
}

function consequentialRequirement(key: string) {
  return /(?:payment|approval|amount|account|identity)/iu.test(key);
}

function explicitRequirementValue(intent: string, key: string): { value: AsymptaTaskAnswerValue; label: string } | null {
  if (key === "budget") {
    if (/(?:premium|high[- ]?end|flagship|高階|高端|旗艦|旗舰)/iu.test(intent)) return { value: "premium", label: "高階 / Premium" };
    const amount = /(?:HK\$|HKD|港幣|港币)?\s*(\d{3,7}(?:,\d{3})?)/iu.exec(intent);
    if (amount) return { value: Number(amount[1].replace(/,/g, "")), label: `HK$${amount[1]}` };
  }
  if (key === "screen_size" || key === "size") {
    const match = /(\d{2,3})\s*(?:inch|inches|"|吋|英寸|インチ)/iu.exec(intent);
    if (match) return { value: `${match[1]}-inch`, label: `${match[1]}″` };
  }
  if (key === "brand") {
    const brands = ["Samsung", "LG", "Sony", "TCL", "Hisense", "Panasonic", "Philips"];
    const brand = brands.find((candidate) => new RegExp(`\\b${candidate}\\b`, "iu").test(intent));
    if (brand) return { value: brand.toLowerCase(), label: brand };
    if (/(?:no brand preference|any brand|沒有品牌偏好|无品牌偏好|品牌不限|ブランド指定なし)/iu.test(intent)) {
      return { value: "no_preference", label: "沒有品牌偏好" };
    }
  }
  if (key === "purpose") {
    if (/(?:gaming|game|遊戲|游戏|ゲーム)/iu.test(intent)) return { value: "gaming", label: "Gaming" };
    if (/(?:movie|film|streaming|電影|电影|串流|映画)/iu.test(intent)) return { value: "movies_streaming", label: "電影／串流" };
    if (/(?:sport|football|sports|體育|体育|運動|スポーツ)/iu.test(intent)) return { value: "sports", label: "體育賽事" };
  }
  if (key === "delivery_location" || key === "fulfilment") {
    if (/(?:store pickup|self collect|pickup|自取|門市自取|门市自取|店舗受取)/iu.test(intent)) {
      return { value: "store_pickup", label: "門市自取" };
    }
    if (/(?:deliver|delivery|ship|home|送貨|送货|配送|屋企|家中|自宅)/iu.test(intent)) {
      return { value: "saved_home", label: "常用住址" };
    }
  }
  if (key === "quantity") {
    const match = /(?:^|\s)(\d{1,3})\s*(?:tv|televisions?|items?|units?|台|部|個|个)?/iu.exec(intent);
    if (match) return { value: Number(match[1]), label: match[1] };
    if (/(?:\ba\s+television\b|\bone\s+television\b|一台電視|一台电视)/iu.test(intent)) return { value: 1, label: "1" };
  }
  return null;
}

function event(task: AsymptaTaskState, kind: AsymptaTaskEventKind, actorId: string, summary: string, data?: Record<string, unknown>) {
  task.events.push({
    id: `${task.taskId}:event:${task.events.length + 1}`,
    taskId: task.taskId,
    revision: task.revision,
    kind,
    actorId,
    summary,
    ...(data ? { data } : {}),
    at: task.updatedAt,
  });
}

function syncLiveness(task: AsymptaTaskState, phase: AsymptaTaskPhase) {
  if (phase === "completed") task.liveness.state = "completed";
  else if (phase === "cancelled") task.liveness.state = "cancelled";
  else if (phase === "awaiting_human") task.liveness.state = "awaiting_input";
  else if (phase === "awaiting_approval") task.liveness.state = "awaiting_approval";
  else if (task.outcome?.status === "waiting_external") task.liveness.state = "waiting_external";
  else task.liveness.state = "running";
}

function markProgress(task: AsymptaTaskState) {
  task.liveness.lastProgressRevision = task.revision;
  task.liveness.lastProgressAt = task.updatedAt;
  if (task.liveness.state !== "waiting_external") delete task.liveness.nextAttemptAt;
  if (task.liveness.state === "running") delete task.liveness.obstacle;
}

function transition(task: AsymptaTaskState, phase: AsymptaTaskPhase, actorId: string, summary: string) {
  const safePhase = LEGACY_DEAD_END_PHASES.has(phase) ? "coordinating" : phase;
  if (task.phase === safePhase) {
    syncLiveness(task, safePhase);
    return;
  }
  task.phase = safePhase;
  syncLiveness(task, safePhase);
  event(task, "phase_changed", actorId, summary, { phase: safePhase });
}

function compileRequirements(input: CreateAsymptaTaskInput, taskId: string, at: string) {
  const schema = createAdaptiveInteractionSchema({
    intent: input.rootIntent,
    missingFields: input.missingFields,
    locale: input.locale,
    interactionId: taskId,
    now: at,
  });

  return schema.fields.map((field, index) => {
    const explicit = explicitRequirementValue(input.rootIntent, field.key);
    return {
      id: `${taskId}:requirement:${field.key}:${index}`,
      raw: field.sourceField,
      key: field.key,
      semantic: requirementSemantic(field.key),
      label: field.label,
      prompt: field.prompt,
      reason: field.reason,
      control: field.control,
      options: field.options.map((candidate) => ({ ...candidate })),
      allowCustom: field.allowCustom,
      ...(field.customPlaceholder ? { customPlaceholder: field.customPlaceholder } : {}),
      required: true,
      sensitive: sensitiveRequirement(field.key),
      consequential: consequentialRequirement(field.key),
      status: explicit ? "resolved" : "unknown",
      ...(explicit ? {
        value: explicit.value,
        displayValue: explicit.label,
        provenance: {
          source: "explicit" as const,
          actorId: "human",
          confidence: 1,
          at,
        },
      } : {}),
    } satisfies AsymptaTaskRequirement;
  });
}

function unresolved(task: AsymptaTaskState) {
  return task.requirements.filter((requirement) => requirement.required && requirement.status === "unknown");
}

function rememberCommand(task: AsymptaTaskState, commandId: string) {
  task.processedCommandIds = [...task.processedCommandIds, commandId].slice(-128);
}

function assertRevision(task: AsymptaTaskState, expectedRevision: number) {
  if (task.revision !== expectedRevision) {
    throw new AsymptaTaskKernelError(
      "revision_conflict",
      `Task ${task.taskId} is at revision ${task.revision}, not ${expectedRevision}.`,
    );
  }
}

function makeAssignmentRoom(task: AsymptaTaskState, count: number) {
  const target = Math.max(0, task.limits.maxAssignments - count);
  if (task.assignments.length <= target) return;
  const removable = task.assignments
    .map((assignment, index) => ({ assignment, index }))
    .filter(({ assignment }) => ["completed", "cancelled", "failed"].includes(assignment.status))
    .sort((left, right) => left.assignment.createdAt.localeCompare(right.assignment.createdAt));
  const remove = new Set(removable.slice(0, task.assignments.length - target).map(({ index }) => index));
  task.assignments = task.assignments.filter((_, index) => !remove.has(index));
}

function addAssignments(task: AsymptaTaskState, assignments: AsymptaTaskAssignment[], actorId: string) {
  makeAssignmentRoom(task, assignments.length);
  const room = Math.max(0, task.limits.maxAssignments - task.assignments.length);
  for (const assignment of assignments.slice(0, room)) {
    if (task.assignments.some((candidate) => candidate.id === assignment.id)) continue;
    task.assignments.push(assignment);
    event(task, "assignment_created", actorId, `Assigned ${assignment.agentId}.`, {
      assignmentId: assignment.id,
      capability: assignment.capability,
      depth: assignment.depth,
    });
  }
}

function startAssignment(task: AsymptaTaskState, assignmentId: string) {
  const next = cloneTask(task);
  const assignment = next.assignments.find((candidate) => candidate.id === assignmentId);
  if (!assignment || assignment.status !== "queued") return next;
  next.revision += 1;
  next.updatedAt = nowIso();
  assignment.status = "running";
  assignment.startedAt = next.updatedAt;
  delete next.liveness.nextAttemptAt;
  const phase: AsymptaTaskPhase = assignment.role === "researcher"
    ? "discovering"
    : assignment.role === "executor"
      ? "executing"
      : assignment.role === "coordinator"
        ? "coordinating"
        : assignment.role === "verifier"
          ? "verifying"
          : "planning";
  transition(next, phase, assignment.agentId, `${assignment.agentId} started ${assignment.capability}.`);
  event(next, "assignment_started", assignment.agentId, `Started ${assignment.capability}.`, {
    assignmentId: assignment.id,
  });
  markProgress(next);
  return next;
}

function activeAssignment(task: AsymptaTaskState, capability: string) {
  return task.assignments.some((assignment) => assignment.capability === capability
    && ["queued", "running"].includes(assignment.status));
}

function ensureAssignment(task: AsymptaTaskState, input: {
  capability: string;
  role: AsymptaTaskAssignment["role"];
  actorId: string;
  depth?: number;
}) {
  if (activeAssignment(task, input.capability)) return task;
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso();
  const assignment = createDelegatedAssignment({
    task: next,
    capability: input.capability,
    role: input.role,
    scopeRequirementIds: next.requirements.map((requirement) => requirement.id),
    depth: input.depth ?? 0,
    at: next.updatedAt,
  });
  addAssignments(next, [assignment], input.actorId);
  markProgress(next);
  return next;
}

function ensureInitialAssignments(task: AsymptaTaskState) {
  const active = task.assignments.some((assignment) => ["queued", "running"].includes(assignment.status));
  if (active || task.plan) return task;
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso();
  const fresh = initialAgentAssignments(next, next.updatedAt).map((assignment, index) => ({
    ...assignment,
    id: `${assignment.id}:attempt-${next.liveness.recoveryCount + next.liveness.continuationCount + index + 1}`,
  }));
  addAssignments(next, fresh, "task-kernel");
  markProgress(next);
  return next;
}

function ensureApproval(task: AsymptaTaskState) {
  if (!task.completion.requiresApproval || taskHasApprovedApproval(task)) return task;
  const existing = task.approvals.find((approval) => approval.status === "pending");
  if (existing) {
    const next = cloneTask(task);
    transition(next, "awaiting_approval", "policy-gate", existing.prompt);
    return next;
  }
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso();
  const copy = taskApprovalCopy({ title: next.title, locale: next.rootIntent.locale });
  const approval = {
    id: `${next.taskId}:approval:consequential-action`,
    kind: "external_commitment" as const,
    status: "pending" as const,
    prompt: copy.prompt,
    consequence: copy.consequence,
    requestedAt: next.updatedAt,
  };
  next.approvals.push(approval);
  transition(next, "awaiting_approval", "policy-gate", approval.prompt);
  event(next, "approval_requested", "policy-gate", approval.prompt, { approvalId: approval.id });
  markProgress(next);
  return next;
}

function reportRecoverableObstacle(task: AsymptaTaskState, input: {
  code: string;
  message: string;
  actorId: string;
  retryAfterMs?: number;
}) {
  task.failure = null;
  task.liveness.recoveryCount += 1;
  task.liveness.obstacle = {
    code: input.code,
    message: input.message,
    recoverable: true,
    at: task.updatedAt,
  };
  if ((input.retryAfterMs ?? 0) > 0) {
    task.liveness.state = "waiting_external";
    task.liveness.nextAttemptAt = new Date(new Date(task.updatedAt).getTime() + (input.retryAfterMs ?? 0)).toISOString();
  } else {
    task.liveness.state = "running";
    delete task.liveness.nextAttemptAt;
  }
  transition(task, "coordinating", input.actorId, input.message);
  event(task, "task_recovered", input.actorId, input.message, {
    code: input.code,
    retryAfterMs: input.retryAfterMs ?? 0,
  });
}

function scheduleContinuation(task: AsymptaTaskState, code: string, message: string, delayMs = 250) {
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso();
  next.liveness.continuationCount += 1;
  next.liveness.state = "running";
  next.liveness.nextAttemptAt = new Date(new Date(next.updatedAt).getTime() + delayMs).toISOString();
  next.liveness.obstacle = { code, message, recoverable: true, at: next.updatedAt };
  transition(next, "coordinating", "task-kernel", message);
  event(next, "continuation_scheduled", "task-kernel", message, { code, delayMs });
  return next;
}

function dueForRetry(task: AsymptaTaskState) {
  if (!task.liveness.nextAttemptAt) return true;
  return new Date(task.liveness.nextAttemptAt).getTime() <= Date.now();
}

function hasVerifiedReceipt(task: AsymptaTaskState) {
  if (!task.completion.requiresReceipt) return true;
  return Boolean(task.outcome?.receiptId && task.evidence.some((evidence) => {
    const value = asRecord(evidence.value);
    return evidence.kind === "receipt"
      && evidence.verified
      && value?.receiptId === task.outcome?.receiptId;
  }));
}

function completionReady(task: AsymptaTaskState) {
  return task.outcome?.status === "completed"
    && (!task.completion.requiresApproval || taskHasApprovedApproval(task))
    && hasVerifiedReceipt(task);
}

function normalizeLegacyDeadEnd(task: AsymptaTaskState) {
  if (!LEGACY_DEAD_END_PHASES.has(task.phase)) return task;
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso();
  const code = next.failure?.code ?? `legacy_${task.phase}`;
  const message = next.failure?.message ?? "Recovered a legacy terminal state and resumed the same task.";
  next.failure = null;
  next.result = null;
  next.phase = "coordinating";
  reportRecoverableObstacle(next, { code, message, actorId: "task-migrator", retryAfterMs: 0 });
  return next;
}

export class AsymptaTaskKernelError extends Error {
  readonly code: "task_not_found" | "revision_conflict" | "invalid_command" | "terminal_task" | "requirement_locked";

  constructor(code: AsymptaTaskKernelError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export function createAsymptaTask(input: CreateAsymptaTaskInput): AsymptaTaskState {
  const at = nowIso(input.now);
  const classification = inferTaskClassification(input.rootIntent);
  const taskId = input.taskId?.trim() || `task-${stableHash(`${input.activityId ?? "activity"}:${input.rootIntent}`)}`;
  const requirements = compileRequirements(input, taskId, at);
  const mode = input.mode ?? "simulated";
  const risk = input.risk ?? (input.confirmationRequired ? "high" : "low");
  const domain = input.domain ?? classification.domain;
  const actionFamily = input.actionFamily ?? classification.actionFamily;
  const completion = createTaskCompletionContract({
    actionFamily,
    intent: input.rootIntent,
    mode,
    risk,
    confirmationRequired: input.confirmationRequired,
  });
  const task: AsymptaTaskState = {
    version: "asympta.task/0.4",
    taskId,
    activityId: input.activityId?.trim() || null,
    revision: 1,
    rootIntent: {
      raw: input.rootIntent.trim(),
      locale: normalizeLocale(input.locale),
    },
    domain,
    actionFamily,
    mode,
    risk,
    phase: "interpreting",
    title: input.title?.trim() || input.rootIntent.trim(),
    summary: input.summary?.trim() || input.rootIntent.trim(),
    requirements,
    assignments: [],
    approvals: [],
    evidence: [],
    events: [],
    processedCommandIds: [],
    limits: {
      maxAssignments: 24,
      maxDelegationDepth: 3,
      maxParallelAgents: 3,
      maxAgentSteps: 32,
    },
    completion,
    liveness: {
      state: requirements.some((requirement) => requirement.status === "unknown") ? "awaiting_input" : "running",
      continuationCount: 0,
      recoveryCount: 0,
      lastProgressRevision: 1,
      lastProgressAt: at,
    },
    plan: null,
    outcome: null,
    result: null,
    failure: null,
    createdAt: at,
    updatedAt: at,
  };
  event(task, "task_created", "task-kernel", "Created one continuous revisioned task from the original human intention.", {
    activityId: task.activityId,
    mode: task.mode,
    completion,
  });
  event(task, "requirements_compiled", "requirement-resolver", "Compiled missing information into atomic requirements.", {
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      key: requirement.key,
      status: requirement.status,
    })),
  });

  if (unresolved(task).length) {
    transition(task, "awaiting_human", "requirement-resolver", "Waiting only for the next unresolved requirement; the task remains active.");
    return task;
  }
  transition(task, "planning", "task-kernel", "Every required fact is available; starting continuous bounded coordination.");
  return advanceAsymptaTask(task);
}

export function nextTaskRequirement(task: AsymptaTaskState) {
  return unresolved(task)[0] ?? null;
}

export function taskToAdaptiveInteractionSchema(task: AsymptaTaskState): AdaptiveInteractionSchema {
  const fields = unresolved(task).map((requirement) => ({
    id: requirement.id,
    sourceField: requirement.raw,
    key: requirement.key,
    label: requirement.label,
    prompt: requirement.prompt,
    reason: requirement.reason,
    control: requirement.control,
    options: requirement.options.map((candidate) => ({ ...candidate })),
    allowCustom: requirement.allowCustom,
    ...(requirement.customPlaceholder ? { customPlaceholder: requirement.customPlaceholder } : {}),
    required: true as const,
    sensitive: requirement.sensitive,
  }));
  return {
    schemaVersion: "asympta.adaptive-ui.v1",
    interactionId: task.taskId,
    intent: task.rootIntent.raw,
    fields,
    nextField: fields[0] ?? null,
    provenance: {
      source: "agent_missing_fields",
      mode: "runtime_schema",
      factPolicy: "unknown_until_user_confirmation",
      createdAt: task.createdAt,
    },
  };
}

export function answerTaskRequirement(task: AsymptaTaskState, command: AnswerRequirementCommand) {
  if (task.taskId !== command.taskId) throw new AsymptaTaskKernelError("task_not_found", `Task ${command.taskId} was not found.`);
  if (task.processedCommandIds.includes(command.commandId)) return task;
  if (TRUE_TERMINAL_PHASES.has(task.phase)) throw new AsymptaTaskKernelError("terminal_task", `Task ${task.taskId} is already ${task.phase}.`);
  assertRevision(task, command.expectedRevision);
  const next = cloneTask(task);
  const requirement = next.requirements.find((candidate) => candidate.id === command.requirementId);
  if (!requirement) throw new AsymptaTaskKernelError("invalid_command", `Requirement ${command.requirementId} was not found.`);
  if (requirement.lockedBy === "human" && requirement.value !== command.value) {
    throw new AsymptaTaskKernelError("requirement_locked", `Requirement ${command.requirementId} is locked by a human confirmation.`);
  }

  next.revision += 1;
  next.updatedAt = nowIso(command.now);
  requirement.status = "confirmed";
  requirement.value = command.value;
  requirement.displayValue = command.label;
  requirement.provenance = {
    source: "human_confirmation",
    actorId: command.actorId ?? "human",
    confidence: 1,
    at: next.updatedAt,
  };
  requirement.lockedBy = "human";
  rememberCommand(next, command.commandId);
  event(next, "requirement_confirmed", command.actorId ?? "human", `Confirmed ${requirement.label}: ${command.label}.`, {
    requirementId: requirement.id,
    key: requirement.key,
  });
  markProgress(next);

  if (unresolved(next).length) {
    transition(next, "awaiting_human", "requirement-resolver", "Advanced to the next unresolved requirement without reinterpreting the intention.");
    return next;
  }

  transition(next, "planning", "task-kernel", "All requirements are resolved; continuing the same task automatically.");
  return advanceAsymptaTask(next);
}

export function applyAsymptaAgentPatch(task: AsymptaTaskState, patch: AsymptaAgentPatch) {
  if (task.taskId !== patch.taskId) throw new AsymptaTaskKernelError("task_not_found", `Task ${patch.taskId} was not found.`);
  assertRevision(task, patch.baseRevision);
  const next = cloneTask(task);
  const assignment = next.assignments.find((candidate) => candidate.id === patch.assignmentId);
  if (!assignment) throw new AsymptaTaskKernelError("invalid_command", `Assignment ${patch.assignmentId} was not found.`);
  if (assignment.agentId !== patch.agentId) throw new AsymptaTaskKernelError("invalid_command", "Agent patch identity did not match the assignment.");

  next.revision += 1;
  next.updatedAt = nowIso();

  for (const operation of patch.operations) {
    if (operation.op === "propose_fact") {
      const requirement = next.requirements.find((candidate) => candidate.id === operation.requirementId);
      if (!requirement) continue;
      if (requirement.lockedBy === "human") {
        event(next, "agent_patch_applied", patch.agentId, `Rejected an agent attempt to overwrite human-confirmed ${requirement.label}.`, {
          requirementId: requirement.id,
          rejected: true,
        });
        continue;
      }
      requirement.status = "resolved";
      requirement.value = operation.value;
      requirement.displayValue = operation.label;
      requirement.provenance = {
        source: operation.source,
        actorId: patch.agentId,
        confidence: operation.confidence,
        at: next.updatedAt,
      };
      event(next, "requirement_resolved", patch.agentId, `Resolved ${requirement.label}.`, {
        requirementId: requirement.id,
        source: operation.source,
      });
      continue;
    }

    if (operation.op === "add_plan") {
      next.plan = operation.plan;
      event(next, "agent_patch_applied", patch.agentId, operation.plan.summary, { operation: "add_plan" });
      continue;
    }

    if (operation.op === "add_evidence") {
      if (!next.evidence.some((candidate) => candidate.id === operation.evidence.id)) next.evidence.push(operation.evidence);
      event(next, "agent_patch_applied", patch.agentId, operation.evidence.summary, {
        operation: "add_evidence",
        evidenceId: operation.evidence.id,
      });
      continue;
    }

    if (operation.op === "request_delegation") {
      const depth = assignment.depth + 1;
      const scope = [...new Set(operation.scopeRequirementIds)];
      const duplicate = next.assignments.some((candidate) => candidate.capability === operation.capability
        && candidate.scopeRequirementIds.join("|") === scope.join("|")
        && ["queued", "running"].includes(candidate.status));
      if (duplicate || depth > next.limits.maxDelegationDepth) continue;
      const delegated = createDelegatedAssignment({
        task: next,
        capability: operation.capability,
        role: operation.role,
        scopeRequirementIds: scope,
        depth,
        at: next.updatedAt,
      });
      addAssignments(next, [delegated], patch.agentId);
      continue;
    }

    if (operation.op === "request_approval") {
      const approved = next.approvals.find((candidate) => candidate.id === operation.approval.id && candidate.status === "approved");
      if (!approved && !next.approvals.some((candidate) => candidate.id === operation.approval.id && candidate.status === "pending")) {
        next.approvals.push(operation.approval);
      }
      if (!approved) {
        transition(next, "awaiting_approval", patch.agentId, operation.approval.prompt);
        event(next, "approval_requested", patch.agentId, operation.approval.prompt, {
          approvalId: operation.approval.id,
        });
      }
      continue;
    }

    if (operation.op === "set_phase") {
      transition(next, operation.phase, patch.agentId, operation.summary);
      continue;
    }

    if (operation.op === "set_outcome") {
      next.outcome = cloneValue(operation.outcome);
      next.liveness.state = operation.outcome.status === "waiting_external" ? "waiting_external" : "running";
      event(next, "outcome_recorded", patch.agentId, operation.outcome.summary, {
        outcomeId: operation.outcome.id,
        status: operation.outcome.status,
        simulated: operation.outcome.simulated,
      });
      continue;
    }

    if (operation.op === "set_result") {
      const validTerminalClaim = operation.result.completed
        && operation.result.verification.status === "verified"
        && completionReady(next);
      if (!validTerminalClaim) {
        reportRecoverableObstacle(next, {
          code: "invalid_terminal_claim",
          message: "Rejected a terminal claim without a verified completed outcome; the same task will continue.",
          actorId: patch.agentId,
          retryAfterMs: 0,
        });
        continue;
      }
      next.result = operation.result;
      next.failure = null;
      transition(next, "completed", patch.agentId, operation.result.summary);
      event(next, "task_completed", patch.agentId, operation.result.summary, {
        simulated: operation.result.simulated,
        outcomeId: next.outcome?.id ?? null,
      });
      continue;
    }

    if (operation.op === "report_obstacle") {
      reportRecoverableObstacle(next, {
        code: operation.code,
        message: operation.message,
        actorId: patch.agentId,
        retryAfterMs: operation.retryAfterMs,
      });
      continue;
    }

    if (operation.op === "complete_assignment") {
      assignment.status = "completed";
      assignment.completedAt = next.updatedAt;
      event(next, "assignment_completed", patch.agentId, `Completed ${assignment.capability}.`, {
        assignmentId: assignment.id,
      });
      continue;
    }

    if (operation.op === "fail") {
      assignment.status = "completed";
      assignment.error = operation.message;
      assignment.completedAt = next.updatedAt;
      reportRecoverableObstacle(next, {
        code: operation.code,
        message: operation.message,
        actorId: patch.agentId,
        retryAfterMs: 0,
      });
    }
  }

  event(next, "agent_patch_applied", patch.agentId, `Applied a bounded patch from ${patch.agentId}.`, {
    assignmentId: assignment.id,
    operationCount: patch.operations.length,
  });
  markProgress(next);
  return next;
}

export function advanceAsymptaTask(task: AsymptaTaskState) {
  let current = normalizeLegacyDeadEnd(cloneTask(task));
  if (TRUE_TERMINAL_PHASES.has(current.phase)) return current;
  if (unresolved(current).length) {
    transition(current, "awaiting_human", "requirement-resolver", "A concrete next input is visible; the task remains active.");
    return current;
  }
  if (current.approvals.some((approval) => approval.status === "pending")) {
    transition(current, "awaiting_approval", "policy-gate", "Waiting only at the consequential action boundary.");
    return current;
  }
  if (!dueForRetry(current)) {
    current.liveness.state = current.outcome?.status === "waiting_external" ? "waiting_external" : "running";
    return current;
  }

  current = ensureInitialAssignments(current);
  let agentSteps = 0;

  while (agentSteps < current.limits.maxAgentSteps) {
    if (TRUE_TERMINAL_PHASES.has(current.phase)) return current;
    if (unresolved(current).length) {
      transition(current, "awaiting_human", "requirement-resolver", "A concrete next input is visible; the task remains active.");
      return current;
    }
    if (current.approvals.some((approval) => approval.status === "pending")) {
      transition(current, "awaiting_approval", "policy-gate", "Waiting only at the consequential action boundary.");
      return current;
    }
    if (!dueForRetry(current)) return current;

    let queued = current.assignments.find((assignment) => assignment.status === "queued");
    if (queued) {
      current = startAssignment(current, queued.id);
      const running = current.assignments.find((assignment) => assignment.id === queued?.id);
      if (!running) {
        current = scheduleContinuation(current, "assignment_missing", "An assignment disappeared; rebuild the bounded assignment and continue.");
        return current;
      }
      const patch = runLogicalAgent(current, running);
      current = applyAsymptaAgentPatch(current, patch);
      agentSteps += 1;
      continue;
    }

    const runningAssignments = current.assignments.filter((assignment) => assignment.status === "running");
    if (runningAssignments.length) {
      const recovered = cloneTask(current);
      recovered.revision += 1;
      recovered.updatedAt = nowIso();
      for (const assignment of recovered.assignments) {
        if (assignment.status !== "running") continue;
        assignment.status = "queued";
        assignment.error = "Recovered after an interrupted agent turn.";
      }
      reportRecoverableObstacle(recovered, {
        code: "interrupted_agent_turn",
        message: "Recovered interrupted agent work and returned it to the queue.",
        actorId: "task-kernel",
        retryAfterMs: 0,
      });
      current = recovered;
      agentSteps += 1;
      continue;
    }

    if (!current.plan) {
      const before = current.revision;
      current = ensureAssignment(current, {
        capability: "domain.plan",
        role: "specialist",
        actorId: "task-kernel",
      });
      if (current.revision === before) return scheduleContinuation(current, "planning_route_unavailable", "Retrying domain planning without terminating the task.");
      continue;
    }

    const unfinishedNonVerifier = current.assignments.filter((assignment) => assignment.agentId !== "independent-verifier"
      && !["completed", "cancelled"].includes(assignment.status));
    if (unfinishedNonVerifier.length) {
      const recovered = cloneTask(current);
      recovered.revision += 1;
      recovered.updatedAt = nowIso();
      for (const assignment of recovered.assignments) {
        if (assignment.agentId === "independent-verifier") continue;
        if (!["completed", "cancelled"].includes(assignment.status)) assignment.status = "queued";
      }
      reportRecoverableObstacle(recovered, {
        code: "assignment_requeued",
        message: "Requeued unfinished bounded work instead of ending the task.",
        actorId: "task-kernel",
        retryAfterMs: 0,
      });
      current = recovered;
      continue;
    }

    if (current.completion.requiresApproval && !taskHasApprovedApproval(current)) {
      return ensureApproval(current);
    }

    if (current.outcome?.status !== "completed") {
      if (current.outcome?.status === "waiting_external" && !dueForRetry(current)) return current;
      const before = current.revision;
      current = ensureAssignment(current, {
        capability: "execution.perform",
        role: "executor",
        actorId: "task-kernel",
      });
      if (current.revision === before) {
        return scheduleContinuation(current, "execution_route_unavailable", "Retrying execution routing without terminating the task.", 750);
      }
      continue;
    }

    if (!completionReady(current)) {
      return scheduleContinuation(current, "completion_evidence_incomplete", "The outcome exists but its completion evidence is incomplete; continue collecting evidence.");
    }

    if (!current.result?.completed) {
      const before = current.revision;
      current = ensureAssignment(current, {
        capability: "task.verify",
        role: "verifier",
        actorId: "task-kernel",
      });
      if (current.revision === before) {
        return scheduleContinuation(current, "verification_route_unavailable", "Retrying independent verification without terminating the task.");
      }
      continue;
    }

    return current;
  }

  return scheduleContinuation(current, "agent_step_budget", "The current bounded turn reached its step budget; automatically continue in the next turn.");
}

export function approveAsymptaTask(task: AsymptaTaskState, command: ApproveTaskCommand) {
  if (task.taskId !== command.taskId) throw new AsymptaTaskKernelError("task_not_found", `Task ${command.taskId} was not found.`);
  if (task.processedCommandIds.includes(command.commandId)) return task;
  if (TRUE_TERMINAL_PHASES.has(task.phase)) throw new AsymptaTaskKernelError("terminal_task", `Task ${task.taskId} is already ${task.phase}.`);
  assertRevision(task, command.expectedRevision);
  const next = cloneTask(task);
  const approval = next.approvals.find((candidate) => candidate.id === command.approvalId);
  if (!approval || approval.status !== "pending") throw new AsymptaTaskKernelError("invalid_command", `Approval ${command.approvalId} is not pending.`);
  next.revision += 1;
  next.updatedAt = nowIso(command.now);
  approval.status = command.approved ? "approved" : "rejected";
  approval.decidedAt = next.updatedAt;
  rememberCommand(next, command.commandId);
  event(next, "approval_decided", command.actorId ?? "human", command.approved ? "Approved the consequential action and resumed the same task." : "Rejected the consequential action.", {
    approvalId: approval.id,
    approved: command.approved,
  });
  if (!command.approved) {
    transition(next, "cancelled", command.actorId ?? "human", "The task was cancelled at the approval boundary.");
    next.assignments = next.assignments.map((assignment) => ["queued", "running"].includes(assignment.status)
      ? { ...assignment, status: "cancelled" as const, completedAt: next.updatedAt }
      : assignment);
    event(next, "task_cancelled", command.actorId ?? "human", "The task was cancelled at the approval boundary.");
    markProgress(next);
    return next;
  }

  next.outcome = next.outcome?.status === "waiting_external" ? null : next.outcome;
  next.liveness.state = "running";
  delete next.liveness.nextAttemptAt;
  delete next.liveness.obstacle;
  transition(next, "executing", "policy-gate", "Approval recorded; automatically resuming execution in the same typed task.");
  markProgress(next);
  return advanceAsymptaTask(next);
}

export function cancelAsymptaTask(task: AsymptaTaskState, command: CancelTaskCommand) {
  if (task.taskId !== command.taskId) throw new AsymptaTaskKernelError("task_not_found", `Task ${command.taskId} was not found.`);
  if (task.processedCommandIds.includes(command.commandId)) return task;
  if (TRUE_TERMINAL_PHASES.has(task.phase)) return task;
  assertRevision(task, command.expectedRevision);
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso(command.now);
  transition(next, "cancelled", command.actorId ?? "human", command.reason?.trim() || "The task was cancelled.");
  next.assignments = next.assignments.map((assignment) => assignment.status === "queued" || assignment.status === "running"
    ? { ...assignment, status: "cancelled", completedAt: next.updatedAt }
    : assignment);
  rememberCommand(next, command.commandId);
  event(next, "task_cancelled", command.actorId ?? "human", command.reason?.trim() || "The task was cancelled.");
  markProgress(next);
  return next;
}

export function isAsymptaTaskState(value: unknown): value is AsymptaTaskState {
  const record = asRecord(value);
  return Boolean(record
    && record.version === "asympta.task/0.4"
    && typeof record.taskId === "string"
    && Number.isInteger(record.revision)
    && Array.isArray(record.requirements)
    && Array.isArray(record.assignments)
    && Array.isArray(record.events)
    && asRecord(record.completion)
    && asRecord(record.liveness));
}

export function migrateAsymptaTaskState(value: unknown): AsymptaTaskState | null {
  if (isAsymptaTaskState(value)) return cloneTask(value);
  const legacy = asRecord(value);
  if (!legacy || legacy.version !== "asympta.task/0.3" || typeof legacy.taskId !== "string") return null;
  const rootIntent = asRecord(legacy.rootIntent);
  const rawIntent = typeof rootIntent?.raw === "string" ? rootIntent.raw : "Continue the task";
  const locale = normalizeLocale(typeof rootIntent?.locale === "string" ? rootIntent.locale : "en");
  const classification = inferTaskClassification(rawIntent);
  const mode = legacy.mode === "live" ? "live" : "simulated";
  const risk = ["none", "low", "medium", "high", "critical"].includes(String(legacy.risk))
    ? legacy.risk as AsymptaTaskState["risk"]
    : "low";
  const domain = typeof legacy.domain === "string" ? legacy.domain : classification.domain;
  const actionFamily = typeof legacy.actionFamily === "string" ? legacy.actionFamily : classification.actionFamily;
  const completion = createTaskCompletionContract({ actionFamily, intent: rawIntent, mode, risk });
  const requirements = Array.isArray(legacy.requirements) ? cloneValue(legacy.requirements) as AsymptaTaskRequirement[] : [];
  const evidence = Array.isArray(legacy.evidence) ? cloneValue(legacy.evidence) as AsymptaTaskState["evidence"] : [];
  const approvals = Array.isArray(legacy.approvals) ? cloneValue(legacy.approvals) as AsymptaTaskState["approvals"] : [];
  const legacyResult = asRecord(legacy.result) as AsymptaTaskResult | null;
  const receiptEvidence = evidence.find((candidate) => candidate.kind === "receipt" && candidate.verified);
  const canTrustLegacyCompletion = Boolean(legacyResult?.completed && (!completion.requiresReceipt || receiptEvidence));
  const migratedAt = nowIso();
  const legacyPhase = typeof legacy.phase === "string" ? legacy.phase as AsymptaTaskPhase : "coordinating";
  const migratedPhase: AsymptaTaskPhase = legacyPhase === "cancelled"
    ? "cancelled"
    : canTrustLegacyCompletion
      ? "completed"
      : requirements.some((requirement) => requirement.status === "unknown")
        ? "awaiting_human"
        : approvals.some((approval) => approval.status === "pending")
          ? "awaiting_approval"
          : "coordinating";
  const outcome = canTrustLegacyCompletion ? {
    id: `${legacy.taskId}:outcome:migrated`,
    kind: completion.outcomeKind,
    status: "completed" as const,
    simulated: mode !== "live",
    provider: "legacy-task-migration",
    summary: legacyResult?.summary ?? "Migrated a previously verified outcome.",
    ...(receiptEvidence ? { receiptId: String(asRecord(receiptEvidence.value)?.receiptId ?? receiptEvidence.id) } : {}),
    value: legacyResult?.value,
    createdAt: legacyResult?.completedAt ?? migratedAt,
    updatedAt: migratedAt,
  } : null;
  const assignments = Array.isArray(legacy.assignments)
    ? (cloneValue(legacy.assignments) as AsymptaTaskAssignment[]).map((assignment) => assignment.status === "running" || assignment.status === "failed"
      ? { ...assignment, status: "queued" as const, error: "Recovered during Task Kernel migration." }
      : assignment)
    : [];
  const migrated: AsymptaTaskState = {
    version: "asympta.task/0.4",
    taskId: legacy.taskId,
    activityId: typeof legacy.activityId === "string" ? legacy.activityId : null,
    revision: Number.isInteger(legacy.revision) ? Number(legacy.revision) + 1 : 1,
    rootIntent: { raw: rawIntent, locale },
    domain,
    actionFamily,
    mode,
    risk,
    phase: migratedPhase,
    title: typeof legacy.title === "string" ? legacy.title : rawIntent,
    summary: typeof legacy.summary === "string" ? legacy.summary : rawIntent,
    requirements,
    assignments,
    approvals,
    evidence,
    events: Array.isArray(legacy.events) ? cloneValue(legacy.events) as AsymptaTaskState["events"] : [],
    processedCommandIds: Array.isArray(legacy.processedCommandIds)
      ? legacy.processedCommandIds.filter((candidate): candidate is string => typeof candidate === "string").slice(-128)
      : [],
    limits: {
      maxAssignments: 24,
      maxDelegationDepth: 3,
      maxParallelAgents: 3,
      maxAgentSteps: 32,
    },
    completion,
    liveness: {
      state: migratedPhase === "completed"
        ? "completed"
        : migratedPhase === "cancelled"
          ? "cancelled"
          : migratedPhase === "awaiting_human"
            ? "awaiting_input"
            : migratedPhase === "awaiting_approval"
              ? "awaiting_approval"
              : "running",
      continuationCount: 0,
      recoveryCount: canTrustLegacyCompletion ? 0 : 1,
      lastProgressRevision: Number.isInteger(legacy.revision) ? Number(legacy.revision) + 1 : 1,
      lastProgressAt: migratedAt,
      ...(!canTrustLegacyCompletion && ["completed", "blocked", "failed"].includes(legacyPhase) ? {
        obstacle: {
          code: "legacy_false_terminal_reopened",
          message: "Reopened a legacy terminal state because no verified outcome receipt existed.",
          recoverable: true as const,
          at: migratedAt,
        },
      } : {}),
    },
    plan: asRecord(legacy.plan) ? cloneValue(legacy.plan) as AsymptaTaskState["plan"] : null,
    outcome,
    result: canTrustLegacyCompletion ? legacyResult : null,
    failure: null,
    createdAt: typeof legacy.createdAt === "string" ? legacy.createdAt : migratedAt,
    updatedAt: migratedAt,
  };
  event(migrated, "task_recovered", "task-migrator", canTrustLegacyCompletion
    ? "Migrated a verified legacy task into the continuous Task Kernel."
    : "Reopened a legacy task that did not contain a verified completed outcome.", {
    fromVersion: "asympta.task/0.3",
    previousPhase: legacyPhase,
  });
  return migrated;
}

export function publicTaskResult(task: AsymptaTaskState): AsymptaTaskResult | null {
  return task.result ? cloneTask(task).result : null;
}

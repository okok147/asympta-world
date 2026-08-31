import {
  createAdaptiveInteractionSchema,
  type AdaptiveInteractionSchema,
} from "./asympta-automatic-clarification-options.ts";
import {
  createDelegatedAssignment,
  initialAgentAssignments,
  runLogicalAgent,
} from "./asympta-agent-mesh.ts";
import type {
  AnswerRequirementCommand,
  ApproveTaskCommand,
  AsymptaAgentPatch,
  AsymptaTaskAnswerValue,
  AsymptaTaskAssignment,
  AsymptaTaskEventKind,
  AsymptaTaskFactSource,
  AsymptaTaskPhase,
  AsymptaTaskRequirement,
  AsymptaTaskResult,
  AsymptaTaskState,
  CancelTaskCommand,
  CreateAsymptaTaskInput,
} from "./asympta-task-kernel-types.ts";

const TERMINAL_PHASES = new Set<AsymptaTaskPhase>(["completed", "cancelled", "blocked", "failed"]);
const TV_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const EVENT_PATTERN = /(?:concert|show|performance|ticket|演唱會|演唱会|音樂會|音乐会|門票|门票|公演|チケット)/iu;
const PURCHASE_PATTERN = /(?:buy|purchase|order|procure|購買|购买|訂購|订购|購入|注文)/iu;

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

function cloneTask(task: AsymptaTaskState): AsymptaTaskState {
  if (typeof structuredClone === "function") return structuredClone(task);
  return JSON.parse(JSON.stringify(task)) as AsymptaTaskState;
}

function normalizeLocale(value: string | undefined) {
  const locale = (value ?? "en").toLowerCase();
  if (locale.startsWith("zh")) return "zh-Hant" as const;
  if (locale.startsWith("ja")) return "ja" as const;
  return "en" as const;
}

function inferTaskClassification(intent: string) {
  if (TV_PATTERN.test(intent)) return { domain: "commerce.consumer_electronics", actionFamily: "purchase" };
  if (EVENT_PATTERN.test(intent)) return { domain: "events", actionFamily: PURCHASE_PATTERN.test(intent) ? "purchase" : "discover" };
  if (PURCHASE_PATTERN.test(intent)) return { domain: "commerce", actionFamily: "purchase" };
  if (/(?:weather|forecast|天氣|天气|天気)/iu.test(intent)) return { domain: "weather", actionFamily: "read" };
  if (/(?:find|search|compare|research|尋找|搜集|比較|查找|検索|比較)/iu.test(intent)) return { domain: "information", actionFamily: "research" };
  return { domain: "general", actionFamily: "coordinate" };
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

function transition(task: AsymptaTaskState, phase: AsymptaTaskPhase, actorId: string, summary: string) {
  if (task.phase === phase) return;
  task.phase = phase;
  event(task, "phase_changed", actorId, summary, { phase });
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

function addAssignments(task: AsymptaTaskState, assignments: AsymptaTaskAssignment[], actorId: string) {
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
  const phase: AsymptaTaskPhase = assignment.role === "researcher"
    ? "discovering"
    : assignment.role === "coordinator" || assignment.role === "executor"
      ? "coordinating"
      : assignment.role === "verifier"
        ? "verifying"
        : "planning";
  transition(next, phase, assignment.agentId, `${assignment.agentId} started ${assignment.capability}.`);
  event(next, "assignment_started", assignment.agentId, `Started ${assignment.capability}.`, {
    assignmentId: assignment.id,
  });
  return next;
}

function ensureVerifier(task: AsymptaTaskState) {
  if (task.assignments.some((assignment) => assignment.agentId === "independent-verifier")) return task;
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso();
  const assignment = createDelegatedAssignment({
    task: next,
    capability: "task.verify",
    role: "verifier",
    scopeRequirementIds: next.requirements.map((requirement) => requirement.id),
    depth: 0,
    at: next.updatedAt,
  });
  addAssignments(next, [assignment], "task-kernel");
  return next;
}

function failTask(task: AsymptaTaskState, code: string, message: string, actorId = "task-kernel") {
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso();
  next.phase = "failed";
  next.failure = { code, message };
  event(next, "task_failed", actorId, message, { code });
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
  const task: AsymptaTaskState = {
    version: "asympta.task/0.3",
    taskId,
    activityId: input.activityId?.trim() || null,
    revision: 1,
    rootIntent: {
      raw: input.rootIntent.trim(),
      locale: normalizeLocale(input.locale),
    },
    domain: input.domain ?? classification.domain,
    actionFamily: input.actionFamily ?? classification.actionFamily,
    mode: input.mode ?? "simulated",
    risk: input.risk ?? "low",
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
      maxAssignments: 12,
      maxDelegationDepth: 3,
      maxParallelAgents: 3,
      maxAgentSteps: 24,
    },
    plan: null,
    result: null,
    failure: null,
    createdAt: at,
    updatedAt: at,
  };
  event(task, "task_created", "task-kernel", "Created one revisioned task from the original human intention.", {
    activityId: task.activityId,
    mode: task.mode,
  });
  event(task, "requirements_compiled", "requirement-resolver", "Compiled missing information into atomic requirements.", {
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      key: requirement.key,
      status: requirement.status,
    })),
  });

  if (unresolved(task).length) {
    transition(task, "awaiting_human", "requirement-resolver", "Waiting only for the next unresolved requirement.");
    return task;
  }
  transition(task, "planning", "task-kernel", "Every required fact is available; starting bounded agent coordination.");
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
    sensitive: false as const,
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
  if (TERMINAL_PHASES.has(task.phase)) throw new AsymptaTaskKernelError("terminal_task", `Task ${task.taskId} is already ${task.phase}.`);
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

  if (unresolved(next).length) {
    transition(next, "awaiting_human", "requirement-resolver", "Advanced to the next unresolved requirement without reinterpreting the intention.");
    return next;
  }

  transition(next, "planning", "task-kernel", "All requirements are resolved; starting the bounded agent mesh.");
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
      const duplicate = next.assignments.some((candidate) => candidate.capability === operation.capability
        && candidate.scopeRequirementIds.join("|") === [...new Set(operation.scopeRequirementIds)].join("|"));
      if (duplicate || depth > next.limits.maxDelegationDepth || next.assignments.length >= next.limits.maxAssignments) continue;
      const delegated = createDelegatedAssignment({
        task: next,
        capability: operation.capability,
        role: operation.role,
        scopeRequirementIds: operation.scopeRequirementIds,
        depth,
        at: next.updatedAt,
      });
      addAssignments(next, [delegated], patch.agentId);
      continue;
    }

    if (operation.op === "request_approval") {
      if (!next.approvals.some((candidate) => candidate.id === operation.approval.id)) next.approvals.push(operation.approval);
      next.phase = "awaiting_approval";
      event(next, "approval_requested", patch.agentId, operation.approval.prompt, {
        approvalId: operation.approval.id,
      });
      continue;
    }

    if (operation.op === "set_phase") {
      transition(next, operation.phase, patch.agentId, operation.summary);
      continue;
    }

    if (operation.op === "set_result") {
      next.result = operation.result;
      if (operation.result.completed) {
        next.phase = "completed";
        event(next, "task_completed", patch.agentId, operation.result.summary, {
          simulated: operation.result.simulated,
        });
      } else {
        next.phase = "blocked";
        next.failure = {
          code: "connected_executor_required",
          message: operation.result.summary,
        };
        event(next, "task_failed", patch.agentId, operation.result.summary, {
          code: "connected_executor_required",
        });
      }
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
      assignment.status = "failed";
      assignment.error = operation.message;
      assignment.completedAt = next.updatedAt;
      next.phase = "failed";
      next.failure = { code: operation.code, message: operation.message };
      event(next, "task_failed", patch.agentId, operation.message, { code: operation.code });
    }
  }

  event(next, "agent_patch_applied", patch.agentId, `Applied a bounded patch from ${patch.agentId}.`, {
    assignmentId: assignment.id,
    operationCount: patch.operations.length,
  });
  return next;
}

export function advanceAsymptaTask(task: AsymptaTaskState) {
  let current = cloneTask(task);
  if (TERMINAL_PHASES.has(current.phase)) return current;
  if (unresolved(current).length) {
    current.phase = "awaiting_human";
    return current;
  }
  if (current.approvals.some((approval) => approval.status === "pending")) {
    current.phase = "awaiting_approval";
    return current;
  }

  if (!current.assignments.length) {
    current.revision += 1;
    current.updatedAt = nowIso();
    addAssignments(current, initialAgentAssignments(current, current.updatedAt), "task-kernel");
  }

  let agentSteps = 0;
  while (agentSteps < current.limits.maxAgentSteps) {
    if (TERMINAL_PHASES.has(current.phase) || current.approvals.some((approval) => approval.status === "pending")) return current;
    let queued = current.assignments.find((assignment) => assignment.status === "queued");
    if (!queued) {
      const nonVerifierComplete = current.assignments
        .filter((assignment) => assignment.agentId !== "independent-verifier")
        .every((assignment) => ["completed", "cancelled"].includes(assignment.status));
      if (!nonVerifierComplete) return failTask(current, "assignment_stalled", "One or more agent assignments did not reach a terminal state.");
      current = ensureVerifier(current);
      queued = current.assignments.find((assignment) => assignment.status === "queued");
      if (!queued) {
        if (current.result) return current;
        return failTask(current, "missing_verifier_result", "The verifier finished without a terminal result.");
      }
    }

    current = startAssignment(current, queued.id);
    const running = current.assignments.find((assignment) => assignment.id === queued?.id);
    if (!running) return failTask(current, "assignment_missing", "An agent assignment disappeared before execution.");
    const patch = runLogicalAgent(current, running);
    current = applyAsymptaAgentPatch(current, patch);
    agentSteps += 1;
  }

  return failTask(current, "agent_step_limit", "The bounded agent mesh exceeded its step limit.");
}

export function approveAsymptaTask(task: AsymptaTaskState, command: ApproveTaskCommand) {
  if (task.taskId !== command.taskId) throw new AsymptaTaskKernelError("task_not_found", `Task ${command.taskId} was not found.`);
  if (task.processedCommandIds.includes(command.commandId)) return task;
  if (TERMINAL_PHASES.has(task.phase)) throw new AsymptaTaskKernelError("terminal_task", `Task ${task.taskId} is already ${task.phase}.`);
  assertRevision(task, command.expectedRevision);
  const next = cloneTask(task);
  const approval = next.approvals.find((candidate) => candidate.id === command.approvalId);
  if (!approval || approval.status !== "pending") throw new AsymptaTaskKernelError("invalid_command", `Approval ${command.approvalId} is not pending.`);
  next.revision += 1;
  next.updatedAt = nowIso(command.now);
  approval.status = command.approved ? "approved" : "rejected";
  approval.decidedAt = next.updatedAt;
  rememberCommand(next, command.commandId);
  event(next, "approval_decided", command.actorId ?? "human", command.approved ? "Approved the bounded external action." : "Rejected the external action.", {
    approvalId: approval.id,
    approved: command.approved,
  });
  if (!command.approved) {
    next.phase = "cancelled";
    event(next, "task_cancelled", command.actorId ?? "human", "The task was cancelled at the approval boundary.");
    return next;
  }

  const coordinator = createDelegatedAssignment({
    task: next,
    capability: "execution.coordinate",
    role: "executor",
    scopeRequirementIds: next.requirements.map((requirement) => requirement.id),
    depth: 0,
    at: next.updatedAt,
  });
  const verifier = createDelegatedAssignment({
    task: next,
    capability: "task.verify",
    role: "verifier",
    scopeRequirementIds: next.requirements.map((requirement) => requirement.id),
    depth: 0,
    at: next.updatedAt,
  });
  addAssignments(next, [coordinator, verifier], "policy-gate");
  transition(next, "executing", "policy-gate", "Approval recorded; continuing through the typed task state.");
  return advanceAsymptaTask(next);
}

export function cancelAsymptaTask(task: AsymptaTaskState, command: CancelTaskCommand) {
  if (task.taskId !== command.taskId) throw new AsymptaTaskKernelError("task_not_found", `Task ${command.taskId} was not found.`);
  if (task.processedCommandIds.includes(command.commandId)) return task;
  if (TERMINAL_PHASES.has(task.phase)) return task;
  assertRevision(task, command.expectedRevision);
  const next = cloneTask(task);
  next.revision += 1;
  next.updatedAt = nowIso(command.now);
  next.phase = "cancelled";
  next.assignments = next.assignments.map((assignment) => assignment.status === "queued" || assignment.status === "running"
    ? { ...assignment, status: "cancelled", completedAt: next.updatedAt }
    : assignment);
  rememberCommand(next, command.commandId);
  event(next, "task_cancelled", command.actorId ?? "human", command.reason?.trim() || "The task was cancelled.");
  return next;
}

export function isAsymptaTaskState(value: unknown): value is AsymptaTaskState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.version === "asympta.task/0.3"
    && typeof record.taskId === "string"
    && Number.isInteger(record.revision)
    && Array.isArray(record.requirements)
    && Array.isArray(record.events);
}

export function publicTaskResult(task: AsymptaTaskState): AsymptaTaskResult | null {
  return task.result ? cloneTask(task).result : null;
}

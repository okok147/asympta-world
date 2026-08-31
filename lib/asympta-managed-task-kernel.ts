import {
  advanceAsymptaTask as advanceCoreAsymptaTask,
  answerTaskRequirement as answerCoreTaskRequirement,
  approveAsymptaTask as approveCoreAsymptaTask,
  cancelAsymptaTask as cancelCoreAsymptaTask,
  createAsymptaTask as createCoreAsymptaTask,
  isAsymptaTaskState,
  migrateAsymptaTaskState as migrateCoreAsymptaTaskState,
  nextTaskRequirement,
  taskToAdaptiveInteractionSchema,
} from "./asympta-task-kernel.ts";
import {
  compileRequirementContract,
  requirementSemantic,
  type AsymptaRequirementContractSnapshot,
} from "./asympta-requirement-contracts.ts";
import type {
  AnswerRequirementCommand,
  ApproveTaskCommand,
  AsymptaTaskRequirement,
  AsymptaTaskState,
  CancelTaskCommand,
  CreateAsymptaTaskInput,
} from "./asympta-task-kernel-types.ts";

export { isAsymptaTaskState, nextTaskRequirement, taskToAdaptiveInteractionSchema };

export type ManagedAsymptaTaskState = AsymptaTaskState & {
  requirementContract?: AsymptaRequirementContractSnapshot;
};

function cloneTask(task: AsymptaTaskState): ManagedAsymptaTaskState {
  if (typeof structuredClone === "function") return structuredClone(task) as ManagedAsymptaTaskState;
  return JSON.parse(JSON.stringify(task)) as ManagedAsymptaTaskState;
}

function readContract(task: AsymptaTaskState): AsymptaRequirementContractSnapshot | null {
  const candidate = Reflect.get(task, "requirementContract");
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const id = Reflect.get(candidate, "id");
  const version = Reflect.get(candidate, "version");
  const requiredSemantics = Reflect.get(candidate, "requiredSemantics");
  if (typeof id !== "string" || version !== "asympta.requirement-contract/0.1" || !Array.isArray(requiredSemantics)) return null;
  return candidate as AsymptaRequirementContractSnapshot;
}

function attachContract(task: AsymptaTaskState, snapshot: AsymptaRequirementContractSnapshot) {
  const next = cloneTask(task);
  next.requirementContract = snapshot;
  next.events = next.events.map((event) => event.kind === "requirements_compiled"
    ? {
        ...event,
        data: {
          ...(event.data ?? {}),
          requirementContractId: snapshot.id,
          requirementContractVersion: snapshot.version,
          completionMode: snapshot.completionMode,
          proposalKind: snapshot.proposalKind,
          requiredSemantics: snapshot.requiredSemantics,
          synthesizedFields: snapshot.synthesizedFields,
        },
      }
    : event);
  return next;
}

function representedSemantics(requirements: AsymptaTaskRequirement[]) {
  const represented = new Set<string>();
  for (const requirement of requirements) {
    represented.add(requirementSemantic(requirement.key));
    represented.add(requirementSemantic(requirement.semantic));
    represented.add(requirementSemantic(requirement.raw));
  }
  return represented;
}

function sameRequirement(left: AsymptaTaskRequirement, right: AsymptaTaskRequirement) {
  const rightSemantics = new Set([
    requirementSemantic(right.key),
    requirementSemantic(right.semantic),
    requirementSemantic(right.raw),
  ]);
  return [left.key, left.semantic, left.raw]
    .map(requirementSemantic)
    .some((semantic) => rightSemantics.has(semantic));
}

function carryResolvedFacts(target: AsymptaTaskState, source: AsymptaTaskState) {
  for (const requirement of target.requirements) {
    const previous = source.requirements.find((candidate) => sameRequirement(requirement, candidate));
    if (!previous || previous.status === "unknown" || previous.value === undefined) continue;
    requirement.status = previous.status;
    requirement.value = previous.value;
    requirement.displayValue = previous.displayValue;
    requirement.provenance = previous.provenance ? { ...previous.provenance } : undefined;
    requirement.lockedBy = previous.lockedBy;
  }
}

function appendRecoveryEvent(task: ManagedAsymptaTaskState, summary: string, data?: Record<string, unknown>) {
  task.events.push({
    id: `${task.taskId}:event:${task.events.length + 1}`,
    taskId: task.taskId,
    revision: task.revision,
    kind: "task_recovered",
    actorId: "requirement-contract-gate",
    summary,
    ...(data ? { data } : {}),
    at: task.updatedAt,
  });
}

function contractInput(task: AsymptaTaskState) {
  return {
    rootIntent: task.rootIntent.raw,
    domain: task.domain,
    actionFamily: task.actionFamily,
    missingFields: task.requirements.map((requirement) => requirement.raw),
  };
}

function ensureRequirementContract(task: AsymptaTaskState) {
  const compiled = compileRequirementContract(contractInput(task));
  const snapshot = readContract(task) ?? compiled.snapshot;
  const represented = representedSemantics(task.requirements);
  const missingDefinitions = snapshot.requiredSemantics.filter((semantic) => !represented.has(semantic));
  if (!missingDefinitions.length) return attachContract(task, snapshot);

  const rebuilt = createCoreAsymptaTask({
    taskId: task.taskId,
    activityId: task.activityId,
    rootIntent: task.rootIntent.raw,
    locale: task.rootIntent.locale,
    domain: task.domain,
    actionFamily: task.actionFamily,
    mode: task.mode,
    risk: task.risk,
    confirmationRequired: task.completion.requiresApproval,
    title: task.title,
    summary: task.summary,
    missingFields: compiled.missingFields,
    now: task.updatedAt,
  });
  carryResolvedFacts(rebuilt, task);

  const next = attachContract(rebuilt, snapshot);
  next.revision = Math.max(task.revision + 1, rebuilt.revision);
  next.createdAt = task.createdAt;
  next.updatedAt = new Date().toISOString();
  next.processedCommandIds = [...task.processedCommandIds].slice(-128);
  next.approvals = task.approvals
    .filter((approval) => approval.status === "approved")
    .map((approval) => ({ ...approval }));
  next.evidence = task.evidence
    .filter((evidence) => evidence.kind !== "verification" && evidence.kind !== "receipt")
    .map((evidence) => ({ ...evidence }));
  next.events = [
    ...task.events.filter((event) => event.kind !== "task_completed" && event.kind !== "task_failed"),
    ...next.events.filter((event) => event.kind === "requirements_compiled"),
  ];
  next.assignments = [];
  next.plan = null;
  next.outcome = null;
  next.result = null;
  next.failure = null;
  next.liveness.state = next.requirements.some((requirement) => requirement.status === "unknown")
    ? "awaiting_input"
    : "running";
  next.liveness.recoveryCount = task.liveness.recoveryCount + 1;
  next.liveness.lastProgressRevision = next.revision;
  next.liveness.lastProgressAt = next.updatedAt;
  delete next.liveness.nextAttemptAt;
  next.liveness.obstacle = {
    code: "requirement_contract_augmented",
    message: "Added missing data-defined requirements and resumed the same task instead of stopping.",
    recoverable: true,
    at: next.updatedAt,
  };
  next.phase = next.liveness.state === "awaiting_input" ? "awaiting_human" : "coordinating";
  appendRecoveryEvent(next, "Added missing data-defined requirements and resumed the same task.", {
    requirementContractId: snapshot.id,
    missingDefinitions,
  });
  return next.liveness.state === "awaiting_input" ? next : attachContract(advanceCoreAsymptaTask(next), snapshot);
}

function finalizeManaged(task: AsymptaTaskState) {
  const contracted = ensureRequirementContract(task);
  return attachContract(contracted, readContract(contracted) ?? compileRequirementContract(contractInput(contracted)).snapshot);
}

export function createAsymptaTask(input: CreateAsymptaTaskInput) {
  const compiled = compileRequirementContract({
    rootIntent: input.rootIntent,
    domain: input.domain,
    actionFamily: input.actionFamily,
    missingFields: input.missingFields,
  });
  const task = createCoreAsymptaTask({
    ...input,
    missingFields: compiled.missingFields,
  });
  return attachContract(task, compiled.snapshot);
}

export function answerTaskRequirement(task: AsymptaTaskState, command: AnswerRequirementCommand) {
  return finalizeManaged(answerCoreTaskRequirement(ensureRequirementContract(task), command));
}

export function approveAsymptaTask(task: AsymptaTaskState, command: ApproveTaskCommand) {
  return finalizeManaged(approveCoreAsymptaTask(ensureRequirementContract(task), command));
}

export function cancelAsymptaTask(task: AsymptaTaskState, command: CancelTaskCommand) {
  return finalizeManaged(cancelCoreAsymptaTask(ensureRequirementContract(task), command));
}

export function advanceAsymptaTask(task: AsymptaTaskState) {
  return finalizeManaged(advanceCoreAsymptaTask(ensureRequirementContract(task)));
}

export function migrateAsymptaTaskState(value: unknown) {
  const migrated = migrateCoreAsymptaTaskState(value);
  return migrated ? ensureRequirementContract(migrated) : null;
}

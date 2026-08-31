export type AsymptaJsonValue =
  | null
  | boolean
  | number
  | string
  | AsymptaJsonValue[]
  | { [key: string]: AsymptaJsonValue };

export type AsymptaTaskStage =
  | "discovery"
  | "selection"
  | "commitment"
  | "execution"
  | "verification";

export type AsymptaTaskFactStatus =
  | "explicit"
  | "confirmed"
  | "tool_verified"
  | "profile"
  | "inferred"
  | "defaulted";

export type AsymptaTaskFactSource =
  | "user_message"
  | "user_confirmation"
  | "tool_result"
  | "approved_user_profile"
  | "agent_inference"
  | "system_default";

export type AsymptaTaskFact = {
  key: string;
  value: AsymptaJsonValue;
  status: AsymptaTaskFactStatus;
  source: {
    type: AsymptaTaskFactSource;
    ref: string;
    evidence?: string;
  };
  confidence: number;
  scope: "turn" | "task" | "session" | "long_term";
  domain?: string;
  sensitive?: boolean;
  updatedAt?: string;
  expiresAt?: string;
};

export type AsymptaLocalizedText = {
  en: string;
  "zh-Hant"?: string;
  ja?: string;
};

export type AsymptaTaskQuestionOption = {
  value: AsymptaJsonValue;
  label: AsymptaLocalizedText;
  description?: AsymptaLocalizedText;
};

export type AsymptaTaskQuestion = {
  id: string;
  field: string;
  prompt: string;
  reason: string;
  answerType: "single_choice" | "text" | "number" | "boolean";
  options: Array<{
    value: AsymptaJsonValue;
    label: string;
    description?: string;
  }>;
  allowSkip: boolean;
  skipValue?: AsymptaJsonValue;
  remember: "offer" | "never" | "always";
  sensitive: boolean;
};

export type AsymptaRequirementCondition = {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "one_of"
    | "present"
    | "missing"
    | "status_equals";
  value?: AsymptaJsonValue | AsymptaJsonValue[] | AsymptaTaskFactStatus;
};

export type AsymptaTaskRequirement = {
  id: string;
  capability: string;
  field: string;
  stage: AsymptaTaskStage;
  blocking: boolean;
  priority: number;
  userEffort: number;
  description: AsymptaLocalizedText;
  when?: AsymptaRequirementCondition[];
  acceptedValues?: AsymptaJsonValue[];
  question?: {
    prompt: AsymptaLocalizedText;
    answerType: AsymptaTaskQuestion["answerType"];
    options?: AsymptaTaskQuestionOption[];
    allowSkip?: boolean;
    skipValue?: AsymptaJsonValue;
    remember?: AsymptaTaskQuestion["remember"];
    sensitive?: boolean;
  };
};

export type AsymptaTaskGoal = {
  action: string;
  domain: string;
  desiredOutcome: string;
};

export type AsymptaActionPermission = {
  action: string;
  mode: "allowed" | "approval_required" | "prohibited";
  reason?: string;
};

export type AsymptaSuccessCriterion = {
  id: string;
  description: string;
  requiredEvidence?: string[];
};

export type AsymptaTaskReadiness = {
  status: "needs_information" | "ready";
  targetStage: AsymptaTaskStage;
  missingRequirementIds: string[];
  nonBlockingRequirementIds: string[];
  blockingReasons: string[];
  nextRequirementId: string | null;
  nextQuestion: AsymptaTaskQuestion | null;
};

export type AsymptaTaskIntent = {
  schemaVersion: "asympta.task-intent.v1";
  taskId: string;
  conversationId: string;
  goal: AsymptaTaskGoal;
  targetStage: AsymptaTaskStage;
  facts: AsymptaTaskFact[];
  requirements: AsymptaTaskRequirement[];
  readiness: AsymptaTaskReadiness;
  permissions: AsymptaActionPermission[];
  successCriteria: AsymptaSuccessCriterion[];
  provenance: {
    compiler: string;
    createdAt: string;
  };
};

export type AsymptaTaskPacket = {
  schemaVersion: "asympta.task-packet.v1";
  taskId: string;
  goal: AsymptaTaskGoal;
  recipient: string;
  capability: string;
  context: Record<string, AsymptaJsonValue>;
  contextProvenance: Record<string, {
    status: AsymptaTaskFactStatus;
    source: AsymptaTaskFactSource;
    ref: string;
  }>;
  unknownButNonBlocking: string[];
  permissions: AsymptaActionPermission[];
  successCriteria: AsymptaSuccessCriterion[];
};

export type AsymptaCompletionReceipt = {
  schemaVersion: "asympta.receipt.v1";
  taskId: string;
  status: "completed" | "failed";
  effects: Array<{
    type: string;
    data: Record<string, AsymptaJsonValue>;
  }>;
  criteria: Array<{
    id: string;
    passed: boolean;
    evidence: string[];
  }>;
  verifiedBy: string;
  provenance: "simulated" | "tool_verified" | "external_verified";
  createdAt: string;
};

export type CreateAsymptaTaskIntentInput = {
  taskId: string;
  conversationId?: string;
  goal: AsymptaTaskGoal;
  targetStage: AsymptaTaskStage;
  factLayers: AsymptaTaskFact[][];
  requirements: AsymptaTaskRequirement[];
  permissions?: AsymptaActionPermission[];
  successCriteria?: AsymptaSuccessCriterion[];
  locale?: string;
  now?: number | string | Date;
  compiler?: string;
};

const STAGE_ORDER: Record<AsymptaTaskStage, number> = {
  discovery: 0,
  selection: 1,
  commitment: 2,
  execution: 3,
  verification: 4,
};

const FACT_PRIORITY: Record<AsymptaTaskFactStatus, number> = {
  explicit: 600,
  confirmed: 550,
  tool_verified: 500,
  profile: 400,
  inferred: 200,
  defaulted: 100,
};

function normalizedDate(value: number | string | Date | undefined) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function dateValue(value: string | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isExpired(fact: AsymptaTaskFact, now: number) {
  if (!fact.expiresAt) return false;
  const expiresAt = new Date(fact.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function isPresent(value: AsymptaJsonValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function jsonEqual(left: AsymptaJsonValue | undefined, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function factRecord(facts: AsymptaTaskFact[]) {
  return new Map(facts.map((fact) => [fact.key, fact]));
}

function localized(text: AsymptaLocalizedText, locale = "en") {
  if (locale.startsWith("zh") && text["zh-Hant"]) return text["zh-Hant"];
  if (locale.startsWith("ja") && text.ja) return text.ja;
  return text.en;
}

function conditionMatches(condition: AsymptaRequirementCondition, facts: Map<string, AsymptaTaskFact>) {
  const fact = facts.get(condition.field);
  const present = Boolean(fact && isPresent(fact.value));
  switch (condition.operator) {
    case "present":
      return present;
    case "missing":
      return !present;
    case "equals":
      return present && jsonEqual(fact?.value, condition.value);
    case "not_equals":
      return !present || !jsonEqual(fact?.value, condition.value);
    case "one_of":
      return present && Array.isArray(condition.value)
        && condition.value.some((candidate) => jsonEqual(fact?.value, candidate));
    case "status_equals":
      return Boolean(fact && fact.status === condition.value);
    default:
      return false;
  }
}

function requirementApplies(requirement: AsymptaTaskRequirement, facts: Map<string, AsymptaTaskFact>) {
  return (requirement.when ?? []).every((condition) => conditionMatches(condition, facts));
}

function requirementSatisfied(requirement: AsymptaTaskRequirement, facts: Map<string, AsymptaTaskFact>) {
  const fact = facts.get(requirement.field);
  if (!fact || !isPresent(fact.value)) return false;
  if (!requirement.acceptedValues?.length) return true;
  return requirement.acceptedValues.some((candidate) => jsonEqual(fact.value, candidate));
}

function questionFor(requirement: AsymptaTaskRequirement, locale = "en"): AsymptaTaskQuestion {
  const question = requirement.question;
  const prompt = question?.prompt
    ? localized(question.prompt, locale)
    : `Please provide ${requirement.field.replaceAll("_", " ")}.`;
  return {
    id: `${requirement.id}:question`,
    field: requirement.field,
    prompt,
    reason: localized(requirement.description, locale),
    answerType: question?.answerType ?? "text",
    options: (question?.options ?? []).map((option) => ({
      value: option.value,
      label: localized(option.label, locale),
      ...(option.description ? { description: localized(option.description, locale) } : {}),
    })),
    allowSkip: question?.allowSkip ?? false,
    ...(question?.skipValue !== undefined ? { skipValue: question.skipValue } : {}),
    remember: question?.remember ?? "offer",
    sensitive: question?.sensitive ?? requirement.question?.sensitive ?? false,
  };
}

export function resolveAsymptaTaskFacts(
  factLayers: AsymptaTaskFact[][],
  now: number | string | Date = Date.now(),
) {
  const nowValue = new Date(now).getTime();
  const resolved = new Map<string, { fact: AsymptaTaskFact; sequence: number }>();
  let sequence = 0;

  for (const layer of factLayers) {
    for (const rawFact of layer) {
      sequence += 1;
      if (!rawFact.key.trim() || isExpired(rawFact, nowValue)) continue;
      const fact: AsymptaTaskFact = {
        ...rawFact,
        key: rawFact.key.trim(),
        confidence: Math.max(0, Math.min(1, Number(rawFact.confidence))),
      };
      const current = resolved.get(fact.key);
      if (!current) {
        resolved.set(fact.key, { fact, sequence });
        continue;
      }

      const priority = FACT_PRIORITY[fact.status];
      const currentPriority = FACT_PRIORITY[current.fact.status];
      const shouldReplace = priority > currentPriority
        || (priority === currentPriority && dateValue(fact.updatedAt) > dateValue(current.fact.updatedAt))
        || (priority === currentPriority
          && dateValue(fact.updatedAt) === dateValue(current.fact.updatedAt)
          && sequence > current.sequence);
      if (shouldReplace) resolved.set(fact.key, { fact, sequence });
    }
  }

  return [...resolved.values()].map((entry) => entry.fact);
}

export function evaluateAsymptaTaskReadiness(input: {
  targetStage: AsymptaTaskStage;
  facts: AsymptaTaskFact[];
  requirements: AsymptaTaskRequirement[];
  locale?: string;
}): AsymptaTaskReadiness {
  const facts = factRecord(input.facts);
  const relevant = input.requirements.filter((requirement) => (
    STAGE_ORDER[requirement.stage] <= STAGE_ORDER[input.targetStage]
    && requirementApplies(requirement, facts)
  ));
  const unresolved = relevant.filter((requirement) => !requirementSatisfied(requirement, facts));
  const blocking = unresolved.filter((requirement) => requirement.blocking);
  const nonBlocking = unresolved.filter((requirement) => !requirement.blocking);
  const ordered = [...blocking].sort((left, right) => (
    STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage]
    || right.priority - left.priority
    || left.userEffort - right.userEffort
    || left.id.localeCompare(right.id)
  ));
  const next = ordered[0] ?? null;

  return {
    status: blocking.length ? "needs_information" : "ready",
    targetStage: input.targetStage,
    missingRequirementIds: blocking.map((requirement) => requirement.id),
    nonBlockingRequirementIds: nonBlocking.map((requirement) => requirement.id),
    blockingReasons: blocking.map((requirement) => localized(requirement.description, input.locale)),
    nextRequirementId: next?.id ?? null,
    nextQuestion: next ? questionFor(next, input.locale) : null,
  };
}

export function createAsymptaTaskIntent(input: CreateAsymptaTaskIntentInput): AsymptaTaskIntent {
  const createdAt = normalizedDate(input.now);
  const facts = resolveAsymptaTaskFacts(input.factLayers, createdAt);
  const readiness = evaluateAsymptaTaskReadiness({
    targetStage: input.targetStage,
    facts,
    requirements: input.requirements,
    locale: input.locale,
  });
  return {
    schemaVersion: "asympta.task-intent.v1",
    taskId: input.taskId,
    conversationId: input.conversationId ?? input.taskId,
    goal: input.goal,
    targetStage: input.targetStage,
    facts,
    requirements: input.requirements,
    readiness,
    permissions: input.permissions ?? [],
    successCriteria: input.successCriteria ?? [],
    provenance: {
      compiler: input.compiler ?? "asympta-task-readiness/1",
      createdAt,
    },
  };
}

export function recompileAsymptaTaskIntent(
  current: AsymptaTaskIntent,
  additionalFacts: AsymptaTaskFact[],
  options: { targetStage?: AsymptaTaskStage; locale?: string; now?: number | string | Date } = {},
) {
  return createAsymptaTaskIntent({
    taskId: current.taskId,
    conversationId: current.conversationId,
    goal: current.goal,
    targetStage: options.targetStage ?? current.targetStage,
    factLayers: [current.facts, additionalFacts],
    requirements: current.requirements,
    permissions: current.permissions,
    successCriteria: current.successCriteria,
    locale: options.locale,
    now: options.now,
    compiler: current.provenance.compiler,
  });
}

export function confirmedTaskFact(input: {
  key: string;
  value: AsymptaJsonValue;
  requestId: string;
  domain?: string;
  sensitive?: boolean;
  now?: number | string | Date;
}): AsymptaTaskFact {
  return {
    key: input.key,
    value: input.value,
    status: "confirmed",
    source: { type: "user_confirmation", ref: input.requestId },
    confidence: 1,
    scope: "task",
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.sensitive ? { sensitive: true } : {}),
    updatedAt: normalizedDate(input.now),
  };
}

export class AsymptaNeedsInformationError extends Error {
  readonly taskId: string;
  readonly readiness: AsymptaTaskReadiness;

  constructor(task: AsymptaTaskIntent) {
    super(task.readiness.nextQuestion?.prompt ?? "The task needs more information before it can execute.");
    this.name = "AsymptaNeedsInformationError";
    this.taskId = task.taskId;
    this.readiness = task.readiness;
  }
}

export function assertAsymptaTaskReady(task: AsymptaTaskIntent) {
  if (task.readiness.status !== "ready") throw new AsymptaNeedsInformationError(task);
  return task;
}

export function buildAsymptaTaskPacket(
  task: AsymptaTaskIntent,
  input: {
    recipient: string;
    capability: string;
    fields: string[];
    includeSensitive?: boolean;
  },
): AsymptaTaskPacket {
  assertAsymptaTaskReady(task);
  const selected = task.facts.filter((fact) => (
    input.fields.includes(fact.key)
    && (input.includeSensitive || !fact.sensitive)
  ));
  const context = Object.fromEntries(selected.map((fact) => [fact.key, fact.value]));
  const contextProvenance = Object.fromEntries(selected.map((fact) => [fact.key, {
    status: fact.status,
    source: fact.source.type,
    ref: fact.source.ref,
  }]));
  const known = new Set(selected.map((fact) => fact.key));
  const unknownButNonBlocking = task.requirements
    .filter((requirement) => input.fields.includes(requirement.field) && !requirement.blocking && !known.has(requirement.field))
    .map((requirement) => requirement.field);

  return {
    schemaVersion: "asympta.task-packet.v1",
    taskId: task.taskId,
    goal: task.goal,
    recipient: input.recipient,
    capability: input.capability,
    context,
    contextProvenance,
    unknownButNonBlocking,
    permissions: task.permissions,
    successCriteria: task.successCriteria,
  };
}

export function validateAsymptaCompletionReceipt(
  task: AsymptaTaskIntent,
  receipt: AsymptaCompletionReceipt,
) {
  const issues: string[] = [];
  if (receipt.schemaVersion !== "asympta.receipt.v1") issues.push("Unsupported receipt schema version.");
  if (receipt.taskId !== task.taskId) issues.push("Receipt task id does not match the task intent.");
  const criteria = new Map(receipt.criteria.map((criterion) => [criterion.id, criterion]));
  for (const expected of task.successCriteria) {
    const result = criteria.get(expected.id);
    if (!result) issues.push(`Missing completion criterion: ${expected.id}.`);
    else if (!result.passed) issues.push(`Completion criterion failed: ${expected.id}.`);
    else if ((expected.requiredEvidence ?? []).some((kind) => !result.evidence.includes(kind))) {
      issues.push(`Completion criterion lacks required evidence: ${expected.id}.`);
    }
  }
  if (receipt.status === "completed" && issues.length) issues.push("A completed receipt cannot contain failed or missing criteria.");
  return { valid: issues.length === 0, issues };
}

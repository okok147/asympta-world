import {
  ASYMPTA_ACTION_TYPES,
  ASYMPTA_AGENT_IDS,
  ASYMPTA_LOCATION_IDS,
  CONSEQUENTIAL_ACTIONS,
  type AsymptaActionType,
  type AsymptaAgentId,
  type AsymptaLocationId,
  type IntentPlan,
  type IntentTaskSpec,
  type PlannerResult,
} from "./types.ts";

type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function stringArray(value: unknown, maximum: number, itemMaximum: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const normalized = boundedText(item, 1, itemMaximum);
    if (!normalized || result.includes(normalized)) continue;
    result.push(normalized);
    if (result.length >= maximum) break;
  }
  return result;
}

function safeInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function canonicalTaskId(value: unknown, index: number) {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  const slug = text
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug ? `step-${index + 1}-${slug}` : `step-${index + 1}`;
}

function isAgentId(value: unknown): value is AsymptaAgentId {
  return typeof value === "string" && (ASYMPTA_AGENT_IDS as readonly string[]).includes(value);
}

function isLocationId(value: unknown): value is AsymptaLocationId {
  return typeof value === "string" && (ASYMPTA_LOCATION_IDS as readonly string[]).includes(value);
}

function isActionType(value: unknown): value is AsymptaActionType {
  return typeof value === "string" && (ASYMPTA_ACTION_TYPES as readonly string[]).includes(value);
}

function hasCycle(tasks: readonly IntentTaskSpec[]) {
  const dependencies = new Map(tasks.map((task) => [task.id, task.dependsOn]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  return tasks.some((task) => visit(task.id));
}

export function normalizeUserIntent(value: unknown): Validation<string> {
  const intent = boundedText(value, 3, 1_200);
  return intent
    ? { ok: true, value: intent }
    : { ok: false, error: "Intent must contain 3 to 1,200 characters." };
}

export function validateIntentPlan(value: unknown, intent = "User intention"): Validation<IntentPlan> {
  const input = record(value);
  if (!input) return { ok: false, error: "Plan must be an object." };

  const title = boundedText(input.title, 3, 100);
  const summary = boundedText(input.summary, 3, 500);
  const outcome = boundedText(input.outcome, 3, 500);
  if (!title || !summary || !outcome) {
    return { ok: false, error: "Plan title, summary, and outcome are required and bounded." };
  }

  const rawTasks = Array.isArray(input.tasks) ? input.tasks : [];
  if (rawTasks.length < 3 || rawTasks.length > 14) {
    return { ok: false, error: "Plan must contain between 3 and 14 tasks." };
  }

  const rawIds = rawTasks.map((item, index) => {
    const task = record(item);
    return canonicalTaskId(task?.id, index);
  });
  const originalToCanonical = new Map<string, string>();
  rawTasks.forEach((item, index) => {
    const task = record(item);
    const original = typeof task?.id === "string" ? task.id.trim() : "";
    if (original) originalToCanonical.set(original, rawIds[index]);
    originalToCanonical.set(rawIds[index], rawIds[index]);
  });

  const tasks: IntentTaskSpec[] = [];
  for (let index = 0; index < rawTasks.length; index += 1) {
    const inputTask = record(rawTasks[index]);
    if (!inputTask) return { ok: false, error: `Task ${index + 1} must be an object.` };

    const taskTitle = boundedText(inputTask.title, 3, 120);
    const detail = boundedText(inputTask.detail, 3, 700);
    const validation = boundedText(inputTask.validation, 3, 300);
    if (!taskTitle || !detail || !validation) {
      return { ok: false, error: `Task ${index + 1} is missing a bounded title, detail, or validation rule.` };
    }
    if (!isAgentId(inputTask.agentId)) {
      return { ok: false, error: `Task ${index + 1} names an unknown agent.` };
    }
    if (!isLocationId(inputTask.locationId)) {
      return { ok: false, error: `Task ${index + 1} names an unknown world location.` };
    }
    if (!isActionType(inputTask.actionType)) {
      return { ok: false, error: `Task ${index + 1} names an unsupported action type.` };
    }

    const rawDependencies = Array.isArray(inputTask.dependsOn) ? inputTask.dependsOn : [];
    const dependsOn = rawDependencies
      .map((dependency) => typeof dependency === "string" ? originalToCanonical.get(dependency.trim()) : undefined)
      .filter((dependency): dependency is string => Boolean(dependency));
    if (dependsOn.length !== rawDependencies.length) {
      return { ok: false, error: `Task ${index + 1} refers to an unknown dependency.` };
    }
    if (dependsOn.includes(rawIds[index])) {
      return { ok: false, error: `Task ${index + 1} cannot depend on itself.` };
    }

    const actionType = inputTask.actionType;
    const consequential = CONSEQUENTIAL_ACTIONS.has(actionType);
    const requiresApproval = consequential || inputTask.requiresApproval === true;
    const consequence = boundedText(inputTask.consequence, 1, 400)
      ?? (requiresApproval ? `Allow the simulated ${actionType.replaceAll("_", " ")} action.` : "No external commitment; simulated world state only.");

    tasks.push({
      id: rawIds[index],
      title: taskTitle,
      detail,
      agentId: inputTask.agentId,
      locationId: inputTask.locationId,
      dependsOn: [...new Set(dependsOn)],
      workMs: safeInteger(inputTask.workMs, 900, 12_000, 2_800),
      actionType,
      requiresApproval,
      consequence,
      validation,
    });
  }

  if (hasCycle(tasks)) {
    return { ok: false, error: "Plan dependencies must form an acyclic graph." };
  }
  if (!tasks.some((task) => task.dependsOn.length === 0)) {
    return { ok: false, error: "Plan needs at least one root task." };
  }

  const acceptanceCriteria = stringArray(input.acceptanceCriteria, 8, 240);
  if (acceptanceCriteria.length === 0) {
    acceptanceCriteria.push(`The completed work visibly satisfies: ${outcome}`);
  }

  const rawId = boundedText(input.id, 1, 80);
  const id = rawId
    ? `intent-${rawId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || stableHash(title)}`
    : `intent-${stableHash(`${intent}|${title}|${tasks.map((task) => task.id).join("|")}`)}`;

  return {
    ok: true,
    value: {
      id,
      title,
      summary,
      outcome,
      acceptanceCriteria,
      tasks,
    },
  };
}

export function validatePlannerResult(value: unknown, intent = "User intention"): Validation<PlannerResult> {
  const input = record(value);
  if (!input || typeof input.ready !== "boolean") {
    return { ok: false, error: "Planner result must contain a ready boolean." };
  }

  const assistantMessage = boundedText(input.assistantMessage, 1, 1_000);
  if (!assistantMessage) return { ok: false, error: "Planner result needs a bounded assistant message." };

  if (!input.ready) {
    const questions = stringArray(input.questions, 4, 300);
    if (questions.length === 0) questions.push("What result matters most, and what constraints must the agents preserve?");
    return { ok: true, value: { ready: false, assistantMessage, questions, plan: null } };
  }

  const planValidation = validateIntentPlan(input.plan, intent);
  if (!planValidation.ok) return planValidation;
  return {
    ok: true,
    value: {
      ready: true,
      assistantMessage,
      questions: [],
      plan: planValidation.value,
    },
  };
}

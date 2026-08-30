import {
  ASYMPTA_CITY_ACTION_TYPES,
  ASYMPTA_CITY_AGENT_IDS,
  ASYMPTA_CITY_OPERATIONS,
  ASYMPTA_CITY_WORKFLOW_IDS,
} from "./asympta-public-agent-contract.ts";
import type {
  PublicAgentCityAccess,
  PublicAgentCityAgentStatus,
  PublicAgentCityContext,
  PublicAgentCityPhase,
  PublicAgentCityPlan,
} from "./asympta-public-agent-contract.ts";

export const ASYMPTA_CITY_PLAN_EVENT = "asympta:city-plan" as const;

export type PublicAgentCityPlanEventDetail = {
  requestId: string;
  plan: PublicAgentCityPlan;
};

type JsonRecord = Record<string, unknown>;

const CITY_PHASES: PublicAgentCityPhase[] = ["idle", "running", "waiting_approval", "completed", "blocked"];
const CITY_AGENT_STATUSES: PublicAgentCityAgentStatus[] = ["idle", "moving", "working", "sharing", "waiting", "returning"];
const SENSITIVE_TEXT = /(?:api[_ -]?key|password|credential|authorization|bearer\s+[a-z0-9._-]+|secret|token)/i;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function hasExactKeys(value: JsonRecord, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function boundedPlainText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text || text.length > max || SENSITIVE_TEXT.test(text)) return null;
  return text;
}

function nullablePlainText(value: unknown, max: number): string | null | false {
  if (value === null) return null;
  return boundedPlainText(value, max) ?? false;
}

export function isPublicAgentCityPlan(value: unknown): value is PublicAgentCityPlan {
  const plan = asRecord(value);
  if (!plan || !hasExactKeys(plan, [
    "access", "operation", "targetAgentId", "workflowId", "actionType", "message", "reason",
  ])) return false;

  const access = plan.access as PublicAgentCityAccess;
  const operation = String(plan.operation ?? "");
  const targetAgentId = String(plan.targetAgentId ?? "");
  const workflowId = plan.workflowId === null ? null : String(plan.workflowId ?? "");
  const actionType = plan.actionType === null ? null : String(plan.actionType ?? "");
  const message = nullablePlainText(plan.message, 240);
  const reason = boundedPlainText(plan.reason, 220);

  if (!["READ", "WRITE_REQUEST"].includes(access)
    || !ASYMPTA_CITY_OPERATIONS.includes(operation as (typeof ASYMPTA_CITY_OPERATIONS)[number])
    || !ASYMPTA_CITY_AGENT_IDS.includes(targetAgentId as (typeof ASYMPTA_CITY_AGENT_IDS)[number])
    || (workflowId !== null && !ASYMPTA_CITY_WORKFLOW_IDS.includes(workflowId as (typeof ASYMPTA_CITY_WORKFLOW_IDS)[number]))
    || (actionType !== null && !ASYMPTA_CITY_ACTION_TYPES.includes(actionType as (typeof ASYMPTA_CITY_ACTION_TYPES)[number]))
    || message === false
    || !reason) return false;

  if (access === "READ") {
    return ["observe_city", "inspect_agent"].includes(operation)
      && workflowId === null
      && actionType === null
      && message === null;
  }
  if (operation === "send_simulated_message") {
    return typeof message === "string" && workflowId === null && actionType === null;
  }
  if (operation === "start_simulated_workflow") {
    return workflowId !== null && actionType === null && message === null;
  }
  if (operation === "request_simulated_action") {
    return actionType !== null && workflowId === null && message === null;
  }
  return false;
}

export function buildPublicAgentCityContext(snapshot: unknown): PublicAgentCityContext | null {
  const root = asRecord(snapshot);
  const foreground = root ? asRecord(root.foreground) : null;
  if (!foreground) return null;

  const phase = String(foreground.phase ?? "");
  const workflow = foreground.workflowId === null || foreground.workflowId === undefined
    ? null
    : String(foreground.workflowId);
  const pendingApprovals = Array.isArray(foreground.pendingApprovals) ? foreground.pendingApprovals : [];
  const sourceAgents = Array.isArray(foreground.agents)
    ? foreground.agents.map(asRecord).filter((agent): agent is JsonRecord => agent !== null)
    : [];

  if (!CITY_PHASES.includes(phase as PublicAgentCityPhase)
    || (workflow !== null && !ASYMPTA_CITY_WORKFLOW_IDS.includes(workflow as (typeof ASYMPTA_CITY_WORKFLOW_IDS)[number]))
    || pendingApprovals.length > 64) return null;

  const sourceById = new Map(sourceAgents.map((agent) => [String(agent.id ?? ""), agent]));
  const agents: PublicAgentCityContext["agents"] = [];
  for (const id of ASYMPTA_CITY_AGENT_IDS) {
    const source = sourceById.get(id);
    if (!source) continue;
    const role = boundedPlainText(source.role, 80);
    const status = String(source.status ?? "");
    if (!role || !CITY_AGENT_STATUSES.includes(status as PublicAgentCityAgentStatus)) return null;
    agents.push({ id, role, status: status as PublicAgentCityAgentStatus });
  }

  if (agents.length < 1 || agents.length > 10) return null;
  return {
    phase: phase as PublicAgentCityPhase,
    workflow: workflow as PublicAgentCityContext["workflow"],
    pendingApprovalCount: pendingApprovals.length,
    agents,
  };
}

export function buildPublicAgentCityContextFromWindow(): PublicAgentCityContext | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as Window & { __ASYMPTA_DEMO__?: { snapshot?: () => unknown } }).__ASYMPTA_DEMO__;
  try {
    return buildPublicAgentCityContext(bridge?.snapshot?.());
  } catch {
    return null;
  }
}

export function dispatchPublicAgentCityPlan(
  requestId: string,
  plan: PublicAgentCityPlan | null | undefined,
  signal?: AbortSignal,
) {
  if (typeof window === "undefined" || signal?.aborted || !boundedPlainText(requestId, 128) || !isPublicAgentCityPlan(plan)) {
    return false;
  }
  window.dispatchEvent(new CustomEvent<PublicAgentCityPlanEventDetail>(ASYMPTA_CITY_PLAN_EVENT, {
    detail: { requestId, plan },
  }));
  return true;
}

export function readPublicAgentCityPlanEvent(event: Event): PublicAgentCityPlanEventDetail | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = asRecord(event.detail);
  const requestId = boundedPlainText(detail?.requestId, 128);
  if (!requestId || !isPublicAgentCityPlan(detail?.plan)) return null;
  return { requestId, plan: detail.plan };
}

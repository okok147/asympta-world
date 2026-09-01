import {
  ATLAS_AGENTS,
  ATLAS_LOCATIONS,
  ATLAS_WORKFLOWS,
  type AtlasTaskBlueprint,
  type AtlasWorkflowDefinition,
  type WorkflowId,
} from "./atlas-simulation.ts";
import { assertAsymptaWorkflowContract } from "./asympta-workflow-contract.ts";
import type {
  AsymptaTaskBusinessJourneyProof,
  AsymptaTaskPhase,
  AsymptaTaskState,
} from "./asympta-task-kernel-types.ts";

export const TASK_WORLD_WORKFLOW_ID = "task-intent" as WorkflowId;

export type TaskWorldTaskSnapshot = {
  id: string;
  title: string;
  agentId: string;
  locationId: string;
  status: "queued" | "moving" | "working" | "waiting_approval" | "done" | "blocked";
  progress: number;
  dependencies: string[];
};

export type TaskWorldWorkflowSnapshot = {
  phase: "idle" | "running" | "waiting_approval" | "completed" | "blocked";
  workflowId: string | null;
  workflow: string | null;
  tasks: TaskWorldTaskSnapshot[];
};

type WorkflowCopy = {
  name: string;
  shortName: string;
  summary: (intent: string) => string;
  outcome: (intent: string) => string;
  travel: string;
  travelDetail: (facts: string) => string;
  receive: string;
  receiveDetail: string;
  work: string;
  workDetail: (intent: string, facts: string) => string;
  handoff: string;
  handoffDetail: string;
  returnHome: string;
  returnHomeDetail: string;
  verify: string;
  verifyDetail: string;
  proofMissing: string;
};

const MOVIE_PATTERN = /(?:movie|film|cinema|電影|电影|戲院|戏院|映画|シネマ)/iu;
const ACTIVE_TASK_STATUSES = new Set(["moving", "working", "waiting_approval"]);

const COPY: Record<AsymptaTaskState["rootIntent"]["locale"], WorkflowCopy> = {
  en: {
    name: "Business response journey",
    shortName: "Journey",
    summary: (intent) => `Carry “${intent}” to a simulated business agent, have the business handle it, and bring the response home.`,
    outcome: (intent) => `The personal agent returned with the simulated business response for “${intent}”. No real business was contacted.`,
    travel: "Take the confirmed request to the business",
    travelDetail: (facts) => `The personal agent leaves home and carries the confirmed request to the simulated business: ${facts}.`,
    receive: "Business agent receives the request",
    receiveDetail: "The business coordinator accepts the handoff from the personal agent before any service work starts.",
    work: "Business agent handles the request",
    workDetail: (intent, facts) => `The business coordinator checks simulated service options and prepares a bounded response for “${intent}” using: ${facts}.`,
    handoff: "Business returns the response",
    handoffDetail: "The business coordinator hands the simulated response back to the personal agent with no claim of a real booking or external action.",
    returnHome: "Personal agent brings the response home",
    returnHomeDetail: "The personal agent travels back home carrying the business response before the task can be verified.",
    verify: "Verify the returned business response",
    verifyDetail: "Verify the outbound trip, business receipt, business work, response handoff and return home before completion.",
    proofMissing: "The world stopped without proving the complete business journey, so this task is not finished.",
  },
  "zh-Hant": {
    name: "商業回應旅程",
    shortName: "旅程",
    summary: (intent) => `把「${intent}」帶到模擬商戶，由商業代理處理，再把回應帶回來。`,
    outcome: (intent) => `個人代理已帶回「${intent}」的模擬商業回應；未聯絡任何真實商戶。`,
    travel: "把已確認需求帶到商戶",
    travelDetail: (facts) => `個人代理離開原地，前往模擬商戶並帶上已確認需求：${facts}。`,
    receive: "商業代理接收需求",
    receiveDetail: "商業協調代理先接收個人代理的交接，才可開始服務工作。",
    work: "商業代理處理需求",
    workDetail: (intent, facts) => `商業協調代理使用以下資料檢查模擬服務選項，並為「${intent}」準備有界回應：${facts}。`,
    handoff: "商戶交回處理結果",
    handoffDetail: "商業協調代理把模擬回應交回個人代理；不宣稱已真實訂位、購票或執行外部操作。",
    returnHome: "個人代理帶結果返回",
    returnHomeDetail: "個人代理帶着商業回應返回原地，之後才可進行完成驗證。",
    verify: "驗證帶回的商業回應",
    verifyDetail: "完成前驗證出發、商戶接收、商業處理、回應交接及返回原地全部成立。",
    proofMissing: "世界工作流未能證明完整商業旅程，因此此任務尚未完成。",
  },
  ja: {
    name: "ビジネス応答の往復",
    shortName: "往復",
    summary: (intent) => `「${intent}」をシミュレーション上の事業者へ届け、ビジネス・エージェントが処理した応答を持ち帰ります。`,
    outcome: (intent) => `パーソナル・エージェントが「${intent}」のシミュレーション応答を持ち帰りました。実在の事業者には連絡していません。`,
    travel: "確認済み依頼を事業者へ届ける",
    travelDetail: (facts) => `パーソナル・エージェントが出発し、確認済み依頼をシミュレーション事業者へ運びます：${facts}。`,
    receive: "ビジネス・エージェントが依頼を受領",
    receiveDetail: "ビジネス・コーディネーターは、サービス作業を始める前にパーソナル・エージェントから依頼を受領します。",
    work: "ビジネス・エージェントが依頼を処理",
    workDetail: (intent, facts) => `ビジネス・コーディネーターがシミュレーション上のサービス候補を確認し、「${intent}」への限定された応答を作成します：${facts}。`,
    handoff: "事業者が応答を返す",
    handoffDetail: "ビジネス・コーディネーターが応答をパーソナル・エージェントへ返します。実予約や外部操作は主張しません。",
    returnHome: "パーソナル・エージェントが応答を持ち帰る",
    returnHomeDetail: "パーソナル・エージェントが事業者の応答を持って戻った後にのみ、完了を検証できます。",
    verify: "持ち帰ったビジネス応答を検証",
    verifyDetail: "出発、事業者の受領と処理、応答の受け渡し、帰着をすべて確認してから完了します。",
    proofMissing: "完全なビジネス往復を証明できなかったため、このタスクは未完了です。",
  },
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function taskWorldWorkflowRunId(task: Pick<AsymptaTaskState, "taskId">) {
  return `task-world:${stableHash(task.taskId)}`;
}

export function taskWorldTaskPrefix(task: Pick<AsymptaTaskState, "taskId">) {
  return `tw-${stableHash(task.taskId)}`;
}

function confirmedFacts(task: AsymptaTaskState) {
  const facts = task.requirements
    .filter((requirement) => requirement.status !== "unknown")
    .map((requirement) => requirement.sensitive
      ? `${requirement.label}: confirmed privately`
      : `${requirement.label}: ${requirement.displayValue ?? String(requirement.value ?? "confirmed")}`);
  return facts.join(" · ") || "no additional facts required";
}

function confirmedFactValues(task: AsymptaTaskState) {
  return task.requirements
    .filter((requirement) => requirement.status !== "unknown")
    .map((requirement) => ({
      id: requirement.id,
      key: requirement.key,
      label: requirement.label,
      value: requirement.sensitive
        ? "confirmed privately"
        : requirement.displayValue ?? String(requirement.value ?? "confirmed"),
    }));
}

function task(
  id: string,
  title: string,
  detail: string,
  agentId: string,
  locationId: string,
  dependsOn: string[],
  workMs: number,
): AtlasTaskBlueprint {
  return { id, title, detail, agentId, locationId, dependsOn, workMs };
}

export function taskUsesVisibleWorldWorkflow(task: AsymptaTaskState) {
  return task.mode === "simulated"
    && !task.completion.requiresApproval
    && !task.completion.requiresReceipt
    && !["completed", "cancelled"].includes(task.phase)
    && task.worldWorkflow?.status !== "blocked"
    && task.requirements.every((requirement) => requirement.status !== "unknown");
}

export function taskWorldBusinessJourneyTaskIds(taskState: Pick<AsymptaTaskState, "taskId">) {
  const prefix = taskWorldTaskPrefix(taskState);
  return {
    travelBusiness: `${prefix}-travel-business`,
    businessReceive: `${prefix}-business-receive`,
    businessWork: `${prefix}-business-work`,
    businessHandoff: `${prefix}-business-handoff`,
    returnHome: `${prefix}-return-home`,
    verify: `${prefix}-verify`,
  } as const;
}

export function emptyTaskWorldBusinessJourneyProof(): AsymptaTaskBusinessJourneyProof {
  return {
    requesterReachedBusiness: false,
    businessReceivedRequest: false,
    businessWorkCompleted: false,
    businessResponseHandedOff: false,
    requesterReturnedHome: false,
    returnedOutcomeVerified: false,
    complete: false,
  };
}

export function buildTaskWorldWorkflow(taskState: AsymptaTaskState): AtlasWorkflowDefinition {
  const copy = COPY[taskState.rootIntent.locale];
  const intent = taskState.rootIntent.raw;
  const facts = confirmedFacts(taskState);
  const movie = MOVIE_PATTERN.test(intent);
  const ids = taskWorldBusinessJourneyTaskIds(taskState);
  const workTitle = movie
    ? taskState.rootIntent.locale === "zh-Hant"
      ? "商業代理準備觀影方案"
      : taskState.rootIntent.locale === "ja"
        ? "ビジネス・エージェントが映画プランを作成"
        : "Business agent prepares the movie plan"
    : copy.work;

  const workflow: AtlasWorkflowDefinition = {
    id: TASK_WORLD_WORKFLOW_ID,
    name: movie
      ? taskState.rootIntent.locale === "zh-Hant"
        ? "觀影代理工作流"
        : taskState.rootIntent.locale === "ja"
          ? "映画視聴エージェント・ワークフロー"
          : "Movie agent workflow"
      : copy.name,
    shortName: copy.shortName,
    summary: copy.summary(intent),
    outcome: copy.outcome(intent),
    tasks: [
      task(ids.travelBusiness, copy.travel, copy.travelDetail(facts), "agent-user", "marunouchi", [], 900),
      task(ids.businessReceive, copy.receive, copy.receiveDetail, "agent-business", "marunouchi", [ids.travelBusiness], 760),
      task(ids.businessWork, workTitle, copy.workDetail(intent, facts), "agent-business", "marunouchi", [ids.businessReceive], 1_200),
      task(ids.businessHandoff, copy.handoff, copy.handoffDetail, "agent-business", "marunouchi", [ids.businessWork], 780),
      task(ids.returnHome, copy.returnHome, copy.returnHomeDetail, "agent-user", "shibuya", [ids.businessHandoff], 920),
      task(ids.verify, copy.verify, copy.verifyDetail, "agent-quality", "shibuya", [ids.returnHome], 820),
    ],
  };

  return assertAsymptaWorkflowContract(workflow, {
    agentIds: ATLAS_AGENTS.map((agent) => agent.id),
    locationIds: Object.keys(ATLAS_LOCATIONS),
  });
}

export function upsertTaskWorldWorkflow(taskState: AsymptaTaskState) {
  const workflow = buildTaskWorldWorkflow(taskState);
  const existing = ATLAS_WORKFLOWS.findIndex((candidate) => candidate.id === TASK_WORLD_WORKFLOW_ID);
  if (existing >= 0) ATLAS_WORKFLOWS.splice(existing, 1, workflow);
  else ATLAS_WORKFLOWS.push(workflow);
  return workflow;
}

function taskStatus(value: unknown): TaskWorldTaskSnapshot["status"] | null {
  return ["queued", "moving", "working", "waiting_approval", "done", "blocked"].includes(String(value))
    ? value as TaskWorldTaskSnapshot["status"]
    : null;
}

export function normalizeTaskWorldWorkflowSnapshot(value: unknown): TaskWorldWorkflowSnapshot | null {
  const root = record(value);
  const foreground = record(root?.foreground) ?? root;
  if (!foreground || !Array.isArray(foreground.tasks)) return null;
  const phase = String(foreground.phase ?? "");
  if (!["idle", "running", "waiting_approval", "completed", "blocked"].includes(phase)) return null;
  const tasks = foreground.tasks.flatMap((candidate) => {
    const item = record(candidate);
    const status = taskStatus(item?.status);
    if (!item
      || typeof item.id !== "string"
      || typeof item.title !== "string"
      || typeof item.agentId !== "string"
      || typeof item.locationId !== "string"
      || typeof item.progress !== "number"
      || !Array.isArray(item.dependencies)
      || !item.dependencies.every((dependency) => typeof dependency === "string")
      || !status) return [];
    return [{
      id: item.id,
      title: item.title,
      agentId: item.agentId,
      locationId: item.locationId,
      status,
      progress: Math.max(0, Math.min(1, item.progress)),
      dependencies: [...item.dependencies] as string[],
    } satisfies TaskWorldTaskSnapshot];
  });
  return {
    phase: phase as TaskWorldWorkflowSnapshot["phase"],
    workflowId: typeof foreground.workflowId === "string" ? foreground.workflowId : null,
    workflow: typeof foreground.workflow === "string" ? foreground.workflow : null,
    tasks,
  };
}

export function taskWorldSnapshotBelongsToTask(snapshot: TaskWorldWorkflowSnapshot, taskState: AsymptaTaskState) {
  const prefix = `${taskWorldTaskPrefix(taskState)}-`;
  return snapshot.workflowId === String(TASK_WORLD_WORKFLOW_ID)
    && snapshot.tasks.length > 0
    && snapshot.tasks.every((taskState) => taskState.id.startsWith(prefix));
}

export function activeTaskWorldTask(snapshot: TaskWorldWorkflowSnapshot) {
  return snapshot.tasks.find((taskState) => ACTIVE_TASK_STATUSES.has(taskState.status)) ?? null;
}

export function taskWorldProgressPhase(snapshot: TaskWorldWorkflowSnapshot): AsymptaTaskPhase {
  const active = activeTaskWorldTask(snapshot);
  if (!active) return snapshot.phase === "completed" ? "verifying" : "coordinating";
  if (active.id.endsWith("-business-work")) return "discovering";
  if (active.id.endsWith("-verify")) return "verifying";
  return "executing";
}

function completedMilestone(
  snapshot: TaskWorldWorkflowSnapshot,
  id: string,
  agentId: string,
  locationId: string,
  dependencies: string[],
) {
  const taskState = snapshot.tasks.find((candidate) => candidate.id === id);
  return Boolean(taskState
    && taskState.agentId === agentId
    && taskState.locationId === locationId
    && taskState.status === "done"
    && taskState.progress === 1
    && taskState.dependencies.length === dependencies.length
    && dependencies.every((dependency) => taskState.dependencies.includes(dependency)));
}

export function taskWorldBusinessJourneyProof(
  snapshot: TaskWorldWorkflowSnapshot,
  taskState: Pick<AsymptaTaskState, "taskId">,
): AsymptaTaskBusinessJourneyProof {
  const ids = taskWorldBusinessJourneyTaskIds(taskState);
  const requesterReachedBusiness = completedMilestone(
    snapshot,
    ids.travelBusiness,
    "agent-user",
    "marunouchi",
    [],
  );
  const businessReceivedRequest = requesterReachedBusiness && completedMilestone(
    snapshot,
    ids.businessReceive,
    "agent-business",
    "marunouchi",
    [ids.travelBusiness],
  );
  const businessWorkCompleted = businessReceivedRequest && completedMilestone(
    snapshot,
    ids.businessWork,
    "agent-business",
    "marunouchi",
    [ids.businessReceive],
  );
  const businessResponseHandedOff = businessWorkCompleted && completedMilestone(
    snapshot,
    ids.businessHandoff,
    "agent-business",
    "marunouchi",
    [ids.businessWork],
  );
  const requesterReturnedHome = businessResponseHandedOff && completedMilestone(
    snapshot,
    ids.returnHome,
    "agent-user",
    "shibuya",
    [ids.businessHandoff],
  );
  const returnedOutcomeVerified = requesterReturnedHome && completedMilestone(
    snapshot,
    ids.verify,
    "agent-quality",
    "shibuya",
    [ids.returnHome],
  );
  return {
    requesterReachedBusiness,
    businessReceivedRequest,
    businessWorkCompleted,
    businessResponseHandedOff,
    requesterReturnedHome,
    returnedOutcomeVerified,
    complete: returnedOutcomeVerified,
  };
}

export function taskWorldProofMissingSummary(taskState: AsymptaTaskState) {
  return COPY[taskState.rootIntent.locale].proofMissing;
}

export function taskWorldCompletionSummary(taskState: AsymptaTaskState) {
  const facts = confirmedFacts(taskState);
  if (taskState.rootIntent.locale === "zh-Hant") {
    return `個人代理已從模擬商戶帶回「${taskState.title}」的處理結果（${facts}）。未聯絡真實商戶，亦未訂票或執行其他外部操作。`;
  }
  if (taskState.rootIntent.locale === "ja") {
    return `パーソナル・エージェントがシミュレーション事業者から「${taskState.title}」の処理結果を持ち帰りました（${facts}）。実在の事業者への連絡、予約、外部操作は行っていません。`;
  }
  return `The personal agent returned from the simulated business with a handled response for “${taskState.title}” (${facts}). No real business was contacted, no booking was made, and no external action occurred.`;
}

export function taskWorldVerificationDetails(taskState: AsymptaTaskState) {
  if (taskState.rootIntent.locale === "zh-Hant") {
    return "Atlas 已驗證個人代理抵達商戶、商業代理接收並處理需求、回應交接、個人代理返回原地，以及品質代理驗證帶回結果。所有行為均為模擬。";
  }
  if (taskState.rootIntent.locale === "ja") {
    return "Atlas は、事業者への到着、ビジネス・エージェントの受領と処理、応答の受け渡し、帰着、持ち帰った結果の品質確認を検証しました。すべてシミュレーションです。";
  }
  return "Atlas verified arrival at the business, business receipt and work, response handoff, return home, and quality verification of the returned response. Every action was simulated.";
}

export function taskWorldBusinessResult(taskState: AsymptaTaskState) {
  return {
    kind: MOVIE_PATTERN.test(taskState.rootIntent.raw) ? "simulated_movie_plan" : "simulated_business_response",
    intent: taskState.rootIntent.raw,
    confirmedFacts: confirmedFactValues(taskState),
    businessAgentId: "agent-business",
    businessLocationId: "marunouchi",
    requesterAgentId: "agent-user",
    returnLocationId: "shibuya",
    simulated: true,
    realWorldSideEffect: false,
  };
}

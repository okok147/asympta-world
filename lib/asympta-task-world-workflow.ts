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
  AsymptaTaskPhase,
  AsymptaTaskState,
} from "./asympta-task-kernel-types.ts";

export const TASK_WORLD_WORKFLOW_ID = "task-intent" as WorkflowId;

export type TaskWorldTaskSnapshot = {
  id: string;
  title: string;
  agentId: string;
  status: "queued" | "moving" | "working" | "waiting_approval" | "done" | "blocked";
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
  interpret: string;
  interpretDetail: (facts: string) => string;
  discover: string;
  discoverDetail: (intent: string, facts: string) => string;
  coordinate: string;
  coordinateDetail: string;
  verify: string;
  verifyDetail: string;
};

const MOVIE_PATTERN = /(?:movie|film|cinema|電影|电影|戲院|戏院|映画|シネマ)/iu;
const ACTIVE_TASK_STATUSES = new Set(["moving", "working", "waiting_approval"]);

const COPY: Record<AsymptaTaskState["rootIntent"]["locale"], WorkflowCopy> = {
  en: {
    name: "Requested task workflow",
    shortName: "Task",
    summary: (intent) => `Continue “${intent}” with the confirmed options through visible agent coordination and verification.`,
    outcome: (intent) => `The agents completed and verified the simulated workflow for “${intent}”.`,
    interpret: "Confirm the requested outcome",
    interpretDetail: (facts) => `Bind the original intention to the confirmed requirements without asking for them again: ${facts}.`,
    discover: "Discover matching options",
    discoverDetail: (intent, facts) => `Find a bounded simulated route for “${intent}” using only these confirmed facts: ${facts}.`,
    coordinate: "Coordinate the selected option",
    coordinateDetail: "Turn the selected option into a visible, ordered handoff between the responsible agents.",
    verify: "Verify the workflow result",
    verifyDetail: "Check that every required fact was preserved and every visible workflow task reached done before completion.",
  },
  "zh-Hant": {
    name: "使用者任務工作流",
    shortName: "任務",
    summary: (intent) => `使用已確認的選項，透過可見的代理協作及驗證繼續「${intent}」。`,
    outcome: (intent) => `代理已完成並驗證「${intent}」的模擬工作流。`,
    interpret: "確認要求的成果",
    interpretDetail: (facts) => `把原始意圖與已確認需求綁定，不再重複詢問：${facts}。`,
    discover: "尋找相符選項",
    discoverDetail: (intent, facts) => `只使用以下已確認資料，為「${intent}」尋找有界的模擬路徑：${facts}。`,
    coordinate: "協調已選選項",
    coordinateDetail: "把已選選項轉成負責代理之間可見、具次序的交接。",
    verify: "驗證工作流結果",
    verifyDetail: "完成前，確認所有必要資料均獲保留，且每項可見工作流任務都已完成。",
  },
  ja: {
    name: "ユーザータスク・ワークフロー",
    shortName: "タスク",
    summary: (intent) => `確認済みの選択肢を使い、見えるエージェント連携と検証を通して「${intent}」を続行します。`,
    outcome: (intent) => `エージェントが「${intent}」のシミュレーション・ワークフローを完了し、検証しました。`,
    interpret: "依頼結果を確認",
    interpretDetail: (facts) => `元の意図を確認済み要件に結び付け、同じ質問を繰り返しません：${facts}。`,
    discover: "一致する選択肢を探索",
    discoverDetail: (intent, facts) => `確認済み情報だけを使い、「${intent}」のための限定されたシミュレーション経路を探します：${facts}。`,
    coordinate: "選択肢を調整",
    coordinateDetail: "選択した内容を、担当エージェント間の見える順序付きハンドオフに変換します。",
    verify: "ワークフロー結果を検証",
    verifyDetail: "完了前に、必須情報が保持され、見える全タスクが完了したことを確認します。",
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
    && task.requirements.every((requirement) => requirement.status !== "unknown");
}

export function buildTaskWorldWorkflow(taskState: AsymptaTaskState): AtlasWorkflowDefinition {
  const copy = COPY[taskState.rootIntent.locale];
  const intent = taskState.rootIntent.raw;
  const facts = confirmedFacts(taskState);
  const prefix = taskWorldTaskPrefix(taskState);
  const movie = MOVIE_PATTERN.test(intent);
  const interpretId = `${prefix}-interpret`;
  const discoverId = `${prefix}-discover`;
  const coordinateId = `${prefix}-coordinate`;
  const verifyId = `${prefix}-verify`;
  const discoverTitle = movie
    ? taskState.rootIntent.locale === "zh-Hant"
      ? "尋找相符電影選項"
      : taskState.rootIntent.locale === "ja"
        ? "一致する映画候補を探索"
        : "Discover matching movie options"
    : copy.discover;
  const coordinateTitle = movie
    ? taskState.rootIntent.locale === "zh-Hant"
      ? "協調觀影流程"
      : taskState.rootIntent.locale === "ja"
        ? "視聴フローを調整"
        : "Coordinate the viewing workflow"
    : copy.coordinate;

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
      task(interpretId, copy.interpret, copy.interpretDetail(facts), "agent-user", "shibuya", [], 760),
      task(discoverId, discoverTitle, copy.discoverDetail(intent, facts), "agent-market", "ueno", [interpretId], 1_050),
      task(coordinateId, coordinateTitle, copy.coordinateDetail, "agent-operations", "shinagawa", [discoverId], 940),
      task(verifyId, copy.verify, copy.verifyDetail, "agent-quality", "nihonbashi", [coordinateId], 820),
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
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.agentId !== "string" || !status) return [];
    return [{ id: item.id, title: item.title, agentId: item.agentId, status } satisfies TaskWorldTaskSnapshot];
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
  if (active.id.endsWith("-interpret")) return "planning";
  if (active.id.endsWith("-discover")) return "discovering";
  if (active.id.endsWith("-verify")) return "verifying";
  return "executing";
}

export function taskWorldCompletionSummary(taskState: AsymptaTaskState) {
  if (taskState.rootIntent.locale === "zh-Hant") {
    return `代理工作流已使用已確認的選項完成並驗證「${taskState.title}」。`;
  }
  if (taskState.rootIntent.locale === "ja") {
    return `エージェント・ワークフローは確認済みの選択肢を使い、「${taskState.title}」を完了して検証しました。`;
  }
  return `The agent workflow completed and verified “${taskState.title}” using the confirmed options.`;
}

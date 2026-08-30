import { intentWorldSnapshot } from "@/lib/intent-world/engine";
import { buildDeterministicIntentPlan } from "@/lib/intent-world/fallback";
import { validatePlannerResult } from "@/lib/intent-world/validation";
import type {
  IntentConversationMessage,
  IntentPlannerResponse,
  IntentWorldSnapshot,
  IntentWorldState,
  StakeholderSide,
} from "@/lib/intent-world/types";
import type { AsymptaLocale } from "@/lib/asympta-user-preferences";

export const MODEL = "openai/gpt-oss-120b:free";
export const TICK_MS = 80;
export const API_TIMEOUT_MS = 36_000;

export type Locale = AsymptaLocale;
export type ChatMessage = IntentConversationMessage & { id: string };
export type PlannerState = "idle" | "planning" | "ready" | "fallback";

export type ModelContextTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

export type ModelContext = {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): unknown;
};

export type IntentBridge = {
  snapshot: () => IntentWorldSnapshot;
  renderToText: () => string;
  submitIntent: (body: string) => Promise<IntentWorldSnapshot>;
  approve: (approvalId: string, approved: boolean) => IntentWorldSnapshot;
};

export type LegacyDemoBridge = {
  snapshot: () => unknown;
  advance: (milliseconds: number) => unknown;
  approve: (approvalId: string, approved: boolean) => unknown;
};

export type Copy = {
  product: string;
  subtitle: string;
  modelFree: string;
  validatedState: string;
  pause: string;
  resume: string;
  reset: string;
  language: string;
  phase: Record<IntentWorldState["phase"], string>;
  status: Record<string, string>;
  commandTitle: string;
  welcome: string;
  placeholder: string;
  send: string;
  planning: string;
  questions: string;
  tasks: string;
  noPlan: string;
  noPlanBody: string;
  acceptance: string;
  activity: string;
  selectedAgent: string;
  standingBy: string;
  approval: string;
  approvalDetail: string;
  allow: string;
  decline: string;
  simulationOnly: string;
  providerOpenRouter: string;
  providerFallback: string;
  modelUnavailable: string;
  taskComplete: string;
  taskWaiting: string;
  taskWorking: string;
  taskMoving: string;
  taskQueued: string;
  taskBlocked: string;
  inspect: string;
  progress: string;
  enterHint: string;
  stateSafe: string;
  currentTask: string;
  outcome: string;
};

export const COPY: Record<Locale, Copy> = {
  en: {
    product: "Asympta World",
    subtitle: "Intention becomes validated coordinated work",
    modelFree: "GPT-OSS 120B · free-only",
    validatedState: "Validated state",
    pause: "Pause world",
    resume: "Resume world",
    reset: "New intention",
    language: "Language",
    phase: { idle: "Ready", running: "Coordinating", waiting_approval: "Waiting for you", blocked: "Stopped safely", completed: "Completed" },
    status: { idle: "standing by", moving: "moving", working: "working", waiting: "waiting", sharing: "handing off" },
    commandTitle: "What should the world take care of?",
    welcome: "Describe the outcome in ordinary language. The agents will clarify only what matters, build a task graph, execute it in the simulation, and validate every transition.",
    placeholder: "For example: find a viable way to complete this outcome, coordinate the parties, and show me what needs approval…",
    send: "Send intention",
    planning: "GPT-OSS is turning your intention into a bounded plan…",
    questions: "Needed before execution",
    tasks: "Execution plan",
    noPlan: "The world is listening",
    noPlanBody: "There are no preset workflows. A fresh plan is created from each conversation.",
    acceptance: "Acceptance criteria",
    activity: "Audit trail",
    selectedAgent: "Selected agent",
    standingBy: "Standing by for an intention",
    approval: "Human approval required",
    approvalDetail: "This simulated action has a consequence and cannot continue from model output alone.",
    allow: "Allow simulated action",
    decline: "Decline",
    simulationOnly: "Simulation only — no real order, payment, message, booking, or shipment occurs without a confirmed live connector.",
    providerOpenRouter: "Planned by OpenRouter",
    providerFallback: "Validated local fallback",
    modelUnavailable: "The free model was unavailable; execution remains functional with a clearly labelled local plan.",
    taskComplete: "complete",
    taskWaiting: "approval",
    taskWorking: "working",
    taskMoving: "moving",
    taskQueued: "queued",
    taskBlocked: "blocked",
    inspect: "Inspect",
    progress: "Total progress",
    enterHint: "Enter to send · Shift+Enter for a new line",
    stateSafe: "Every mutation passed the world invariant validator",
    currentTask: "Current task",
    outcome: "Target outcome",
  },
  "zh-Hant": {
    product: "Asympta World",
    subtitle: "把意圖轉化成經驗證的協作執行",
    modelFree: "GPT-OSS 120B · 只用免費模型",
    validatedState: "已驗證狀態",
    pause: "暫停世界",
    resume: "繼續世界",
    reset: "新意圖",
    language: "語言",
    phase: { idle: "就緒", running: "協作中", waiting_approval: "等候你確認", blocked: "已安全停止", completed: "已完成" },
    status: { idle: "待命", moving: "移動中", working: "工作中", waiting: "等候中", sharing: "交接中" },
    commandTitle: "你想讓這個世界處理甚麼？",
    welcome: "直接用日常語言描述成果。代理只會澄清真正重要的資訊，然後建立任務圖、在模擬世界執行，並驗證每次狀態轉移。",
    placeholder: "例如：找出完成這個成果的可行方法，協調所有相關方，並清楚顯示哪些動作需要我批准……",
    send: "送出意圖",
    planning: "GPT-OSS 正把你的意圖轉成有界而可驗證的計劃……",
    questions: "執行前仍需要",
    tasks: "執行計劃",
    noPlan: "世界正在聆聽",
    noPlanBody: "沒有預設工作流；每次對話都會建立一個全新的動態計劃。",
    acceptance: "驗收條件",
    activity: "稽核紀錄",
    selectedAgent: "已選代理",
    standingBy: "正在等待你的意圖",
    approval: "需要人工批准",
    approvalDetail: "這個模擬動作具有後果，不能只因模型輸出便繼續。",
    allow: "允許模擬動作",
    decline: "拒絕",
    simulationOnly: "只屬模擬——除非有已確認的 live connector，否則不會真的下單、付款、發訊息、預約或出貨。",
    providerOpenRouter: "由 OpenRouter 規劃",
    providerFallback: "已驗證本地 fallback",
    modelUnavailable: "免費模型暫時不可用；系統已清楚標示並使用本地動態計劃繼續運作。",
    taskComplete: "完成",
    taskWaiting: "待批准",
    taskWorking: "工作中",
    taskMoving: "移動中",
    taskQueued: "排隊中",
    taskBlocked: "已暫停",
    inspect: "檢視",
    progress: "總進度",
    enterHint: "Enter 送出 · Shift+Enter 換行",
    stateSafe: "每次變更均已通過世界狀態 invariant validator",
    currentTask: "目前任務",
    outcome: "目標成果",
  },
  ja: {
    product: "Asympta World",
    subtitle: "意図を検証済みの協調作業へ",
    modelFree: "GPT-OSS 120B · 無料モデルのみ",
    validatedState: "検証済み状態",
    pause: "世界を一時停止",
    resume: "世界を再開",
    reset: "新しい意図",
    language: "言語",
    phase: { idle: "準備完了", running: "連携中", waiting_approval: "確認待ち", blocked: "安全に停止", completed: "完了" },
    status: { idle: "待機中", moving: "移動中", working: "作業中", waiting: "確認待ち", sharing: "引き継ぎ中" },
    commandTitle: "この世界に何を任せますか？",
    welcome: "普通の言葉で望む結果を説明してください。必要な点だけ確認し、タスクグラフを作り、シミュレーション内で実行し、すべての状態遷移を検証します。",
    placeholder: "例：この結果を達成する実行可能な方法を探し、関係者を調整し、承認が必要な箇所を示して…",
    send: "意図を送信",
    planning: "GPT-OSS が意図を限定された検証可能な計画に変換しています…",
    questions: "実行前に必要",
    tasks: "実行計画",
    noPlan: "世界が聞いています",
    noPlanBody: "プリセットのワークフローはありません。会話ごとに新しい動的計画を作ります。",
    acceptance: "受入基準",
    activity: "監査ログ",
    selectedAgent: "選択中のエージェント",
    standingBy: "意図を待っています",
    approval: "人の承認が必要",
    approvalDetail: "このシミュレーション操作には影響があり、モデル出力だけでは続行できません。",
    allow: "模擬操作を許可",
    decline: "拒否",
    simulationOnly: "シミュレーションのみ。確認済みのライブ接続がない限り、実際の注文・支払い・送信・予約・出荷は行いません。",
    providerOpenRouter: "OpenRouter が計画",
    providerFallback: "検証済みローカル fallback",
    modelUnavailable: "無料モデルが一時利用できないため、明示したローカル動的計画で安全に継続しています。",
    taskComplete: "完了",
    taskWaiting: "承認待ち",
    taskWorking: "作業中",
    taskMoving: "移動中",
    taskQueued: "待機",
    taskBlocked: "停止",
    inspect: "確認",
    progress: "全体進捗",
    enterHint: "Enter で送信 · Shift+Enter で改行",
    stateSafe: "すべての変更が世界状態 invariant validator を通過",
    currentTask: "現在のタスク",
    outcome: "目標結果",
  },
};

export const AMBIENT_ACTORS: Array<{ id: string; side: StakeholderSide; x: number; y: number; delay: number }> = [
  { id: "ambient-fox", side: "business", x: 33, y: 52, delay: 0.2 },
  { id: "ambient-bird", side: "market", x: 57, y: 25, delay: 1.1 },
  { id: "ambient-dog", side: "logistics", x: 84, y: 58, delay: 1.8 },
  { id: "ambient-rabbit", side: "customer", x: 12, y: 42, delay: 2.4 },
];

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function plannerEndpoint() {
  const configured = process.env.NEXT_PUBLIC_ASYMPTA_AGENT_API_URL?.trim();
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.hostname.endsWith("github.io")) {
    return "https://asympta-world.oklauuuuu.chatgpt.site/api/asympta/plan";
  }
  return "/api/asympta/plan";
}

export function combinedIntent(messages: readonly ChatMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content.trim()).filter(Boolean);
  const joined = userMessages.join("\n");
  if (joined.length <= 1_200) return joined;
  const first = userMessages[0]?.slice(0, 500) ?? "";
  const latest = userMessages.at(-1)?.slice(-650) ?? "";
  return `${first}\nLatest clarification: ${latest}`.slice(0, 1_200);
}

export function parsePlannerResponse(value: unknown, intent: string): IntentPlannerResponse | null {
  const input = record(value);
  if (input?.ok !== true) return null;
  const resultValidation = validatePlannerResult(input.result, intent);
  if (!resultValidation.ok) return null;
  const provenanceInput = record(input.provenance);
  const provider = provenanceInput?.provider;
  const model = typeof provenanceInput?.model === "string" ? provenanceInput.model : MODEL;
  const fallbackReason = typeof provenanceInput?.fallbackReason === "string" ? provenanceInput.fallbackReason.slice(0, 300) : null;
  if (provider !== "openrouter" && provider !== "deterministic-fallback") return null;
  return {
    ok: true,
    result: resultValidation.value,
    provenance: { provider, model, fallbackReason },
  };
}

export function fallbackPlannerResponse(intent: string, reason: string): IntentPlannerResponse {
  return {
    ok: true,
    result: buildDeterministicIntentPlan(intent),
    provenance: {
      provider: "deterministic-fallback",
      model: MODEL,
      fallbackReason: reason.slice(0, 300),
    },
  };
}

export function taskStatus(copy: Copy, status: string) {
  if (status === "completed") return copy.taskComplete;
  if (status === "awaiting_approval") return copy.taskWaiting;
  if (status === "working") return copy.taskWorking;
  if (status === "moving") return copy.taskMoving;
  if (status === "blocked") return copy.taskBlocked;
  return copy.taskQueued;
}

export function compatibilitySnapshot(world: IntentWorldState) {
  const snapshot = intentWorldSnapshot(world);
  return {
    foreground: {
      phase: snapshot.phase,
      workflow: snapshot.plan?.id ?? null,
      runtime: { revision: snapshot.revision, provider: snapshot.provenance },
      tasks: world.tasks.map((task) => ({ ...task })),
      agents: world.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        organisation: agent.organisation,
        side: agent.side,
        status: agent.status,
        taskId: agent.taskId,
        lon: agent.position.x,
        lat: agent.position.y,
      })),
      pendingApprovals: snapshot.pendingApprovals,
      messages: snapshot.messages.map((message) => ({
        from: message.fromAgentId,
        to: message.toAgentId,
        text: message.text,
      })),
      events: snapshot.events,
    },
  };
}

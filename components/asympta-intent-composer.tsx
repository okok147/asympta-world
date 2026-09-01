"use client";

import { ArrowUp, Check, ExternalLink, Globe2, Home, LoaderCircle, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { AnimalPortrait } from "@/components/asympta-animal-art";
import {
  appendAsymptaEvent,
  createAsymptaActivity,
  type AsymptaActivity,
  type AsymptaActivityEvent,
  type AsymptaActivityStatus,
} from "@/lib/asympta-activity";
import { readBrowserProtocolConfig, storeBrowserProtocolConfig } from "@/lib/asympta-browser-protocols";
import { ASYMPTA_TASK_KERNEL_EVENT } from "@/lib/asympta-browser-task-kernel";
import {
  beginInformationJourney,
  EMPTY_INFORMATION_JOURNEY,
  failInformationJourney,
  finishInformationJourney,
  gatherInformationJourney,
  returnInformationJourney,
  type InformationJourneyDestination,
  type InformationJourneyState,
} from "@/lib/asympta-information-journey";
import {
  publishAsymptaCurrentRequest,
  type AsymptaCurrentRequest,
} from "@/lib/asympta-current-request";
import { runAsymptaIntent, type AsymptaProtocolConfig } from "@/lib/asympta-protocol-runtime";
import {
  getOrCreatePublicAgentClientId,
  getPublicAgentConfig,
  isSafePublicAgentSourceUrl,
  PublicAgentClientError,
  requestTurnstileToken,
  runPublicAgentIntent,
} from "@/lib/asympta-public-agent-client";
import type { PublicAgentSuccessResponse } from "@/lib/asympta-public-agent-contract";
import type { AsymptaTaskKernelEventDetail, AsymptaTaskState } from "@/lib/asympta-task-kernel-types";
import {
  subscribeBrowserWebMcpRequests,
  updateBrowserWebMcpRequest,
  type AsymptaWebMcpRequest,
} from "@/lib/asympta-webmcp-request-state";

type Locale = "en" | "zh-Hant" | "ja";

type ProtocolBridge = {
  config: () => AsymptaProtocolConfig;
  configure: (config: AsymptaProtocolConfig, options?: { persist?: boolean }) => AsymptaProtocolConfig;
  runIntent: (intention: string) => Promise<AsymptaActivity>;
  lastActivity: () => AsymptaActivity | null;
};

type RequestContext = {
  source: "human" | "webmcp";
  requestId?: string;
};

declare global {
  interface Window {
    __ASYMPTA_PROTOCOLS__?: ProtocolBridge;
  }
}

const COPY: Record<Locale, {
  placeholder: string;
  send: string;
  idle: string;
  interpreting: string;
  discovering: string;
  coordinating: string;
  waiting_input: string;
  executing: string;
  verifying: string;
  completed: string;
  blocked: string;
  failed: string;
  result: string;
  validatedGoal: string;
  checked: string;
  sources: string;
  pendingConfirmation: string;
  consequence: string;
  nothingExecuted: string;
  simulated: string;
  retry: string;
  verification: string;
}> = {
  en: {
    placeholder: "Tell Asympta what you want to happen…",
    send: "Send intention",
    idle: "What would you like to happen?",
    interpreting: "Understanding what you need…",
    discovering: "Finding who can help…",
    coordinating: "Talking with the right people and agents…",
    waiting_input: "I need one small detail from you.",
    executing: "Making it happen…",
    verifying: "Checking that it really happened…",
    completed: "Done.",
    blocked: "There is not a connected service for this yet.",
    failed: "I could not finish this one yet.",
    result: "Asympta result",
    validatedGoal: "Validated goal",
    checked: "Checked",
    sources: "Sources",
    pendingConfirmation: "Waiting for your confirmation",
    consequence: "Consequence",
    nothingExecuted: "Nothing has been carried out.",
    simulated: "Simulated planning",
    retry: "Try again",
    verification: "Browser verification",
  },
  "zh-Hant": {
    placeholder: "告訴 Asympta 你想發生甚麼…",
    send: "送出意圖",
    idle: "你想讓甚麼事情發生？",
    interpreting: "正在理解你的需要…",
    discovering: "正在尋找可以幫忙的人…",
    coordinating: "正在和合適的人與代理溝通…",
    waiting_input: "還需要你提供一個小資料。",
    executing: "正在把事情辦好…",
    verifying: "正在確認事情真的完成了…",
    completed: "完成了。",
    blocked: "目前還沒有可連接的服務完成這件事。",
    failed: "這次暫時未能完成。",
    result: "Asympta 結果",
    validatedGoal: "已確認目標",
    checked: "查核時間",
    sources: "資料來源",
    pendingConfirmation: "等待你的確認",
    consequence: "可能影響",
    nothingExecuted: "尚未執行任何行動。",
    simulated: "模擬規劃",
    retry: "再試一次",
    verification: "瀏覽器驗證",
  },
  ja: {
    placeholder: "Asympta に、実現してほしいことを話してください…",
    send: "意図を送る",
    idle: "何を実現したいですか？",
    interpreting: "必要なことを理解しています…",
    discovering: "助けられる相手を探しています…",
    coordinating: "適切な人やエージェントと連携しています…",
    waiting_input: "あと一つだけ確認が必要です。",
    executing: "実行しています…",
    verifying: "本当に完了したか確認しています…",
    completed: "完了しました。",
    blocked: "この依頼を実行できる接続先がまだありません。",
    failed: "今回はまだ完了できませんでした。",
    result: "Asympta の結果",
    validatedGoal: "確認済みの目標",
    checked: "確認時刻",
    sources: "情報源",
    pendingConfirmation: "確認を待っています",
    consequence: "影響",
    nothingExecuted: "まだ何も実行していません。",
    simulated: "シミュレーション計画",
    retry: "もう一度試す",
    verification: "ブラウザー認証",
  },
};

const JOURNEY_COPY: Record<Locale, {
  title: string;
  home: string;
  destinations: Record<InformationJourneyDestination, string>;
  phases: Record<InformationJourneyState["phase"], string>;
  alreadyThere: string;
  returnedSources: (count: number) => string;
}> = {
  en: {
    title: "Information journey",
    home: "Asympta",
    destinations: {
      external: "Outside information",
      weather: "Weather station",
      "public-web": "Public web",
      planning: "Planning desk",
      clarification: "Clarification desk",
    },
    phases: {
      idle: "Ready to travel",
      departing: "Going out to current public sources…",
      gathering: "At the source · collecting the result…",
      returning: "Returning with the result and evidence…",
      delivered: "Returned with the result.",
      waiting: "Returned with a question or proposal.",
      failed: "Returned without a usable result.",
    },
    alreadyThere: "Already there · collecting before returning…",
    returnedSources: (count) => `Returned with ${count} source${count === 1 ? "" : "s"}.`,
  },
  "zh-Hant": {
    title: "資訊旅程",
    home: "Asympta",
    destinations: {
      external: "外部資訊站",
      weather: "天氣資料站",
      "public-web": "公開網絡",
      planning: "安全規劃站",
      clarification: "資料確認站",
    },
    phases: {
      idle: "準備出發",
      departing: "正在前往最新的公開資料來源…",
      gathering: "已到達來源 · 正在取回結果…",
      returning: "正在帶着結果與證據返回…",
      delivered: "已返回並交付結果。",
      waiting: "已帶回問題或方案，等待你決定。",
      failed: "已返回，但未取得可用結果。",
    },
    alreadyThere: "已在資訊站 · 取回最新結果後返回…",
    returnedSources: (count) => `已帶回 ${count} 個資料來源。`,
  },
  ja: {
    title: "情報の旅",
    home: "Asympta",
    destinations: {
      external: "外部情報所",
      weather: "気象情報所",
      "public-web": "公開ウェブ",
      planning: "安全計画所",
      clarification: "確認所",
    },
    phases: {
      idle: "出発準備",
      departing: "最新の公開情報へ向かっています…",
      gathering: "情報源に到着 · 結果を集めています…",
      returning: "結果と根拠を持って戻っています…",
      delivered: "戻って結果を届けました。",
      waiting: "質問または提案を持ち帰りました。",
      failed: "戻りましたが、利用できる結果はありません。",
    },
    alreadyThere: "すでに情報源にいます · 収集して戻ります…",
    returnedSources: (count) => `${count} 件の情報源を持ち帰りました。`,
  },
};

const REQUEST_ACTOR_COPY: Record<Locale, {
  intent: string;
  information: string;
  research: string;
  verification: string;
  safety: string;
  asympta: string;
  webMcpReady: string;
  review: string;
}> = {
  en: {
    intent: "Intent agent",
    information: "Information agents",
    research: "2 research agents + 1 cross-check agent",
    verification: "Verification agent",
    safety: "Safety gate",
    asympta: "Asympta",
    webMcpReady: "WebMCP request ready for your review",
    review: "Review request",
  },
  "zh-Hant": {
    intent: "意圖代理",
    information: "資訊代理",
    research: "2 個研究代理 + 1 個交叉檢查代理",
    verification: "驗證代理",
    safety: "安全閘門",
    asympta: "Asympta",
    webMcpReady: "WebMCP 請求已準備好，等待你審核",
    review: "審核請求",
  },
  ja: {
    intent: "意図エージェント",
    information: "情報エージェント",
    research: "2 調査エージェント + 1 相互確認エージェント",
    verification: "検証エージェント",
    safety: "安全ゲート",
    asympta: "Asympta",
    webMcpReady: "WebMCP リクエストを確認できます",
    review: "リクエストを確認",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function humanStatus(locale: Locale, status?: AsymptaActivityStatus) {
  const copy = COPY[locale];
  return status ? copy[status] : copy.idle;
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatCheckedAt(value: string, locale: Locale) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function informationDestination(response: PublicAgentSuccessResponse): InformationJourneyDestination {
  if (response.goal.kind === "weather") return "weather";
  if (response.goal.kind === "research") return "public-web";
  if (response.goal.kind === "action") return "planning";
  return "clarification";
}

function waitForJourneyMotion(signal: AbortSignal, milliseconds: number) {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function InformationJourneyTicket({ journey, locale }: {
  journey: InformationJourneyState;
  locale: Locale;
}) {
  if (journey.phase === "idle") return null;
  const copy = JOURNEY_COPY[locale];
  const status = journey.phase === "gathering" && journey.alreadyAtDestination
    ? copy.alreadyThere
    : journey.phase === "delivered" && journey.sourceCount > 0
      ? copy.returnedSources(journey.sourceCount)
      : copy.phases[journey.phase];

  return (
    <section
      className="asympta-information-journey"
      data-phase={journey.phase}
      data-already-there={journey.alreadyAtDestination ? "true" : "false"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <header>
        <span>{copy.title}</span>
        <strong>{status}</strong>
      </header>
      <div className="asympta-information-journey__route" aria-hidden="true">
        <span className="asympta-information-journey__place asympta-information-journey__place--home">
          <Home size={13} strokeWidth={1.7} />
          <b>{copy.home}</b>
        </span>
        <svg viewBox="0 0 320 28" preserveAspectRatio="none">
          <path d="M8 18 C78 2 236 2 312 18" pathLength="100" />
        </svg>
        <span className="asympta-information-journey__traveller">
          <AnimalPortrait id="agent-user" side="user" />
        </span>
        <span className="asympta-information-journey__place asympta-information-journey__place--source">
          <Globe2 size={13} strokeWidth={1.7} />
          <b>{copy.destinations[journey.destination]}</b>
        </span>
      </div>
    </section>
  );
}

function PublicAgentResultPanel({ response, locale }: {
  response: PublicAgentSuccessResponse;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const sources = (response.result?.sources ?? [])
    .filter((source) => isSafePublicAgentSourceUrl(source.url))
    .slice(0, 4);
  const pendingAction = response.goal.status === "awaiting_confirmation" ? response.action : null;

  return (
    <section
      className="asympta-intent-result"
      data-kind={response.goal.kind}
      aria-label={copy.result}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="asympta-intent-result__goal">
        <span>{copy.validatedGoal}</span>
        <strong>{response.goal.title}</strong>
      </div>
      {response.goal.summary && response.goal.summary !== response.goal.title ? (
        <p className="asympta-intent-result__summary">{response.goal.summary}</p>
      ) : null}
      {response.result?.answer ? <p className="asympta-intent-result__answer">{response.result.answer}</p> : null}
      {pendingAction ? (
        <div className="asympta-intent-result__action" role="status">
          <strong><ShieldAlert size={14} aria-hidden="true" />{copy.pendingConfirmation}</strong>
          <p>{pendingAction.description}</p>
          <p><span>{copy.consequence}:</span> {pendingAction.consequence}</p>
          <small>{copy.nothingExecuted}</small>
        </div>
      ) : null}
      <footer className="asympta-intent-result__meta">
        {response.result?.checkedAt ? (
          <time dateTime={response.result.checkedAt}>{copy.checked} {formatCheckedAt(response.result.checkedAt, locale)}</time>
        ) : null}
        {response.provenance.simulated ? <span>{copy.simulated}</span> : null}
        {response.result?.verification ? (
          <span className="asympta-intent-result__verification" data-verification={response.result.verification.status}>
            {response.result.verification.details}
          </span>
        ) : null}
        {sources.length ? (
          <nav aria-label={copy.sources}>
            {sources.map((source, index) => (
              <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}<ExternalLink size={10} aria-hidden="true" />
              </a>
            ))}
          </nav>
        ) : null}
      </footer>
    </section>
  );
}

function showAgentMoment(event: AsymptaActivityEvent, locale: Locale) {
  if (!event.actorId) return;
  const selector = `.animal-map-marker--foreground[data-agent-id="${CSS.escape(event.actorId)}"]`;
  const marker = document.querySelector<HTMLElement>(selector);
  if (!marker) return;
  let bubble = marker.querySelector<HTMLElement>(".asympta-protocol-bubble");
  if (!bubble) {
    bubble = document.createElement("span");
    bubble.className = "asympta-protocol-bubble";
    marker.appendChild(bubble);
  }
  bubble.textContent = humanStatus(locale, event.status);
  marker.classList.add("is-protocol-active");
  marker.dataset.asymptaProtocol = event.protocol;
  if (marker instanceof HTMLButtonElement && event.status !== "completed" && event.status !== "failed") marker.click();
  const sequence = String(Number(marker.dataset.asymptaProtocolSequence ?? "0") + 1);
  marker.dataset.asymptaProtocolSequence = sequence;
  window.setTimeout(() => {
    if (marker.dataset.asymptaProtocolSequence !== sequence) return;
    marker.classList.remove("is-protocol-active");
  }, 2_600);
}

function taskActivityStatus(task: AsymptaTaskState): AsymptaActivityStatus {
  if (task.phase === "completed") return "completed";
  if (["failed", "blocked", "cancelled"].includes(task.phase)) return "failed";
  if (["awaiting_human", "awaiting_approval"].includes(task.phase)) return "waiting_input";
  if (task.phase === "discovering") return "discovering";
  if (["planning", "coordinating"].includes(task.phase)) return "coordinating";
  if (task.phase === "verifying") return "verifying";
  return "executing";
}

function taskSummary(task: AsymptaTaskState) {
  const nextRequirement = task.requirements.find((requirement) => requirement.status === "unknown");
  if (nextRequirement) return nextRequirement.prompt;
  return task.result?.summary
    ?? task.failure?.message
    ?? task.worldWorkflow?.activeTaskTitle
    ?? task.plan?.summary
    ?? task.summary;
}

function taskToPublicResult(task: AsymptaTaskState): PublicAgentSuccessResponse {
  const awaitingApproval = task.phase === "awaiting_approval";
  const completed = task.phase === "completed" && Boolean(task.result?.completed);
  const verificationStatus = task.result?.verification.status ?? "not_verified";
  return {
    ok: true,
    activityId: task.activityId ?? task.taskId,
    goal: {
      title: task.title,
      summary: taskSummary(task),
      kind: "action",
      status: completed ? "completed" : awaitingApproval ? "awaiting_confirmation" : "needs_clarification",
      missingFields: task.requirements.filter((requirement) => requirement.status === "unknown").map((requirement) => requirement.raw),
      requiresConfirmation: awaitingApproval,
      risk: task.risk === "critical" ? "high" : task.risk,
    },
    result: completed && task.result ? {
      answer: task.result.summary,
      checkedAt: task.result.completedAt,
      sources: [],
      verification: {
        status: verificationStatus,
        details: task.result.verification.details,
      },
    } : null,
    action: awaitingApproval ? {
      description: task.plan?.summary ?? task.summary,
      consequence: task.approvals.find((approval) => approval.status === "pending")?.consequence
        ?? "Approval may create an external commitment.",
    } : null,
    provenance: {
      provider: "asympta",
      model: null,
      tools: [...new Set([
        ...task.assignments.map((assignment) => assignment.agentId),
        ...(task.worldWorkflow?.agentIds ?? []),
      ])],
      simulated: task.mode !== "live",
    },
  };
}

export function AsymptaIntentComposer() {
  const [locale, setLocale] = useState<Locale>("en");
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState<AsymptaActivity | null>(null);
  const [publicResult, setPublicResult] = useState<PublicAgentSuccessResponse | null>(null);
  const [journey, setJourney] = useState<InformationJourneyState>(EMPTY_INFORMATION_JOURNEY);
  const [requestError, setRequestError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [webMcpDraft, setWebMcpDraft] = useState<AsymptaWebMcpRequest | null>(null);
  const configRef = useRef<AsymptaProtocolConfig>({ mcp: [], a2a: [] });
  const activityRef = useRef<AsymptaActivity | null>(null);
  const journeyRef = useRef<InformationJourneyState>(EMPTY_INFORMATION_JOURNEY);
  const currentRequestRef = useRef<AsymptaCurrentRequest | null>(null);
  const projectedTaskRevisionRef = useRef(new Map<string, number>());
  const abortRef = useRef<AbortController | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    configRef.current = readBrowserProtocolConfig();
    const syncLocale = () => setLocale(localeFromDocument());
    queueMicrotask(syncLocale);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => subscribeBrowserWebMcpRequests((request) => {
    if (request.status === "pending_human_review") setWebMcpDraft(request);
  }), []);

  const publishActivity = useCallback((next: AsymptaActivity, event: AsymptaActivityEvent) => {
    activityRef.current = next;
    setActivity(next);
    showAgentMoment(event, locale);
    window.dispatchEvent(new CustomEvent("asympta:activity", { detail: { activity: next, event } }));
  }, [locale]);

  const updateJourney = useCallback((transition: (current: InformationJourneyState) => InformationJourneyState) => {
    const next = transition(journeyRef.current);
    journeyRef.current = next;
    setJourney(next);
    return next;
  }, []);

  useEffect(() => {
    const onTaskKernel = (event: Event) => {
      const detail = (event as CustomEvent<AsymptaTaskKernelEventDetail>).detail;
      const task = detail?.task;
      const active = activityRef.current;
      if (!task || !active || task.activityId !== active.id) return;
      if ((projectedTaskRevisionRef.current.get(task.taskId) ?? 0) >= task.revision) return;
      projectedTaskRevisionRef.current.set(task.taskId, task.revision);

      const status = taskActivityStatus(task);
      const summary = taskSummary(task);
      const actorId = task.worldWorkflow?.activeAgentId
        ?? (status === "completed" ? "agent-quality" : status === "failed" ? "agent-support" : "agent-user");
      let next = appendAsymptaEvent(active, {
        status,
        protocol: "asympta",
        actorId,
        summary,
        data: {
          taskId: task.taskId,
          taskRevision: task.revision,
          taskPhase: task.phase,
          workflowId: task.worldWorkflow?.workflowId ?? null,
          workflowStatus: task.worldWorkflow?.status ?? null,
          workflowStage: task.worldWorkflow?.activeTaskTitle ?? null,
          missingFields: task.requirements.filter((requirement) => requirement.status === "unknown").map((requirement) => requirement.raw),
        },
      });
      if (status === "completed" && task.result) {
        next = {
          ...next,
          outcome: {
            verified: task.result.verification.status === "verified",
            verification: "task-completed",
            summary: task.result.summary,
            value: task,
          },
        };
      }
      const emitted = next.events.at(-1);
      if (emitted) publishActivity(next, emitted);

      const currentRequest = currentRequestRef.current;
      if (currentRequest) {
        const requestStatus = task.phase === "completed"
          ? "completed"
          : task.phase === "awaiting_approval"
            ? "awaiting_confirmation"
            : ["failed", "blocked", "cancelled"].includes(task.phase)
              ? "failed"
              : task.phase === "awaiting_human"
                ? "waiting_input"
                : task.phase === "verifying"
                  ? "returning"
                  : "gathering";
        const projected: AsymptaCurrentRequest = {
          ...currentRequest,
          goal: task.title,
          kind: task.phase === "awaiting_human" ? "clarification" : "action",
          permission: task.completion.outcomeKind === "information" ? "READ" : "WRITE_REQUEST",
          status: requestStatus,
          actor: task.phase === "completed" ? REQUEST_ACTOR_COPY[locale].verification : REQUEST_ACTOR_COPY[locale].asympta,
          step: summary,
          verification: task.result?.verification.status ?? currentRequest.verification,
          events: [...currentRequest.events, summary].slice(-6),
          updatedAt: new Date().toISOString(),
        };
        currentRequestRef.current = projected;
        publishAsymptaCurrentRequest(projected);
      }

      if (task.phase === "completed") {
        setRequestError(null);
        setPublicResult(taskToPublicResult(task));
        updateJourney((current) => current.tripId === task.activityId
          ? finishInformationJourney(current, task.activityId as string, "delivered")
          : current);
      } else if (["failed", "blocked", "cancelled"].includes(task.phase)) {
        setRequestError({ message: summary, retryable: false });
        updateJourney((current) => current.tripId === task.activityId
          ? failInformationJourney(current, task.activityId as string)
          : current);
      } else if (task.phase === "awaiting_approval") {
        setPublicResult(taskToPublicResult(task));
        updateJourney((current) => current.tripId === task.activityId
          ? finishInformationJourney(current, task.activityId as string, "waiting")
          : current);
      } else if (task.phase !== "awaiting_human") {
        // Resolved options unblock the same task. The old clarification card
        // must disappear while its visible agent workflow is in progress.
        setPublicResult(null);
      }
    };

    window.addEventListener(ASYMPTA_TASK_KERNEL_EVENT, onTaskKernel);
    return () => window.removeEventListener(ASYMPTA_TASK_KERNEL_EVENT, onTaskKernel);
  }, [locale, publishActivity, updateJourney]);

  const runIntent = useCallback(async (intention: string, requestContext: RequestContext = { source: "human" }) => {
    const clean = intention.trim();
    if (!clean) throw new Error("An intention is required.");
    if (clean.length > 600) throw new Error("An intention can contain at most 600 characters.");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isCurrentRun = () => abortRef.current === controller && !controller.signal.aborted;
    const assertCurrentRun = () => {
      if (!isCurrentRun()) throw new DOMException("Aborted", "AbortError");
    };
    let activeTripId: string | null = null;
    let trackedRequestId = requestContext.requestId ?? null;
    let currentRequest: AsymptaCurrentRequest | null = null;
    const publishRequest = (patch: Partial<AsymptaCurrentRequest>, event?: string) => {
      if (!currentRequest) return;
      currentRequest = {
        ...currentRequest,
        ...patch,
        events: event ? [...currentRequest.events, event].filter(Boolean).slice(-6) : currentRequest.events,
        updatedAt: new Date().toISOString(),
      };
      currentRequestRef.current = currentRequest;
      publishAsymptaCurrentRequest(currentRequest);
    };
    setRunning(true);
    setRequestError(null);
    setPublicResult(null);

    try {
      const publicConfig = getPublicAgentConfig();
      if (publicConfig) {
        let next = createAsymptaActivity({ intent: clean, locale, principalId: getOrCreatePublicAgentClientId() });
        const tripId = next.id;
        trackedRequestId = trackedRequestId ?? tripId;
        activeTripId = tripId;
        currentRequest = {
          requestId: trackedRequestId,
          source: requestContext.source,
          intent: clean,
          goal: null,
          kind: null,
          permission: "READ",
          status: "interpreting",
          actor: REQUEST_ACTOR_COPY[locale].intent,
          step: COPY[locale].interpreting,
          destination: null,
          sourceCount: 0,
          verification: null,
          events: [COPY[locale].interpreting],
          updatedAt: new Date().toISOString(),
        };
        currentRequestRef.current = currentRequest;
        publishAsymptaCurrentRequest(currentRequest);
        if (requestContext.source === "webmcp" && requestContext.requestId) {
          updateBrowserWebMcpRequest(requestContext.requestId, { status: "running" });
        }
        updateJourney((current) => beginInformationJourney(current, tripId));
        const emit = (status: AsymptaActivityStatus, summary: string, actorId: string, data?: Record<string, unknown>) => {
          next = appendAsymptaEvent(next, { status, protocol: "asympta", actorId, summary, data });
          const emitted = next.events.at(-1);
          if (emitted) publishActivity(next, emitted);
        };

        emit("interpreting", "Turning the intention into a bounded, validated goal.", "agent-user");
        try {
          const turnstileContainer = turnstileRef.current;
          if (!turnstileContainer) throw new PublicAgentClientError("Browser verification is not ready yet.", {
            code: "turnstile_failed",
            retryable: true,
          });
          const turnstile = await requestTurnstileToken({
            container: turnstileContainer,
            siteKey: publicConfig.turnstileSiteKey,
            signal: controller.signal,
          });
          let response: PublicAgentSuccessResponse;
          try {
            assertCurrentRun();
            updateJourney((current) => gatherInformationJourney(current, tripId));
            emit("discovering", "Searching current sources and checking the safe next step.", "agent-market");
            publishRequest({
              status: "gathering",
              actor: REQUEST_ACTOR_COPY[locale].information,
              step: COPY[locale].discovering,
              destination: JOURNEY_COPY[locale].destinations.external,
            }, COPY[locale].discovering);
            response = await runPublicAgentIntent({
              intent: clean,
              locale,
              timezone: browserTimezone(),
              turnstileToken: turnstile.token,
              clientId: next.principal.id,
            }, {
              endpoint: publicConfig.endpoint,
              signal: controller.signal,
            });
            assertCurrentRun();
          } finally {
            turnstile.release();
          }

          if (response.goal.kind === "action") {
            emit("coordinating", "Preparing the requested action without carrying it out.", "agent-operations", {
              publicActivityId: response.activityId,
              confirmationRequired: true,
            });
          }
          emit("verifying", response.result?.verification.details ?? "Checking the goal and returned evidence.", "agent-quality", {
            publicActivityId: response.activityId,
            verification: response.result?.verification.status,
          });
          const destination = informationDestination(response);
          const sourceCount = (response.result?.sources ?? []).filter((source) => isSafePublicAgentSourceUrl(source.url)).length;
          publishRequest({
            goal: response.goal.title,
            kind: response.goal.kind,
            permission: response.goal.kind === "action" ? "WRITE_REQUEST" : "READ",
            status: "returning",
            actor: response.goal.kind === "research" ? REQUEST_ACTOR_COPY[locale].research : REQUEST_ACTOR_COPY[locale].verification,
            step: response.result?.verification.details ?? COPY[locale].verifying,
            destination: JOURNEY_COPY[locale].destinations[destination],
            sourceCount,
            verification: response.result?.verification.status ?? null,
          }, response.result?.verification.details ?? COPY[locale].verifying);
          updateJourney((current) => returnInformationJourney(current, tripId, { destination, sourceCount }));
          await waitForJourneyMotion(controller.signal, 680);
          assertCurrentRun();
          setPublicResult(response);

          if (response.goal.status === "awaiting_confirmation") {
            updateJourney((current) => finishInformationJourney(current, tripId, "waiting"));
            publishRequest({
              status: "awaiting_confirmation",
              actor: REQUEST_ACTOR_COPY[locale].safety,
              step: response.action?.consequence ?? COPY[locale].pendingConfirmation,
            }, COPY[locale].pendingConfirmation);
            emit("waiting_input", "The action is ready for review and has not been executed.", "agent-user", {
              publicActivityId: response.activityId,
              consequence: response.action?.consequence,
            });
          } else if (response.goal.status === "needs_clarification") {
            updateJourney((current) => finishInformationJourney(current, tripId, "waiting"));
            const task = window.__ASYMPTA_TASK_KERNEL__?.createFromClarification({
              activityId: tripId,
              rootIntent: clean,
              locale,
              title: response.goal.title,
              summary: response.goal.summary,
              missingFields: response.goal.missingFields,
              mode: "simulated",
              risk: response.goal.risk,
            }) ?? null;
            const missingFields = task
              ? task.requirements.filter((requirement) => requirement.status === "unknown").map((requirement) => requirement.raw)
              : response.goal.missingFields;
            publishRequest({
              status: "waiting_input",
              actor: REQUEST_ACTOR_COPY[locale].asympta,
              step: response.goal.summary,
            }, response.goal.summary);
            emit("waiting_input", response.goal.summary, "agent-user", {
              publicActivityId: response.activityId,
              missingFields,
              ...(task ? { taskId: task.taskId, taskRevision: task.revision } : {}),
            });
          } else {
            next = {
              ...next,
              outcome: {
                verified: response.result?.verification.status === "verified",
                verification: "protocol-response",
                summary: response.result?.answer ?? response.goal.summary,
                value: response,
              },
            };
            updateJourney((current) => finishInformationJourney(current, tripId, "delivered"));
            publishRequest({
              status: "completed",
              actor: REQUEST_ACTOR_COPY[locale].asympta,
              step: response.result?.answer ?? response.goal.summary,
            }, COPY[locale].completed);
            emit("completed", response.result?.answer ?? response.goal.summary, "agent-quality", {
              publicActivityId: response.activityId,
            });
          }

          if (requestContext.source === "webmcp" && requestContext.requestId) {
            const requestStatus = response.goal.status === "awaiting_confirmation"
              ? "awaiting_confirmation"
              : response.goal.status === "needs_clarification"
                ? "needs_clarification"
                : "completed";
            updateBrowserWebMcpRequest(requestContext.requestId, {
              status: requestStatus,
              resultSummary: response.goal.status === "awaiting_confirmation"
                ? response.action?.consequence ?? response.goal.summary
                : response.result?.answer ?? response.goal.summary,
            });
          }
          return next;
        } catch (error) {
          if ((error instanceof DOMException && error.name === "AbortError") || !isCurrentRun()) {
            throw new DOMException("Aborted", "AbortError");
          }
          updateJourney((current) => failInformationJourney(current, tripId));
          publishRequest({
            status: "failed",
            actor: REQUEST_ACTOR_COPY[locale].asympta,
            step: error instanceof Error ? error.message : COPY[locale].failed,
          }, COPY[locale].failed);
          emit("failed", error instanceof Error ? error.message : String(error), "agent-support", error instanceof PublicAgentClientError
            ? { code: error.code, retryable: error.retryable }
            : undefined);
          throw error;
        }
      }

      const result = await runAsymptaIntent(clean, configRef.current, {
        locale,
        signal: controller.signal,
        onActivity: (next, event) => {
          if (isCurrentRun()) publishActivity(next, event);
        },
      });
      assertCurrentRun();
      activityRef.current = result;
      setActivity(result);
      return result;
    } catch (error) {
      if ((error instanceof DOMException && error.name === "AbortError") || !isCurrentRun()) {
        if (requestContext.source === "webmcp" && requestContext.requestId) {
          updateBrowserWebMcpRequest(requestContext.requestId, {
            status: "failed",
            resultSummary: "Request was interrupted before completion.",
          });
        }
        if (abortRef.current === controller && activeTripId) {
          updateJourney((current) => current.tripId === activeTripId ? EMPTY_INFORMATION_JOURNEY : current);
        }
        throw new DOMException("Aborted", "AbortError");
      }
      if (requestContext.source === "webmcp" && requestContext.requestId) {
        updateBrowserWebMcpRequest(requestContext.requestId, {
          status: "failed",
          resultSummary: error instanceof Error ? error.message : COPY[locale].failed,
        });
      }
      if (currentRequest && currentRequest.status !== "failed") {
        publishRequest({
          status: "failed",
          actor: REQUEST_ACTOR_COPY[locale].asympta,
          step: error instanceof Error ? error.message : COPY[locale].failed,
        }, COPY[locale].failed);
      }
      setRequestError({
        message: error instanceof Error ? error.message : COPY[locale].failed,
        retryable: error instanceof PublicAgentClientError ? error.retryable : true,
      });
      throw error;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setRunning(false);
      }
    }
  }, [locale, publishActivity, updateJourney]);

  useEffect(() => {
    window.__ASYMPTA_PROTOCOLS__ = {
      config: () => configRef.current,
      configure: (next, options = {}) => {
        const config = options.persist ? storeBrowserProtocolConfig(next) : next;
        configRef.current = config;
        return config;
      },
      runIntent,
      lastActivity: () => activityRef.current,
    };
    return () => {
      if (window.__ASYMPTA_PROTOCOLS__?.runIntent === runIntent) delete window.__ASYMPTA_PROTOCOLS__;
      abortRef.current?.abort();
    };
  }, [runIntent]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const intention = text.trim();
    if (!intention || running) return;
    const reviewedWebMcpRequest = webMcpDraft?.status === "pending_human_review" && webMcpDraft.intent === intention
      ? webMcpDraft
      : null;
    try {
      if (reviewedWebMcpRequest) setWebMcpDraft(null);
      await runIntent(intention, reviewedWebMcpRequest
        ? { source: "webmcp", requestId: reviewedWebMcpRequest.requestId }
        : { source: "human" });
      setText("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Asympta intention failed", error);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const reviewWebMcpDraft = () => {
    if (!webMcpDraft || running) return;
    setText(webMcpDraft.intent);
    setRequestError(null);
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLTextAreaElement>(".asympta-intent-composer textarea");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  };

  const status = activity?.status;
  const copy = COPY[locale];

  return (
    <div className="asympta-intent-shell" data-status={status ?? "idle"}>
      {publicResult ? <PublicAgentResultPanel response={publicResult} locale={locale} /> : null}
      {requestError ? (
        <div className="asympta-intent-error" role="alert">
          <span>{requestError.message}</span>
          {requestError.retryable ? (
            <button type="button" onClick={() => void submit()} disabled={running || !text.trim()}>{COPY[locale].retry}</button>
          ) : null}
        </div>
      ) : null}
      <InformationJourneyTicket journey={journey} locale={locale} />
      {webMcpDraft ? (
        <button type="button" className="asympta-webmcp-draft" onClick={reviewWebMcpDraft} disabled={running}>
          <span><strong>{REQUEST_ACTOR_COPY[locale].webMcpReady}</strong><small>{webMcpDraft.intent}</small></span>
          <b>{REQUEST_ACTOR_COPY[locale].review}</b>
        </button>
      ) : null}
      <div ref={turnstileRef} className="asympta-intent-turnstile" aria-label={COPY[locale].verification} />
      <div className="asympta-intent-presence" aria-live="polite">
        <AnimalPortrait id="agent-user" side="user" className="asympta-intent-avatar" />
        <span>{humanStatus(locale, status)}</span>
        {status === "completed" ? <Check size={13} strokeWidth={2} /> : running ? <LoaderCircle size={13} className="asympta-intent-spinner" /> : <i />}
      </div>
      <form className="asympta-intent-composer" onSubmit={submit}>
        <textarea
          value={text}
          rows={1}
          maxLength={600}
          spellCheck
          aria-label={copy.placeholder}
          placeholder={copy.placeholder}
          onChange={(event) => {
            setText(event.target.value);
            if (requestError) setRequestError(null);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="submit" aria-label={copy.send} disabled={running || !text.trim()}>
          {running ? <LoaderCircle size={17} className="asympta-intent-spinner" /> : <ArrowUp size={17} strokeWidth={2} />}
        </button>
      </form>
    </div>
  );
}

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

type Locale = "en" | "zh-Hant" | "ja";

type ProtocolBridge = {
  config: () => AsymptaProtocolConfig;
  configure: (config: AsymptaProtocolConfig, options?: { persist?: boolean }) => AsymptaProtocolConfig;
  runIntent: (intention: string) => Promise<AsymptaActivity>;
  lastActivity: () => AsymptaActivity | null;
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
      {response.result?.answer ? (
        <p className="asympta-intent-result__answer">{response.result.answer}</p>
      ) : null}
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
          <time dateTime={response.result.checkedAt}>
            {copy.checked} {formatCheckedAt(response.result.checkedAt, locale)}
          </time>
        ) : null}
        {response.provenance.simulated ? <span>{copy.simulated}</span> : null}
        {sources.length ? (
          <nav aria-label={copy.sources}>
            {sources.map((source, index) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
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

  if (marker instanceof HTMLButtonElement && event.status !== "completed" && event.status !== "failed") {
    marker.click();
  }

  const sequence = String(Number(marker.dataset.asymptaProtocolSequence ?? "0") + 1);
  marker.dataset.asymptaProtocolSequence = sequence;
  window.setTimeout(() => {
    if (marker.dataset.asymptaProtocolSequence !== sequence) return;
    marker.classList.remove("is-protocol-active");
  }, 2_600);
}

export function AsymptaIntentComposer() {
  const [locale, setLocale] = useState<Locale>("en");
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState<AsymptaActivity | null>(null);
  const [publicResult, setPublicResult] = useState<PublicAgentSuccessResponse | null>(null);
  const [journey, setJourney] = useState<InformationJourneyState>(EMPTY_INFORMATION_JOURNEY);
  const [requestError, setRequestError] = useState<{ message: string; retryable: boolean } | null>(null);
  const configRef = useRef<AsymptaProtocolConfig>({ mcp: [], a2a: [] });
  const activityRef = useRef<AsymptaActivity | null>(null);
  const journeyRef = useRef<InformationJourneyState>(EMPTY_INFORMATION_JOURNEY);
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

  const runIntent = useCallback(async (intention: string) => {
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
    setRunning(true);
    setRequestError(null);
    setPublicResult(null);

    try {
      const publicConfig = getPublicAgentConfig();
      if (publicConfig) {
        let next = createAsymptaActivity({
          intent: clean,
          locale,
          principalId: getOrCreatePublicAgentClientId(),
        });
        const tripId = next.id;
        activeTripId = tripId;
        updateJourney((current) => beginInformationJourney(current, tripId));
        const emit = (
          status: AsymptaActivityStatus,
          summary: string,
          actorId: string,
          data?: Record<string, unknown>,
        ) => {
          next = appendAsymptaEvent(next, {
            status,
            protocol: "asympta",
            actorId,
            summary,
            data,
          });
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
            emit(
              "coordinating",
              "Preparing the requested action without carrying it out.",
              "agent-operations",
              { publicActivityId: response.activityId, confirmationRequired: true },
            );
          }
          emit(
            "verifying",
            response.result?.verification.details ?? "Checking the goal and returned evidence.",
            "agent-quality",
            { publicActivityId: response.activityId, verification: response.result?.verification.status },
          );
          updateJourney((current) => returnInformationJourney(current, tripId, {
            destination: informationDestination(response),
            sourceCount: (response.result?.sources ?? []).filter((source) => isSafePublicAgentSourceUrl(source.url)).length,
          }));
          await waitForJourneyMotion(controller.signal, 680);
          assertCurrentRun();
          setPublicResult(response);

          if (response.goal.status === "awaiting_confirmation") {
            updateJourney((current) => finishInformationJourney(current, tripId, "waiting"));
            emit(
              "waiting_input",
              "The action is ready for review and has not been executed.",
              "agent-user",
              { publicActivityId: response.activityId, consequence: response.action?.consequence },
            );
          } else if (response.goal.status === "needs_clarification") {
            updateJourney((current) => finishInformationJourney(current, tripId, "waiting"));
            emit(
              "waiting_input",
              response.goal.summary,
              "agent-user",
              { publicActivityId: response.activityId, missingFields: response.goal.missingFields },
            );
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
            emit(
              "completed",
              response.result?.answer ?? response.goal.summary,
              "agent-quality",
              { publicActivityId: response.activityId },
            );
          }
          return next;
        } catch (error) {
          if ((error instanceof DOMException && error.name === "AbortError") || !isCurrentRun()) {
            throw new DOMException("Aborted", "AbortError");
          }
          updateJourney((current) => failInformationJourney(current, tripId));
          emit(
            "failed",
            error instanceof Error ? error.message : String(error),
            "agent-support",
            error instanceof PublicAgentClientError ? { code: error.code, retryable: error.retryable } : undefined,
          );
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
        if (abortRef.current === controller && activeTripId) {
          updateJourney((current) => current.tripId === activeTripId ? EMPTY_INFORMATION_JOURNEY : current);
        }
        throw new DOMException("Aborted", "AbortError");
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
    try {
      await runIntent(intention);
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

  const status = activity?.status;
  const copy = COPY[locale];

  return (
    <div className="asympta-intent-shell" data-status={status ?? "idle"}>
      {publicResult ? <PublicAgentResultPanel response={publicResult} locale={locale} /> : null}
      {requestError ? (
        <div className="asympta-intent-error" role="alert">
          <span>{requestError.message}</span>
          {requestError.retryable ? (
            <button type="button" onClick={() => void submit()} disabled={running || !text.trim()}>
              {COPY[locale].retry}
            </button>
          ) : null}
        </div>
      ) : null}
      <InformationJourneyTicket journey={journey} locale={locale} />
      <div
        ref={turnstileRef}
        className="asympta-intent-turnstile"
        aria-label={COPY[locale].verification}
      />
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

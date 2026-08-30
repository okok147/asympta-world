"use client";

import { ArrowUp, Check, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { AnimalPortrait } from "@/components/asympta-animal-art";
import { readBrowserProtocolConfig, storeBrowserProtocolConfig } from "@/lib/asympta-browser-protocols";
import { runAsymptaIntent, type AsymptaProtocolConfig } from "@/lib/asympta-protocol-runtime";
import type { AsymptaActivity, AsymptaActivityEvent, AsymptaActivityStatus } from "@/lib/asympta-activity";

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

function isConnected(config: AsymptaProtocolConfig) {
  return config.a2a.length + config.mcp.length > 0;
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
  const [connected, setConnected] = useState(false);
  const [activity, setActivity] = useState<AsymptaActivity | null>(null);
  const configRef = useRef<AsymptaProtocolConfig>({ mcp: [], a2a: [] });
  const activityRef = useRef<AsymptaActivity | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const config = readBrowserProtocolConfig();
    configRef.current = config;
    setConnected(isConnected(config));
    const syncLocale = () => setLocale(localeFromDocument());
    syncLocale();
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  const runIntent = useCallback(async (intention: string) => {
    const clean = intention.trim();
    if (!clean) throw new Error("An intention is required.");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    try {
      const result = await runAsymptaIntent(clean, configRef.current, {
        locale,
        signal: controller.signal,
        onActivity: (next, event) => {
          activityRef.current = next;
          setActivity(next);
          showAgentMoment(event, locale);
          window.dispatchEvent(new CustomEvent("asympta:activity", { detail: { activity: next, event } }));
        },
      });
      activityRef.current = result;
      setActivity(result);
      return result;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
    }
  }, [locale]);

  useEffect(() => {
    window.__ASYMPTA_PROTOCOLS__ = {
      config: () => configRef.current,
      configure: (next, options = {}) => {
        const config = options.persist ? storeBrowserProtocolConfig(next) : next;
        configRef.current = config;
        setConnected(isConnected(config));
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
    setText("");
    try {
      await runIntent(intention);
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
      <div className="asympta-intent-presence" aria-live="polite">
        <AnimalPortrait id="agent-user" side="user" className="asympta-intent-avatar" />
        <span>{humanStatus(locale, status)}</span>
        {status === "completed" ? <Check size={13} strokeWidth={2} /> : running ? <LoaderCircle size={13} className="asympta-intent-spinner" /> : <i className={connected ? "is-connected" : ""} />}
      </div>
      <form className="asympta-intent-composer" onSubmit={submit}>
        <textarea
          value={text}
          rows={1}
          maxLength={1_200}
          spellCheck
          aria-label={copy.placeholder}
          placeholder={copy.placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" aria-label={copy.send} disabled={running || !text.trim()}>
          {running ? <LoaderCircle size={17} className="asympta-intent-spinner" /> : <ArrowUp size={17} strokeWidth={2} />}
        </button>
      </form>
    </div>
  );
}

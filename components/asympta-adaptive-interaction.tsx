"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import styles from "./asympta-adaptive-interaction.module.css";

import { readAdaptiveActivityIntent } from "@/lib/asympta-adaptive-activity-bridge";
import {
  createAdaptiveInteractionSchema,
  mergeAdaptiveClarifications,
  missingFieldsFromAdaptiveActivityData,
  type AdaptiveAnswerValue,
  type AdaptiveConfirmation,
  type AdaptiveInteractionLocale,
  type AdaptiveInteractionSchema,
} from "@/lib/asympta-adaptive-interaction";

type ActivityDetail = {
  activity?: { id?: string; intent?: unknown; status?: string };
  event?: { status?: string; summary?: string; data?: unknown };
};

type ProtocolBridge = { runIntent: (intention: string) => Promise<unknown> };

const COPY: Record<AdaptiveInteractionLocale, {
  eyebrow: string;
  title: string;
  other: string;
  continue: string;
  continuing: string;
  unavailable: string;
  confirmed: string;
}> = {
  en: {
    eyebrow: "Next necessary choice",
    title: "Help Asympta continue",
    other: "Something else",
    continue: "Continue",
    continuing: "Continuing…",
    unavailable: "The agent runtime is not ready yet. Try again in a moment.",
    confirmed: "User-confirmed",
  },
  "zh-Hant": {
    eyebrow: "下一個必要選擇",
    title: "讓 Asympta 繼續",
    other: "其他",
    continue: "繼續",
    continuing: "正在繼續…",
    unavailable: "代理執行環境暫時未準備好，請稍後再試。",
    confirmed: "由你確認",
  },
  ja: {
    eyebrow: "次に必要な選択",
    title: "Asympta を続ける",
    other: "その他",
    continue: "続ける",
    continuing: "続行中…",
    unavailable: "エージェント実行環境の準備ができていません。少し待って再試行してください。",
    confirmed: "ユーザー確認済み",
  },
};

function localeFromDocument(): AdaptiveInteractionLocale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function protocolBridge() {
  return (window as unknown as { __ASYMPTA_PROTOCOLS__?: ProtocolBridge }).__ASYMPTA_PROTOCOLS__;
}

function sameTask(baseIntent: string, candidate: string) {
  const base = baseIntent.trim();
  const value = candidate.trim();
  return Boolean(base && value && (value === base || value.startsWith(`${base}\n`) || value.startsWith(`${base}.`)));
}

function answerReady(schema: AdaptiveInteractionSchema | null, selected: AdaptiveAnswerValue | null, custom: string) {
  const field = schema?.nextField;
  if (!field) return false;
  if (field.control === "text") return custom.trim().length > 0;
  if (field.control === "number") return custom.trim().length > 0 && Number.isFinite(Number(custom));
  return selected !== null || custom.trim().length > 0;
}

function advanceSchema(schema: AdaptiveInteractionSchema): AdaptiveInteractionSchema | null {
  const remaining = schema.fields.slice(1);
  if (!remaining.length) return null;
  return {
    ...schema,
    fields: remaining,
    nextField: remaining[0] ?? null,
  };
}

export function AsymptaAdaptiveInteraction() {
  const [locale, setLocale] = useState<AdaptiveInteractionLocale>("en");
  const [schema, setSchema] = useState<AdaptiveInteractionSchema | null>(null);
  const [selected, setSelected] = useState<AdaptiveAnswerValue | null>(null);
  const [custom, setCustom] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseIntentRef = useRef("");
  const confirmationsRef = useRef<AdaptiveConfirmation[]>([]);

  useEffect(() => {
    const syncLocale = () => setLocale(localeFromDocument());
    queueMicrotask(syncLocale);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      const activityIntent = readAdaptiveActivityIntent(detail?.activity);
      const status = detail?.event?.status ?? detail?.activity?.status ?? "";

      if (status === "interpreting" && baseIntentRef.current && activityIntent && !sameTask(baseIntentRef.current, activityIntent)) {
        baseIntentRef.current = "";
        confirmationsRef.current = [];
        setSchema(null);
        setSelected(null);
        setCustom("");
        setCustomOpen(false);
        setError(null);
      }

      if (status === "waiting_input") {
        const missingFields = missingFieldsFromAdaptiveActivityData(detail?.event?.data);
        if (!activityIntent || !missingFields.length) return;

        if (!baseIntentRef.current || !sameTask(baseIntentRef.current, activityIntent)) {
          baseIntentRef.current = activityIntent;
          confirmationsRef.current = [];
        }

        setSchema(createAdaptiveInteractionSchema({
          intent: baseIntentRef.current,
          missingFields,
          locale,
          interactionId: detail?.activity?.id,
        }));
        setSelected(null);
        setCustom("");
        setCustomOpen(false);
        setContinuing(false);
        setError(null);
        return;
      }

      if ((status === "completed" || status === "failed" || status === "blocked")
        && baseIntentRef.current
        && activityIntent
        && sameTask(baseIntentRef.current, activityIntent)) {
        setSchema(null);
        setSelected(null);
        setCustom("");
        setCustomOpen(false);
        setContinuing(false);
        if (status === "completed") {
          baseIntentRef.current = "";
          confirmationsRef.current = [];
          setError(null);
        }
      }
    };

    window.addEventListener("asympta:activity", onActivity);
    return () => window.removeEventListener("asympta:activity", onActivity);
  }, [locale]);

  const field = schema?.nextField ?? null;
  if (!schema || !field) return null;

  const copy = COPY[locale];
  const ready = answerReady(schema, selected, custom);
  const showDirectCustomInput = field.key === "event_intent";

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || continuing) return;

    let value: AdaptiveAnswerValue;
    let label: string;
    if (field.control === "text") {
      value = custom.trim();
      label = custom.trim();
    } else if (field.control === "number") {
      value = Number(custom);
      label = custom.trim();
    } else if (selected !== null) {
      value = selected;
      label = field.options.find((candidate) => Object.is(candidate.value, selected))?.label ?? String(selected);
    } else {
      value = custom.trim();
      label = custom.trim();
    }

    const nextConfirmation: AdaptiveConfirmation = { field: field.sourceField, value, label };
    const nextConfirmations = [
      ...confirmationsRef.current.filter((candidate) => candidate.field !== field.sourceField),
      nextConfirmation,
    ];
    confirmationsRef.current = nextConfirmations;

    const nextSchema = advanceSchema(schema);
    if (nextSchema) {
      setSchema(nextSchema);
      setSelected(null);
      setCustom("");
      setCustomOpen(false);
      setError(null);
      return;
    }

    const bridge = protocolBridge();
    if (!bridge) {
      setError(copy.unavailable);
      return;
    }

    const intention = mergeAdaptiveClarifications({
      intent: baseIntentRef.current,
      confirmations: nextConfirmations,
      locale,
    });

    setContinuing(true);
    setError(null);
    setSchema(null);
    try {
      await bridge.runIntent(intention);
    } catch (runError) {
      if (runError instanceof DOMException && runError.name === "AbortError") return;
      setSchema(schema);
      setError(runError instanceof Error ? runError.message : copy.unavailable);
    } finally {
      setContinuing(false);
    }
  };

  return (
    <aside
      className={styles.shell}
      data-asympta-adaptive-schema={schema.schemaVersion}
      data-field={field.key}
      data-provenance={schema.provenance.mode}
      aria-label={copy.title}
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <span className={styles.eyebrow}><Sparkles size={12} aria-hidden="true" />{copy.eyebrow}</span>
          <span className={styles.provenance}><Check size={11} aria-hidden="true" />{copy.confirmed}</span>
        </header>

        <div className={styles.question}>
          <span>{field.label}</span>
          <strong>{field.prompt}</strong>
          <p>{field.reason}</p>
        </div>

        <form className={styles.form} onSubmit={submit}>
          {field.control === "single_choice" || field.control === "boolean" ? (
            <div className={styles.options} role="group" aria-label={field.prompt}>
              {field.options.map((candidate) => (
                <button
                  key={`${field.id}:${String(candidate.value)}`}
                  type="button"
                  className={styles.option}
                  data-selected={Object.is(candidate.value, selected) ? "true" : "false"}
                  aria-pressed={Object.is(candidate.value, selected)}
                  onClick={() => {
                    setSelected(candidate.value);
                    setCustom("");
                    setCustomOpen(false);
                    setError(null);
                  }}
                >
                  <span>{candidate.label}</span>
                  {candidate.description ? <small>{candidate.description}</small> : null}
                </button>
              ))}
              {field.allowCustom && !showDirectCustomInput ? (
                <button
                  type="button"
                  className={styles.option}
                  data-selected={customOpen ? "true" : "false"}
                  aria-pressed={customOpen}
                  onClick={() => {
                    setSelected(null);
                    setCustomOpen(true);
                    setError(null);
                  }}
                >
                  <span>{copy.other}</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {field.control === "text" || field.control === "number" || customOpen || showDirectCustomInput ? (
            <input
              className={styles.input}
              type={field.control === "number" ? "number" : "text"}
              inputMode={field.control === "number" ? "numeric" : "text"}
              min={field.control === "number" ? 1 : undefined}
              autoFocus={field.control === "text" || field.control === "number" || (customOpen && !showDirectCustomInput)}
              value={custom}
              placeholder={field.customPlaceholder}
              aria-label={field.prompt}
              onChange={(event) => {
                setCustom(event.target.value);
                setSelected(null);
                setError(null);
              }}
            />
          ) : null}

          {error ? <p className={styles.error} role="alert">{error}</p> : null}

          <button className={styles.continue} type="submit" disabled={!ready || continuing}>
            <span>{continuing ? copy.continuing : copy.continue}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </form>
      </div>
    </aside>
  );
}

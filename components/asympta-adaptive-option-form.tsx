"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import styles from "./asympta-adaptive-option-form.module.css";

import {
  mergeAdaptiveClarifications,
  missingFieldsFromAdaptiveActivityData,
  type AdaptiveAnswerValue,
  type AdaptiveConfirmation,
  type AdaptiveInteractionField,
  type AdaptiveInteractionLocale,
  type AdaptiveInteractionSchema,
} from "@/lib/asympta-adaptive-interaction";
import { createAdaptiveOptionPrimitiveSchema } from "@/lib/asympta-option-primitives";

type ActivityDetail = {
  activity?: { id?: string; intent?: string; status?: string };
  event?: { status?: string; summary?: string; data?: unknown };
};

type ProtocolBridge = { runIntent: (intention: string) => Promise<unknown> };

type AnswerState = {
  selected?: AdaptiveAnswerValue;
  custom: string;
  customOpen: boolean;
};

const EMPTY_ANSWER: AnswerState = { custom: "", customOpen: false };

const COPY: Record<AdaptiveInteractionLocale, {
  eyebrow: string;
  title: string;
  intro: string;
  other: string;
  continue: string;
  continuing: string;
  unavailable: string;
  confirmed: string;
}> = {
  en: {
    eyebrow: "Necessary choices",
    title: "Help Asympta continue",
    intro: "I turned the missing details into choices. Pick what fits; type only when a real choice cannot be inferred.",
    other: "Something else",
    continue: "Continue",
    continuing: "Continuing…",
    unavailable: "The agent runtime is not ready yet. Try again in a moment.",
    confirmed: "User-confirmed",
  },
  "zh-Hant": {
    eyebrow: "必要選擇",
    title: "讓 Asympta 繼續",
    intro: "缺少的資料已自動變成選項；能選就直接選，只有真的需要時才手動輸入。",
    other: "其他",
    continue: "繼續",
    continuing: "正在繼續…",
    unavailable: "代理執行環境暫時未準備好，請稍後再試。",
    confirmed: "由你確認",
  },
  ja: {
    eyebrow: "必要な選択",
    title: "Asympta を続ける",
    intro: "不足している情報を自動で選択肢にしました。選べるものは選び、必要な場合だけ入力してください。",
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

function emptyAnswers(schema: AdaptiveInteractionSchema | null): Record<string, AnswerState> {
  if (!schema) return {};
  return Object.fromEntries(schema.fields.map((field) => [field.id, { ...EMPTY_ANSWER }]));
}

function answerReady(field: AdaptiveInteractionField, answer: AnswerState | undefined) {
  if (!answer) return false;
  if (field.control === "text") return answer.custom.trim().length > 0;
  if (field.control === "number") return answer.custom.trim().length > 0 && Number.isFinite(Number(answer.custom));
  return answer.selected !== undefined || answer.custom.trim().length > 0;
}

function confirmationFrom(field: AdaptiveInteractionField, answer: AnswerState): AdaptiveConfirmation {
  if (field.control === "number") {
    return { field: field.sourceField, value: Number(answer.custom), label: answer.custom.trim() };
  }
  if (field.control === "text" || answer.selected === undefined) {
    const value = answer.custom.trim();
    return { field: field.sourceField, value, label: value };
  }
  return {
    field: field.sourceField,
    value: answer.selected,
    label: field.options.find((candidate) => Object.is(candidate.value, answer.selected))?.label ?? String(answer.selected),
  };
}

export function AsymptaAdaptiveOptionForm() {
  const [locale, setLocale] = useState<AdaptiveInteractionLocale>("en");
  const [schema, setSchema] = useState<AdaptiveInteractionSchema | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
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
      const activityIntent = detail?.activity?.intent?.trim() ?? "";
      const status = detail?.event?.status ?? detail?.activity?.status ?? "";

      if (status === "interpreting" && baseIntentRef.current && activityIntent && !sameTask(baseIntentRef.current, activityIntent)) {
        baseIntentRef.current = "";
        confirmationsRef.current = [];
        setSchema(null);
        setAnswers({});
        setError(null);
      }

      if (status === "waiting_input") {
        const missingFields = missingFieldsFromAdaptiveActivityData(detail?.event?.data);
        if (!activityIntent || !missingFields.length) return;

        if (!baseIntentRef.current || !sameTask(baseIntentRef.current, activityIntent)) {
          baseIntentRef.current = activityIntent;
          confirmationsRef.current = [];
        }

        const next = createAdaptiveOptionPrimitiveSchema({
          intent: baseIntentRef.current,
          missingFields,
          locale,
          interactionId: detail?.activity?.id,
        });
        setSchema(next);
        setAnswers(emptyAnswers(next));
        setContinuing(false);
        setError(null);
        return;
      }

      if ((status === "completed" || status === "failed" || status === "blocked")
        && baseIntentRef.current
        && activityIntent
        && sameTask(baseIntentRef.current, activityIntent)) {
        setSchema(null);
        setAnswers({});
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

  const ready = useMemo(
    () => Boolean(schema?.fields.length) && (schema?.fields.every((field) => answerReady(field, answers[field.id])) ?? false),
    [answers, schema],
  );

  if (!schema?.fields.length) return null;
  const copy = COPY[locale];

  const patchAnswer = (fieldId: string, patch: Partial<AnswerState>) => {
    setAnswers((current) => ({
      ...current,
      [fieldId]: { ...EMPTY_ANSWER, ...(current[fieldId] ?? {}), ...patch },
    }));
    setError(null);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || continuing) return;
    const bridge = protocolBridge();
    if (!bridge) {
      setError(copy.unavailable);
      return;
    }

    const newConfirmations = schema.fields.map((field) => confirmationFrom(field, answers[field.id] ?? EMPTY_ANSWER));
    const fieldNames = new Set(newConfirmations.map((confirmation) => confirmation.field));
    const nextConfirmations = [
      ...confirmationsRef.current.filter((candidate) => !fieldNames.has(candidate.field)),
      ...newConfirmations,
    ];
    confirmationsRef.current = nextConfirmations;

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
      data-field-count={schema.fields.length}
      data-provenance={schema.provenance.mode}
      aria-label={copy.title}
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <span className={styles.eyebrow}><Sparkles size={12} aria-hidden="true" />{copy.eyebrow}</span>
          <span className={styles.provenance}><Check size={11} aria-hidden="true" />{copy.confirmed}</span>
        </header>
        <p className={styles.intro}>{copy.intro}</p>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.fields}>
            {schema.fields.map((field) => {
              const answer: AnswerState = answers[field.id] ?? EMPTY_ANSWER;
              const directCustom = field.key === "event_intent";
              return (
                <section className={styles.field} key={field.id} data-field={field.key}>
                  <div className={styles.question}>
                    <span>{field.label}</span>
                    <strong>{field.prompt}</strong>
                    <p>{field.reason}</p>
                  </div>

                  {field.control === "single_choice" || field.control === "boolean" ? (
                    <div className={styles.options} role="group" aria-label={field.prompt}>
                      {field.options.map((candidate) => (
                        <button
                          key={`${field.id}:${String(candidate.value)}`}
                          type="button"
                          className={styles.option}
                          data-selected={Object.is(candidate.value, answer.selected) ? "true" : "false"}
                          aria-pressed={Object.is(candidate.value, answer.selected)}
                          onClick={() => patchAnswer(field.id, { selected: candidate.value, custom: "", customOpen: false })}
                        >
                          <span>{candidate.label}</span>
                          {candidate.description ? <small>{candidate.description}</small> : null}
                        </button>
                      ))}
                      {field.allowCustom && !directCustom ? (
                        <button
                          type="button"
                          className={styles.option}
                          data-selected={answer.customOpen ? "true" : "false"}
                          aria-pressed={answer.customOpen}
                          onClick={() => patchAnswer(field.id, { selected: undefined, customOpen: true })}
                        >
                          <span>{copy.other}</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {field.control === "text" || field.control === "number" || answer.customOpen || directCustom ? (
                    <input
                      className={styles.input}
                      type={field.control === "number" ? "number" : "text"}
                      inputMode={field.control === "number" ? "numeric" : "text"}
                      min={field.control === "number" ? 1 : undefined}
                      value={answer.custom}
                      placeholder={field.customPlaceholder}
                      aria-label={field.prompt}
                      onChange={(event) => patchAnswer(field.id, {
                        selected: undefined,
                        custom: event.target.value,
                        customOpen: answer.customOpen || directCustom,
                      })}
                    />
                  ) : null}
                </section>
              );
            })}
          </div>

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

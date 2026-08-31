"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import styles from "./asympta-adaptive-interaction.module.css";

import { readAdaptiveActivityIntent } from "@/lib/asympta-adaptive-activity-bridge";
import { ASYMPTA_TASK_KERNEL_EVENT } from "@/lib/asympta-browser-task-kernel";
import {
  missingFieldsFromAdaptiveActivityData,
  type AdaptiveAnswerValue,
  type AdaptiveInteractionLocale,
  type AdaptiveInteractionSchema,
} from "@/lib/asympta-adaptive-interaction";
import type { AsymptaTaskKernelEventDetail, AsymptaTaskState } from "@/lib/asympta-task-kernel-types";

type ActivityDetail = {
  activity?: { id?: string; intent?: unknown; status?: string };
  event?: { status?: string; summary?: string; data?: unknown };
};

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
    unavailable: "The Task Kernel is not ready yet. Try again in a moment.",
    confirmed: "User-confirmed",
  },
  "zh-Hant": {
    eyebrow: "下一個必要選擇",
    title: "讓 Asympta 繼續",
    other: "其他",
    continue: "繼續",
    continuing: "正在繼續…",
    unavailable: "Task Kernel 暫時未準備好，請稍後再試。",
    confirmed: "由你確認",
  },
  ja: {
    eyebrow: "次に必要な選択",
    title: "Asympta を続ける",
    other: "その他",
    continue: "続ける",
    continuing: "続行中…",
    unavailable: "Task Kernel の準備ができていません。少し待って再試行してください。",
    confirmed: "ユーザー確認済み",
  },
};

function localeFromDocument(): AdaptiveInteractionLocale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function answerReady(schema: AdaptiveInteractionSchema | null, selected: AdaptiveAnswerValue | null, custom: string) {
  const field = schema?.nextField;
  if (!field) return false;
  if (field.control === "text") return custom.trim().length > 0;
  if (field.control === "number") return custom.trim().length > 0 && Number.isFinite(Number(custom));
  return selected !== null || custom.trim().length > 0;
}

function dataTaskId(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const value = Reflect.get(data, "taskId");
  return typeof value === "string" ? value : "";
}

function randomCommandId(taskId: string, requirementId: string) {
  const suffix = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${taskId}:answer:${requirementId}:${suffix}`;
}

function terminalTask(task: AsymptaTaskState) {
  return ["completed", "cancelled", "blocked", "failed"].includes(task.phase);
}

export function AsymptaAdaptiveInteraction() {
  const [locale, setLocale] = useState<AdaptiveInteractionLocale>("en");
  const [schema, setSchema] = useState<AdaptiveInteractionSchema | null>(null);
  const [selected, setSelected] = useState<AdaptiveAnswerValue | null>(null);
  const [custom, setCustom] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taskIdRef = useRef("");
  const activityIdRef = useRef("");

  useEffect(() => {
    const syncLocale = () => setLocale(localeFromDocument());
    queueMicrotask(syncLocale);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const showTask = (task: AsymptaTaskState | null) => {
      const bridge = window.__ASYMPTA_TASK_KERNEL__;
      if (!task || !bridge || terminalTask(task)) {
        setSchema(null);
        return;
      }
      const nextSchema = bridge.schema(task.taskId);
      if (!nextSchema?.nextField) {
        setSchema(null);
        return;
      }
      taskIdRef.current = task.taskId;
      setSchema(nextSchema);
      setSelected(null);
      setCustom("");
      setCustomOpen(false);
      setContinuing(false);
      setError(null);
    };

    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      const status = detail?.event?.status ?? detail?.activity?.status ?? "";
      const activityId = detail?.activity?.id ?? "";

      if (status === "interpreting" && activityId && activityIdRef.current && activityId !== activityIdRef.current) {
        activityIdRef.current = activityId;
        taskIdRef.current = "";
        setSchema(null);
        setError(null);
      }

      if (status === "waiting_input") {
        const bridge = window.__ASYMPTA_TASK_KERNEL__;
        const rootIntent = readAdaptiveActivityIntent(detail?.activity);
        const missingFields = missingFieldsFromAdaptiveActivityData(detail?.event?.data);
        if (!bridge || !rootIntent || !missingFields.length) return;
        activityIdRef.current = activityId;
        const requestedTaskId = dataTaskId(detail?.event?.data);
        const task = (requestedTaskId ? bridge.getTask(requestedTaskId) : null)
          ?? (activityId ? bridge.getTaskByActivity(activityId) : null)
          ?? bridge.createFromClarification({
            activityId: activityId || null,
            rootIntent,
            locale,
            title: rootIntent,
            summary: detail?.event?.summary ?? rootIntent,
            missingFields,
            mode: "simulated",
          });
        showTask(task);
        return;
      }

      if (["completed", "failed", "blocked"].includes(status)
        && activityIdRef.current
        && activityId === activityIdRef.current) {
        setSchema(null);
        setSelected(null);
        setCustom("");
        setCustomOpen(false);
        setContinuing(false);
      }
    };

    const onKernel = (event: Event) => {
      const detail = (event as CustomEvent<AsymptaTaskKernelEventDetail>).detail;
      if (!detail?.task?.taskId || detail.task.taskId !== taskIdRef.current) return;
      showTask(detail.task);
    };

    window.addEventListener("asympta:activity", onActivity);
    window.addEventListener(ASYMPTA_TASK_KERNEL_EVENT, onKernel);
    return () => {
      window.removeEventListener("asympta:activity", onActivity);
      window.removeEventListener(ASYMPTA_TASK_KERNEL_EVENT, onKernel);
    };
  }, [locale]);

  const field = schema?.nextField ?? null;
  if (!schema || !field) return null;

  const copy = COPY[locale];
  const ready = answerReady(schema, selected, custom);
  const showDirectCustomInput = field.key === "event_intent";

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || continuing) return;

    const bridge = window.__ASYMPTA_TASK_KERNEL__;
    const taskId = taskIdRef.current;
    const task = bridge?.getTask(taskId);
    if (!bridge || !task) {
      setError(copy.unavailable);
      return;
    }

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

    setContinuing(true);
    setError(null);
    try {
      const next = bridge.answerRequirement({
        commandId: randomCommandId(task.taskId, field.id),
        taskId: task.taskId,
        requirementId: field.id,
        expectedRevision: task.revision,
        value,
        label,
        actorId: "human",
      });
      const nextSchema = terminalTask(next) ? null : bridge.schema(next.taskId);
      setSchema(nextSchema?.nextField ? nextSchema : null);
      setSelected(null);
      setCustom("");
      setCustomOpen(false);
    } catch (taskError) {
      const latest = bridge.getTask(task.taskId);
      if (latest && !terminalTask(latest)) {
        const latestSchema = bridge.schema(latest.taskId);
        setSchema(latestSchema?.nextField ? latestSchema : null);
      }
      setError(taskError instanceof Error ? taskError.message : copy.unavailable);
    } finally {
      setContinuing(false);
    }
  };

  const currentTask = window.__ASYMPTA_TASK_KERNEL__?.getTask(taskIdRef.current) ?? null;

  return (
    <aside
      className={styles.shell}
      data-asympta-adaptive-schema={schema.schemaVersion}
      data-field={field.key}
      data-provenance={schema.provenance.mode}
      data-task-id={taskIdRef.current}
      data-task-revision={currentTask?.revision ?? ""}
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
              onChange={(inputEvent) => {
                setCustom(inputEvent.target.value);
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

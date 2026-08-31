"use client";

import { ArrowRight, Check, ShieldAlert, Sparkles } from "lucide-react";
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
import type {
  AsymptaTaskApproval,
  AsymptaTaskKernelEventDetail,
  AsymptaTaskState,
} from "@/lib/asympta-task-kernel-types";

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
  approvalEyebrow: string;
  approvalTitle: string;
  approve: string;
  reject: string;
  approving: string;
}> = {
  en: {
    eyebrow: "Next necessary choice",
    title: "Help Asympta continue",
    other: "Something else",
    continue: "Continue",
    continuing: "Continuing…",
    unavailable: "The Task Kernel is not ready yet. Try again in a moment.",
    confirmed: "User-confirmed",
    approvalEyebrow: "High-impact confirmation",
    approvalTitle: "Confirm before Asympta continues",
    approve: "Confirm and continue",
    reject: "Do not continue",
    approving: "Resuming…",
  },
  "zh-Hant": {
    eyebrow: "下一個必要選擇",
    title: "讓 Asympta 繼續",
    other: "其他",
    continue: "繼續",
    continuing: "正在繼續…",
    unavailable: "Task Kernel 暫時未準備好，請稍後再試。",
    confirmed: "由你確認",
    approvalEyebrow: "高影響行動確認",
    approvalTitle: "確認後讓 Asympta 自動繼續",
    approve: "確認並繼續",
    reject: "不要繼續",
    approving: "正在恢復執行…",
  },
  ja: {
    eyebrow: "次に必要な選択",
    title: "Asympta を続ける",
    other: "その他",
    continue: "続ける",
    continuing: "続行中…",
    unavailable: "Task Kernel の準備ができていません。少し待って再試行してください。",
    confirmed: "ユーザー確認済み",
    approvalEyebrow: "重要操作の確認",
    approvalTitle: "確認後に Asympta を自動再開",
    approve: "確認して続ける",
    reject: "続けない",
    approving: "再開中…",
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

function randomCommandId(taskId: string, action: string) {
  const suffix = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${taskId}:${action}:${suffix}`;
}

function terminalTask(task: AsymptaTaskState) {
  return task.phase === "completed" || task.phase === "cancelled";
}

function pendingApproval(task: AsymptaTaskState | null): AsymptaTaskApproval | null {
  return task?.approvals.find((approval) => approval.status === "pending") ?? null;
}

export function AsymptaAdaptiveInteraction() {
  const [locale, setLocale] = useState<AdaptiveInteractionLocale>("en");
  const [taskState, setTaskState] = useState<AsymptaTaskState | null>(null);
  const [schema, setSchema] = useState<AdaptiveInteractionSchema | null>(null);
  const [taskId, setTaskId] = useState("");
  const [taskRevision, setTaskRevision] = useState<number | null>(null);
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
        setTaskState(task);
        setSchema(null);
        setTaskRevision(task?.revision ?? null);
        setSelected(null);
        setCustom("");
        setCustomOpen(false);
        setContinuing(false);
        return;
      }

      taskIdRef.current = task.taskId;
      setTaskId(task.taskId);
      setTaskRevision(task.revision);
      setTaskState(task);
      const nextSchema = bridge.schema(task.taskId);
      setSchema(nextSchema?.nextField ? nextSchema : null);
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
      const bridge = window.__ASYMPTA_TASK_KERNEL__;

      if (status === "interpreting" && activityId && activityIdRef.current && activityId !== activityIdRef.current) {
        activityIdRef.current = activityId;
        taskIdRef.current = "";
        setTaskId("");
        setTaskState(null);
        setSchema(null);
        setTaskRevision(null);
        setError(null);
      }

      const requestedTaskId = dataTaskId(detail?.event?.data);
      const existing = bridge && ((requestedTaskId ? bridge.getTask(requestedTaskId) : null)
        ?? (activityId ? bridge.getTaskByActivity(activityId) : null));
      if (existing) {
        activityIdRef.current = activityId;
        showTask(existing);
        return;
      }

      if (status === "waiting_input") {
        const rootIntent = readAdaptiveActivityIntent(detail?.activity);
        const missingFields = missingFieldsFromAdaptiveActivityData(detail?.event?.data);
        if (!bridge || !rootIntent || !missingFields.length) return;
        activityIdRef.current = activityId;
        const task = bridge.createFromClarification({
          activityId: activityId || null,
          rootIntent,
          locale,
          title: rootIntent,
          summary: detail?.event?.summary ?? rootIntent,
          missingFields,
          mode: "simulated",
        });
        showTask(task);
      }
    };

    const onKernel = (event: Event) => {
      const detail = (event as CustomEvent<AsymptaTaskKernelEventDetail>).detail;
      if (!detail?.task?.taskId) return;
      const sameTask = detail.task.taskId === taskIdRef.current;
      const sameActivity = Boolean(detail.task.activityId && detail.task.activityId === activityIdRef.current);
      if (!sameTask && !sameActivity && taskIdRef.current) return;
      showTask(detail.task);
    };

    window.addEventListener("asympta:activity", onActivity);
    window.addEventListener(ASYMPTA_TASK_KERNEL_EVENT, onKernel);
    return () => {
      window.removeEventListener("asympta:activity", onActivity);
      window.removeEventListener(ASYMPTA_TASK_KERNEL_EVENT, onKernel);
    };
  }, [locale]);

  const copy = COPY[locale];
  const approval = pendingApproval(taskState);
  const field = schema?.nextField ?? null;

  const decideApproval = (approved: boolean) => {
    if (!approval || continuing) return;
    const bridge = window.__ASYMPTA_TASK_KERNEL__;
    const task = bridge?.getTask(taskIdRef.current);
    if (!bridge || !task) {
      setError(copy.unavailable);
      return;
    }
    setContinuing(true);
    setError(null);
    try {
      const next = bridge.approve({
        commandId: randomCommandId(task.taskId, approved ? "approve" : "reject"),
        taskId: task.taskId,
        approvalId: approval.id,
        expectedRevision: task.revision,
        approved,
        actorId: "human",
      });
      setTaskState(next);
      setTaskRevision(next.revision);
      const nextSchema = terminalTask(next) ? null : bridge.schema(next.taskId);
      setSchema(nextSchema?.nextField ? nextSchema : null);
    } catch (taskError) {
      const latest = bridge.getTask(task.taskId);
      if (latest) {
        setTaskState(latest);
        setTaskRevision(latest.revision);
        const latestSchema = terminalTask(latest) ? null : bridge.schema(latest.taskId);
        setSchema(latestSchema?.nextField ? latestSchema : null);
      }
      setError(taskError instanceof Error ? taskError.message : copy.unavailable);
    } finally {
      setContinuing(false);
    }
  };

  if (taskState && approval && taskState.phase === "awaiting_approval") {
    return (
      <aside
        className={styles.shell}
        data-asympta-adaptive-schema="asympta.approval-ui.v1"
        data-field="high_risk_confirmation"
        data-provenance="task_kernel_policy"
        data-task-id={taskState.taskId}
        data-task-revision={taskState.revision}
        aria-label={copy.approvalTitle}
      >
        <div className={styles.card}>
          <header className={styles.header}>
            <span className={styles.eyebrow}><ShieldAlert size={12} aria-hidden="true" />{copy.approvalEyebrow}</span>
            <span className={styles.provenance}><Check size={11} aria-hidden="true" />{copy.confirmed}</span>
          </header>
          <div className={styles.question}>
            <span>{copy.approvalTitle}</span>
            <strong>{approval.prompt}</strong>
            <p>{approval.consequence}</p>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.options} role="group" aria-label={approval.prompt}>
            <button
              className={styles.continue}
              type="button"
              disabled={continuing}
              onClick={() => decideApproval(true)}
            >
              <span>{continuing ? copy.approving : copy.approve}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
            <button
              className={styles.option}
              type="button"
              disabled={continuing}
              onClick={() => decideApproval(false)}
            >
              <span>{copy.reject}</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (!schema || !field) return null;

  const ready = answerReady(schema, selected, custom);
  const showDirectCustomInput = field.key === "event_intent";
  const customInputVisible = field.control === "text"
    || field.control === "number"
    || customOpen
    || showDirectCustomInput;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || continuing) return;

    const bridge = window.__ASYMPTA_TASK_KERNEL__;
    const currentTaskId = taskIdRef.current;
    const task = bridge?.getTask(currentTaskId);
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
        commandId: randomCommandId(task.taskId, `answer:${field.id}`),
        taskId: task.taskId,
        requirementId: field.id,
        expectedRevision: task.revision,
        value,
        label,
        actorId: "human",
      });
      setTaskState(next);
      setTaskRevision(next.revision);
      const nextSchema = terminalTask(next) ? null : bridge.schema(next.taskId);
      setSchema(nextSchema?.nextField ? nextSchema : null);
      setSelected(null);
      setCustom("");
      setCustomOpen(false);
    } catch (taskError) {
      const latest = bridge.getTask(task.taskId);
      if (latest && !terminalTask(latest)) {
        const latestSchema = bridge.schema(latest.taskId);
        setTaskState(latest);
        setSchema(latestSchema?.nextField ? latestSchema : null);
        setTaskRevision(latest.revision);
      }
      setError(taskError instanceof Error ? taskError.message : copy.unavailable);
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
      data-task-id={taskId}
      data-task-revision={taskRevision ?? ""}
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
                  data-description={candidate.description || undefined}
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

          {field.control === "text" || field.control === "number" || field.allowCustom || showDirectCustomInput ? (
            <input
              className={styles.input}
              type={field.control === "number" ? "number" : "text"}
              inputMode={field.control === "number" ? "numeric" : "text"}
              min={field.control === "number" ? 1 : undefined}
              hidden={!customInputVisible}
              aria-hidden={!customInputVisible}
              autoFocus={customInputVisible && (field.control === "text"
                || field.control === "number"
                || (customOpen && !showDirectCustomInput))}
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

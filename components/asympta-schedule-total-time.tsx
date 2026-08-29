"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  estimateWorkflowRemainingMs,
  type LiveAgentTimingState,
  type LiveTaskTimingState,
} from "@/lib/atlas-workflow-time";

type Locale = "en" | "zh-Hant" | "ja";
type ForegroundSnapshot = {
  phase?: string;
  workflow?: string | null;
  tasks?: LiveTaskTimingState[];
  agents?: LiveAgentTimingState[];
};
type Snapshot = { foreground?: ForegroundSnapshot };

const COPY: Record<Locale, { label: string; title: string }> = {
  en: {
    label: "Est. total",
    title: "Live remaining simulation time. Recalculated from task completion, task progress and agent travel. Human approval wait time is not included.",
  },
  "zh-Hant": {
    label: "預估總時間",
    title: "即時剩餘模擬時間；會按小任務完成、任務進度及角色移動重新計算，不包含等待人工批准的時間。",
  },
  ja: {
    label: "推定合計",
    title: "残りのシミュレーション時間を、各タスクの完了・進捗・エージェント移動から再計算します。人による承認待ち時間は含みません。",
  },
};

function currentLocale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes <= 0) return `~${remainder}s`;
  return `~${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function fingerprint(foreground: ForegroundSnapshot | undefined) {
  if (!foreground?.workflow) return "";
  const tasks = (foreground.tasks ?? [])
    .map((task) => `${task.id}:${task.status}:${Number(task.progress).toFixed(3)}:${task.approvalStatus ?? ""}`)
    .join("|");
  const agents = (foreground.agents ?? [])
    .map((agent) => `${agent.id}:${Number(agent.lon).toFixed(5)}:${Number(agent.lat).toFixed(5)}`)
    .join("|");
  return `${foreground.workflow}:${foreground.phase ?? ""}:${tasks}:${agents}`;
}

export function AsymptaScheduleTotalTime() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [foreground, setForeground] = useState<ForegroundSnapshot | null>(null);
  const observedApprovalsRef = useRef(new Set<string>());
  const workflowRef = useRef<string | null>(null);

  useEffect(() => {
    let lastFingerprint = "";
    const sync = () => {
      if (document.hidden) return;
      const nextTarget = document.querySelector<HTMLElement>(".atlas-safe-schedule__summary");
      setTarget((current) => current === nextTarget ? current : nextTarget);

      const nextLocale = currentLocale();
      setLocale((current) => current === nextLocale ? current : nextLocale);

      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const rawForeground = snapshot?.foreground;
      if (!rawForeground?.workflow) {
        observedApprovalsRef.current.clear();
        workflowRef.current = null;
        setForeground(null);
        return;
      }

      const noCompletedTasks = (rawForeground.tasks ?? []).every((task) => task.status !== "done");
      if (workflowRef.current !== rawForeground.workflow || noCompletedTasks) {
        observedApprovalsRef.current.clear();
        workflowRef.current = rawForeground.workflow;
      }
      for (const task of rawForeground.tasks ?? []) {
        if (task.status === "waiting_approval") observedApprovalsRef.current.add(task.id);
      }
      const nextForeground: ForegroundSnapshot = {
        ...rawForeground,
        tasks: (rawForeground.tasks ?? []).map((task) =>
          observedApprovalsRef.current.has(task.id) && task.status === "moving"
            ? { ...task, approvalStatus: "approved" }
            : task,
        ),
      };
      const nextFingerprint = fingerprint(nextForeground);
      if (nextFingerprint === lastFingerprint) return;
      lastFingerprint = nextFingerprint;
      setForeground(nextForeground?.workflow ? nextForeground : null);
    };

    sync();
    const timer = window.setInterval(sync, 250);
    return () => window.clearInterval(timer);
  }, []);

  if (!target || !foreground?.workflow) return null;
  const remainingMs = foreground.phase === "completed"
    ? 0
    : estimateWorkflowRemainingMs(foreground.workflow, {
        tasks: foreground.tasks,
        agents: foreground.agents,
      });
  const copy = COPY[locale];

  return createPortal(
    <span
      className="atlas-safe-total-time"
      title={copy.title}
      aria-label={`${copy.label} ${formatDuration(remainingMs)}`}
      data-live-remaining="true"
    >
      <span>{copy.label}</span>
      <strong>{formatDuration(remainingMs)}</strong>
    </span>,
    target,
  );
}

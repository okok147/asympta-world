"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { estimateWorkflowTotalMs } from "@/lib/atlas-workflow-time";

type Locale = "en" | "zh-Hant" | "ja";
type Snapshot = { foreground?: { workflow?: string | null } };

const COPY: Record<Locale, { label: string; title: string }> = {
  en: { label: "Est. total", title: "Estimated total simulation time. Human approval wait time is not included." },
  "zh-Hant": { label: "預估總時間", title: "整個模擬流程的預估總時間；不包含等待人工批准的時間。" },
  ja: { label: "推定合計", title: "シミュレーション全体の推定時間です。人による承認待ち時間は含みません。" },
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

export function AsymptaScheduleTotalTime() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [workflow, setWorkflow] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      if (document.hidden) return;
      const nextTarget = document.querySelector<HTMLElement>(".atlas-safe-schedule__summary");
      setTarget((current) => current === nextTarget ? current : nextTarget);

      const nextLocale = currentLocale();
      setLocale((current) => current === nextLocale ? current : nextLocale);

      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const nextWorkflow = snapshot?.foreground?.workflow ?? null;
      setWorkflow((current) => current === nextWorkflow ? current : nextWorkflow);
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, []);

  if (!target || !workflow) return null;
  const totalMs = estimateWorkflowTotalMs(workflow);
  if (totalMs <= 0) return null;
  const copy = COPY[locale];

  return createPortal(
    <span className="atlas-safe-total-time" title={copy.title} aria-label={`${copy.label} ${formatDuration(totalMs)}`}>
      <span>{copy.label}</span>
      <strong>{formatDuration(totalMs)}</strong>
    </span>,
    target,
  );
}

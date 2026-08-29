"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { resourceDeltaForTask, workflowTaskExchange } from "@/lib/atlas-workflow-expansion";

type Locale = "en" | "zh-Hant" | "ja";
type MetricKey = "budget" | "materials" | "inventory" | "capacity" | "compute" | "delivery" | "trust";
type TaskSnapshot = { id: string; title?: string; agentId: string; status: string; progress: number; dependencies?: string[] };
type AgentSnapshot = { id: string; side: string };
type Foreground = { workflow?: string | null; phase?: string; tasks?: TaskSnapshot[]; agents?: AgentSnapshot[] };
type Snapshot = { foreground?: Foreground };
type Metric = { key: MetricKey; value: string };
type Handoff = { summary: string; detail: string };

const COPY: Record<Locale, Record<MetricKey, string>> = {
  en: { budget: "Budget", materials: "Materials", inventory: "Inventory", capacity: "Capacity", compute: "Compute", delivery: "Delivery", trust: "Trust" },
  "zh-Hant": { budget: "資金", materials: "物料", inventory: "庫存", capacity: "產能", compute: "算力", delivery: "配送", trust: "信任" },
  ja: { budget: "予算", materials: "資材", inventory: "在庫", capacity: "能力", compute: "計算力", delivery: "配送", trust: "信頼" },
};
const FLOW_LABEL: Record<Locale, string> = { en: "Latest exchange", "zh-Hant": "最新交接", ja: "最新の引継ぎ" };
const SIDE: Record<Locale, Record<string, string>> = {
  en: { user: "User", customer: "Customer", business: "Business", supplier: "Supplier", operations: "Operations", finance: "Finance", logistics: "Logistics", support: "Support", quality: "Quality", market: "Market" },
  "zh-Hant": { user: "使用者", customer: "客戶", business: "商戶", supplier: "供應", operations: "營運", finance: "財務", logistics: "物流", support: "支援", quality: "品質", market: "市場" },
  ja: { user: "ユーザー", customer: "顧客", business: "事業", supplier: "供給", operations: "運用", finance: "財務", logistics: "物流", support: "サポート", quality: "品質", market: "市場" },
};

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

// A resource transfer is booked only once the task actually starts. Approval waiting and travel
// never pre-spend budget, reserve capacity or move inventory in the ledger.
function fraction(task: TaskSnapshot) {
  if (task.status === "done") return 1;
  if (task.status === "working") return Math.max(0, Math.min(1, Number(task.progress) || 0));
  return 0;
}

function compactMoney(value: number) {
  return Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${Math.round(value)}`;
}

function metrics(foreground: Foreground): Metric[] {
  let budget = 120_000;
  let materials = 46;
  let inventory = 34;
  let capacity = 10;
  let compute = 0;
  let delivery = 0;
  let trust = 64;

  for (const task of foreground.tasks ?? []) {
    const delta = resourceDeltaForTask(task.id);
    const p = fraction(task);
    if (!delta || p <= 0) continue;
    budget += (delta.budget ?? 0) * p;
    materials += (delta.materials ?? 0) * p;
    inventory += (delta.inventory ?? 0) * p;
    capacity += (delta.capacity ?? 0) * p;
    compute += (delta.compute ?? 0) * p;
    delivery += (delta.delivery ?? 0) * p;
    trust += (delta.trust ?? 0) * p;
  }
  if (foreground.phase === "blocked") trust -= 8;
  materials = Math.max(0, materials);
  inventory = Math.max(0, inventory);
  capacity = Math.max(0, capacity);
  trust = Math.max(0, Math.min(100, trust));

  return [
    { key: "budget", value: compactMoney(budget) },
    { key: "materials", value: `${Math.round(materials)}u` },
    { key: "inventory", value: `${Math.round(inventory)}u` },
    { key: "capacity", value: `${capacity.toFixed(1)} slots` },
    { key: "compute", value: `${Math.round(compute)} CU` },
    { key: "delivery", value: `${delivery.toFixed(1)} legs` },
    { key: "trust", value: `${Math.round(trust)} pts` },
  ];
}

function handoffFor(task: TaskSnapshot, foreground: Foreground, language: Locale): Handoff | null {
  const exchange = workflowTaskExchange(task.id);
  if (!exchange) return null;
  const agents = new Map((foreground.agents ?? []).map((agent) => [agent.id, agent.side]));
  const from = SIDE[language][agents.get(task.agentId) ?? ""] ?? "Agent";
  const recipients = (foreground.tasks ?? [])
    .filter((candidate) => candidate.dependencies?.includes(task.id))
    .map((candidate) => SIDE[language][agents.get(candidate.agentId) ?? ""] ?? "Agent")
    .filter((value, index, all) => all.indexOf(value) === index);
  const route = recipients.length ? `${from} → ${recipients.join(" / ")}` : from;
  return { summary: `${route} · ${task.title ?? task.id}`, detail: exchange.handoff };
}

export function AsymptaResourceLedger() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [language, setLanguage] = useState<Locale>("en");
  const [values, setValues] = useState<Metric[]>([]);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const completedRef = useRef(new Set<string>());
  const workflowRef = useRef<string | null>(null);

  useEffect(() => {
    let fingerprint = "";
    const sync = () => {
      if (document.hidden) return;
      setTarget(document.querySelector<HTMLElement>(".atlas-status-stack"));
      const nextLanguage = locale();
      setLanguage(nextLanguage);

      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const foreground = snapshot?.foreground;
      if (!foreground) return;
      if (workflowRef.current !== (foreground.workflow ?? null)) {
        workflowRef.current = foreground.workflow ?? null;
        completedRef.current.clear();
        setHandoff(null);
      }

      for (const task of foreground.tasks ?? []) {
        if (task.status !== "done" || completedRef.current.has(task.id)) continue;
        completedRef.current.add(task.id);
        setHandoff(handoffFor(task, foreground, nextLanguage));
      }

      const next = metrics(foreground);
      const nextFingerprint = next.map((metric) => `${metric.key}:${metric.value}`).join("|");
      if (nextFingerprint !== fingerprint) {
        fingerprint = nextFingerprint;
        setValues(next);
      }
    };

    sync();
    const timer = window.setInterval(sync, 350);
    return () => window.clearInterval(timer);
  }, []);

  if (!target || !values.length) return null;
  return createPortal(
    <section className="atlas-resource-ledger" aria-label={language === "zh-Hant" ? "模擬資源帳本" : language === "ja" ? "シミュレーション資源台帳" : "Simulated resource ledger"}>
      {handoff ? (
        <div className="atlas-resource-chip" data-resource="exchange" title={handoff.detail}>
          <span>{FLOW_LABEL[language]}</span><strong>{handoff.summary}</strong>
        </div>
      ) : null}
      {values.map((metric) => (
        <div key={metric.key} className="atlas-resource-chip" data-resource={metric.key} title={COPY[language][metric.key]}>
          <span>{COPY[language][metric.key]}</span><strong>{metric.value}</strong>
        </div>
      ))}
    </section>,
    target,
  );
}

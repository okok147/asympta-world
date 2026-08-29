"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Locale = "en" | "zh-Hant" | "ja";
type MetricKey = "budget" | "materials" | "inventory" | "capacity" | "compute" | "delivery" | "trust";

type TaskSnapshot = {
  id: string;
  agentId: string;
  status: string;
  progress: number;
  actionType: string | null;
};

type AgentSnapshot = { id: string; side: string };
type Snapshot = {
  foreground?: {
    phase?: string;
    tasks?: TaskSnapshot[];
    agents?: AgentSnapshot[];
  };
};

type Metric = { key: MetricKey; value: string; raw: number };

const REFRESH_MS = 500;
const COPY: Record<Locale, Record<MetricKey, string>> = {
  en: { budget: "Budget", materials: "Materials", inventory: "Inventory", capacity: "Capacity", compute: "Compute", delivery: "Delivery", trust: "Trust" },
  "zh-Hant": { budget: "資金", materials: "物料", inventory: "庫存", capacity: "產能", compute: "算力", delivery: "配送", trust: "信任" },
  ja: { budget: "予算", materials: "資材", inventory: "在庫", capacity: "能力", compute: "計算力", delivery: "配送", trust: "信頼" },
};

const SIDE_COST: Record<string, number> = {
  user: 180, customer: 140, business: 760, supplier: 920, operations: 1_050,
  finance: 520, logistics: 690, support: 260, quality: 430, market: 360,
};
const SIDE_COMPUTE: Record<string, number> = {
  user: 2, customer: 2, business: 5, supplier: 3, operations: 5,
  finance: 6, logistics: 3, support: 2, quality: 4, market: 7,
};

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function taskFraction(task: TaskSnapshot) {
  if (task.status === "done") return 1;
  if (task.status === "working") return Math.max(0.08, Math.min(0.96, Number(task.progress) || 0));
  if (task.status === "waiting_approval") return 0.42;
  if (task.status === "moving") return 0.08;
  if (task.status === "blocked") return 0.5;
  return 0;
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

function computeMetrics(snapshot: Snapshot): Metric[] {
  const foreground = snapshot.foreground;
  const tasks = foreground?.tasks ?? [];
  const agents = new Map((foreground?.agents ?? []).map((agent) => [agent.id, agent]));

  let budget = 120_000;
  let materials = 46;
  let inventory = 34;
  let capacity = 10;
  let compute = 0;
  let delivery = 0;
  let trust = 64;

  for (const task of tasks) {
    const fraction = taskFraction(task);
    if (fraction <= 0) continue;
    const side = agents.get(task.agentId)?.side ?? "";

    budget -= (SIDE_COST[side] ?? 300) * fraction;
    compute += (SIDE_COMPUTE[side] ?? 3) * fraction;

    if (side === "supplier") {
      materials += 4.5 * fraction;
      inventory += 2.2 * fraction;
      capacity += 0.8 * fraction;
    } else if (side === "operations") {
      materials -= 2.2 * fraction;
      inventory += 2.6 * fraction;
      capacity -= 0.45 * fraction;
    } else if (side === "logistics") {
      inventory -= 1.4 * fraction;
      delivery += 0.55 * fraction;
    } else if (side === "quality") {
      trust += 2.4 * fraction;
    } else if (side === "support") {
      trust += 3.1 * fraction;
    } else if (side === "customer") {
      trust += 1.8 * fraction;
    } else if (side === "business") {
      trust += 0.6 * fraction;
      capacity += 0.25 * fraction;
    }

    // Consequential demo actions have explicit countable effects in addition to their
    // stakeholder-side work. Values are simulated accounting units, not real transactions.
    if (task.actionType === "reserve_capacity") {
      capacity += 5 * fraction;
      materials += 2 * fraction;
      budget -= 3_200 * fraction;
    } else if (task.actionType === "authorize_payment") {
      budget -= 7_200 * fraction;
      trust += 1.2 * fraction;
    } else if (task.actionType === "release_shipment") {
      inventory -= 4 * fraction;
      delivery += 1.2 * fraction;
    } else if (task.actionType === "send_customer_update") {
      trust += 3.8 * fraction;
    }
  }

  if (foreground?.phase === "blocked") trust -= 8;

  materials = Math.max(0, materials);
  inventory = Math.max(0, inventory);
  capacity = Math.max(0, capacity);
  trust = Math.max(0, Math.min(100, trust));

  return [
    { key: "budget", value: compactMoney(budget), raw: budget },
    { key: "materials", value: `${Math.round(materials)}u`, raw: materials },
    { key: "inventory", value: `${Math.round(inventory)}u`, raw: inventory },
    { key: "capacity", value: `${capacity.toFixed(1)} slots`, raw: capacity },
    { key: "compute", value: `${Math.round(compute)} CU`, raw: compute },
    { key: "delivery", value: `${delivery.toFixed(1)} legs`, raw: delivery },
    { key: "trust", value: `${Math.round(trust)} pts`, raw: trust },
  ];
}

export function AsymptaResourceLedger() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [language, setLanguage] = useState<Locale>("en");
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    let fingerprint = "";
    const sync = () => {
      if (document.hidden) return;
      const nextTarget = document.querySelector<HTMLElement>(".atlas-status-stack");
      setTarget((current) => current === nextTarget ? current : nextTarget);
      const nextLocale = locale();
      setLanguage((current) => current === nextLocale ? current : nextLocale);

      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      if (!snapshot?.foreground) return;
      const next = computeMetrics(snapshot);
      const nextFingerprint = next.map((metric) => `${metric.key}:${metric.value}`).join("|");
      if (nextFingerprint === fingerprint) return;
      fingerprint = nextFingerprint;
      setMetrics(next);
    };

    sync();
    const timer = window.setInterval(sync, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (!target || !metrics.length) return null;
  return createPortal(
    <section className="atlas-resource-ledger" aria-label={language === "zh-Hant" ? "模擬資源帳本" : language === "ja" ? "シミュレーション資源台帳" : "Simulated resource ledger"}>
      {metrics.map((metric) => (
        <div key={metric.key} className="atlas-resource-chip" data-resource={metric.key} title={COPY[language][metric.key]}>
          <span>{COPY[language][metric.key]}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </section>,
    target,
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { workflowTaskExchange } from "@/lib/atlas-workflow-expansion";

type Locale = "en" | "zh-Hant" | "ja";
type MetricKey = "budget" | "materials" | "inventory" | "capacity" | "compute" | "delivery" | "trust";
type TaskSnapshot = { id: string; title?: string; agentId: string; status: string; progress: number; dependencies?: string[] };
type AgentSnapshot = { id: string; side: string };
type RuntimeAccount = { ownerId: string; currency?: string; balance: number };
type RuntimeInventory = { ownerId: string; resourceId: string; onHand: number; reserved: number; inTransit: number };
type RuntimeCapacity = { ownerId: string; capacityId: string; total: number; reserved: number; unit: string };
type RuntimeOrder = { buyerId?: string; sellerId?: string; supplierId?: string; courierId?: string; resourceId?: string };
type RuntimeMetrics = { failedIntents?: number; commitmentViolations?: number };
type RuntimeSnapshot = {
  order?: RuntimeOrder | null;
  accounts?: RuntimeAccount[];
  inventories?: RuntimeInventory[];
  capacities?: RuntimeCapacity[];
  metrics?: RuntimeMetrics;
  invariantViolations?: string[];
};
type Foreground = {
  workflow?: string | null;
  phase?: string;
  tasks?: TaskSnapshot[];
  agents?: AgentSnapshot[];
  runtime?: RuntimeSnapshot;
};
type Snapshot = { foreground?: Foreground };
type Metric = { key: MetricKey; value: string };
type Handoff = { summary: string; detail: string };

const REFRESH_MS = 500;
const COPY: Record<Locale, Record<MetricKey, string>> = {
  en: { budget: "Budget", materials: "Materials", inventory: "Inventory", capacity: "Capacity", compute: "Machine", delivery: "Delivery", trust: "Reliability" },
  "zh-Hant": { budget: "資金", materials: "物料", inventory: "庫存", capacity: "產能", compute: "機台", delivery: "配送", trust: "可靠度" },
  ja: { budget: "予算", materials: "資材", inventory: "在庫", capacity: "能力", compute: "設備", delivery: "配送", trust: "信頼度" },
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

function compactMoney(value: number, currency = "JPY") {
  const sign = currency === "JPY" ? "¥" : `${currency} `;
  if (Math.abs(value) >= 1000) return `${sign}${(value / 1000).toFixed(1)}k`;
  return `${sign}${Math.round(value)}`;
}

function availableCapacity(item: RuntimeCapacity) {
  return Math.max(0, Number(item.total) - Number(item.reserved));
}

function availableStock(item: RuntimeInventory) {
  return Math.max(0, Number(item.onHand) - Number(item.reserved));
}

function metrics(foreground: Foreground): Metric[] {
  const runtime = foreground.runtime;
  if (!runtime) return [];

  const accounts = runtime.accounts ?? [];
  const inventories = runtime.inventories ?? [];
  const capacities = runtime.capacities ?? [];
  const order = runtime.order ?? null;
  const resourceId = order?.resourceId ?? inventories[0]?.resourceId;
  const buyerId = order?.buyerId ?? "agent-customer";
  const sellerId = order?.sellerId ?? "agent-business";

  const budgetAccount = accounts.find((item) => item.ownerId === buyerId)
    ?? accounts.find((item) => item.ownerId === "agent-user")
    ?? accounts[0];

  const materials = inventories
    .filter((item) => (!resourceId || item.resourceId === resourceId) && /supplier/i.test(item.ownerId))
    .reduce((total, item) => total + availableStock(item), 0);

  const inventory = inventories
    .filter((item) => (!resourceId || item.resourceId === resourceId) && (item.ownerId === buyerId || item.ownerId === sellerId))
    .reduce((total, item) => total + Math.max(0, Number(item.onHand)), 0);

  const fulfilment = capacities
    .filter((item) => item.capacityId === "fulfilment")
    .reduce((total, item) => total + availableCapacity(item), 0);

  const machine = capacities.find((item) => item.ownerId === "agent-operations" || item.capacityId === "machine-hour");
  const delivery = capacities.find((item) => item.ownerId === (order?.courierId ?? "agent-logistics") && item.capacityId === "delivery")
    ?? capacities.find((item) => item.capacityId === "delivery");

  const failures = Math.max(0, Number(runtime.metrics?.failedIntents ?? 0));
  const violations = Math.max(0, Number(runtime.metrics?.commitmentViolations ?? 0));
  const invariantViolations = runtime.invariantViolations?.length ?? 0;
  const reliability = Math.max(0, Math.min(100, 100 - failures * 3 - violations * 12 - invariantViolations * 25));

  return [
    { key: "budget", value: compactMoney(Number(budgetAccount?.balance ?? 0), budgetAccount?.currency ?? "JPY") },
    { key: "materials", value: `${Math.round(materials)}u` },
    { key: "inventory", value: `${Math.round(inventory)}u` },
    { key: "capacity", value: `${fulfilment.toFixed(1)}u` },
    { key: "compute", value: `${availableCapacity(machine ?? { ownerId: "", capacityId: "", total: 0, reserved: 0, unit: "" }).toFixed(1)}u/h` },
    { key: "delivery", value: `${availableCapacity(delivery ?? { ownerId: "", capacityId: "", total: 0, reserved: 0, unit: "" }).toFixed(1)} slots` },
    { key: "trust", value: `${Math.round(reliability)} pts` },
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
      if (!foreground?.runtime) return;
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
    const timer = window.setInterval(sync, REFRESH_MS);
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

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  dominantEconomyCost,
  workflowAccruedEconomy,
  workflowTaskAccruedEconomy,
  type WorkflowCostTask,
} from "@/lib/asympta-economy";

type Locale = "en" | "zh-Hant" | "ja";
type TaskSnapshot = { id: string; title: string; agentId: string; status: string; progress: number };
type AgentSnapshot = { id: string; side: string };
type Foreground = { workflow?: string | null; tasks?: TaskSnapshot[]; agents?: AgentSnapshot[] };
type Snapshot = { foreground?: Foreground };
type DemoApi = { snapshot: () => unknown };
type RowEconomy = { accrued: number; projected: number };
type Projection = {
  accrued: number;
  projected: number;
  burnPerMinute: number;
  dominant: string;
  dominantCost: number;
  rows: RowEconomy[];
};

const REFRESH_MS = 350;
const TRAVEL_COST_WINDOW_MS = 6_000;
const ACTIVE = new Set(["moving", "working", "waiting_approval", "blocked"]);
const COPY: Record<Locale, { cost: string; perMinute: string; dominant: string }> = {
  en: { cost: "cost", perMinute: "/min", dominant: "main cost" },
  "zh-Hant": { cost: "成本", perMinute: "/分鐘", dominant: "主要成本" },
  ja: { cost: "費用", perMinute: "/分", dominant: "主な費用" },
};
const CATEGORY: Record<Locale, Record<string, string>> = {
  en: { agent: "agent time", compute: "compute", travel: "travel", materials: "materials", logistics: "logistics", platform: "fees", holding: "reservation", rework: "rework" },
  "zh-Hant": { agent: "代理時間", compute: "運算", travel: "交通", materials: "物料", logistics: "物流", platform: "費用", holding: "預留", rework: "返工" },
  ja: { agent: "エージェント", compute: "計算", travel: "移動", materials: "資材", logistics: "物流", platform: "手数料", holding: "予約", rework: "手戻り" },
};

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function demoApi() {
  return (window as unknown as { __ASYMPTA_DEMO__?: DemoApi }).__ASYMPTA_DEMO__;
}

function money(value: number) {
  return `¥${Math.max(0, Math.round(value)).toLocaleString("en-US")}`;
}

export function AsymptaWorkflowEconomy() {
  const [summaryTarget, setSummaryTarget] = useState<HTMLElement | null>(null);
  const [rowTargets, setRowTargets] = useState<HTMLElement[]>([]);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [language, setLanguage] = useState<Locale>("en");
  const movingSinceRef = useRef(new Map<string, number>());
  const previousRef = useRef({ workflow: "", cost: 0, at: 0, burn: 0 });

  useEffect(() => {
    let fingerprint = "";

    const sync = () => {
      if (document.hidden) return;
      const summary = document.querySelector<HTMLElement>(".atlas-safe-schedule__summary");
      const rows = Array.from(document.querySelectorAll<HTMLElement>(".atlas-safe-task__progress"));
      setSummaryTarget((current) => current === summary ? current : summary);
      setRowTargets((current) => current.length === rows.length && current.every((item, index) => item === rows[index]) ? current : rows);
      const nextLanguage = locale();
      setLanguage((current) => current === nextLanguage ? current : nextLanguage);

      let snapshot: Snapshot | undefined;
      try { snapshot = demoApi()?.snapshot() as Snapshot | undefined; } catch { return; }
      const foreground = snapshot?.foreground;
      if (!foreground?.tasks?.length) return;

      const now = performance.now();
      const agents = new Map((foreground.agents ?? []).map((agent) => [agent.id, agent.side]));
      const economicTasks: WorkflowCostTask[] = foreground.tasks.map((task) => {
        if (task.status === "moving") {
          if (!movingSinceRef.current.has(task.id)) movingSinceRef.current.set(task.id, now);
        } else {
          movingSinceRef.current.delete(task.id);
        }
        const movingSince = movingSinceRef.current.get(task.id);
        const travelProgress = task.status === "moving" && movingSince !== undefined
          ? Math.min(1, Math.max(0, (now - movingSince) / TRAVEL_COST_WINDOW_MS))
          : task.status === "queued" || task.status === "blocked" ? 0 : 1;
        return {
          ...task,
          agentSide: agents.get(task.agentId) ?? "operations",
          travelProgress,
        };
      });

      const total = workflowAccruedEconomy(economicTasks);
      const workflow = foreground.workflow ?? "world";
      const previous = previousRef.current;
      let burn = previous.burn;
      if (previous.workflow !== workflow || total.accrued < previous.cost) {
        burn = 0;
      } else if (previous.at > 0 && now > previous.at) {
        const raw = Math.max(0, total.accrued - previous.cost) / ((now - previous.at) / 60_000);
        burn = raw > 0 ? burn * 0.62 + raw * 0.38 : burn * 0.72;
      }
      previousRef.current = { workflow, cost: total.accrued, at: now, burn };

      const unfinished = economicTasks.filter((task) => task.status !== "done");
      const active = unfinished.filter((task) => ACTIVE.has(task.status));
      const queued = unfinished.filter((task) => task.status === "queued");
      const visible = [...active, ...queued].slice(0, 6);
      const rowEconomy = visible.map((task) => {
        const economy = workflowTaskAccruedEconomy(task);
        return { accrued: economy.accrued, projected: economy.projected };
      });
      const [dominant, dominantCost] = dominantEconomyCost(total.breakdown);
      const next: Projection = {
        accrued: total.accrued,
        projected: total.projected,
        burnPerMinute: Math.round(burn),
        dominant,
        dominantCost,
        rows: rowEconomy,
      };
      const nextFingerprint = JSON.stringify(next);
      if (nextFingerprint !== fingerprint) {
        fingerprint = nextFingerprint;
        setProjection(next);
      }
    };

    sync();
    const timer = window.setInterval(sync, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (!projection) return null;
  const copy = COPY[language];
  const summary = summaryTarget ? createPortal(
    <span
      className="asympta-workflow-cost"
      title={`${copy.dominant}: ${CATEGORY[language][projection.dominant] ?? projection.dominant} ${money(projection.dominantCost)} · projected ${money(projection.projected)}`}
    >
      <strong>{money(projection.accrued)}</strong> {copy.cost}
      {projection.burnPerMinute > 0 ? <small> · {money(projection.burnPerMinute)}{copy.perMinute}</small> : null}
    </span>,
    summaryTarget,
  ) : null;

  const rows = rowTargets.slice(0, projection.rows.length).map((target, index) => {
    const economy = projection.rows[index];
    if (!economy || economy.accrued <= 0) return null;
    return createPortal(
      <small className="asympta-task-cost" key={`cost-${index}`} title={`${money(economy.accrued)} / ${money(economy.projected)}`}> · {money(economy.accrued)}</small>,
      target,
    );
  });

  return <>{summary}{rows}</>;
}

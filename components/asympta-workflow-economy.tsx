"use client";

import { useEffect, useRef } from "react";

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

const REFRESH_MS = 350;
const TRAVEL_COST_WINDOW_MS = 6_000;
const ACTIVE = new Set(["moving", "working", "waiting_approval", "blocked"]);
const COPY: Record<Locale, { cost: string; perMinute: string; dominant: string; projected: string }> = {
  en: { cost: "cost", perMinute: "/min", dominant: "main cost", projected: "projected" },
  "zh-Hant": { cost: "成本", perMinute: "/分鐘", dominant: "主要成本", projected: "預計" },
  ja: { cost: "費用", perMinute: "/分", dominant: "主な費用", projected: "予測" },
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

function clearNodeEconomy(node: HTMLElement | null, attribute: string) {
  if (!node) return;
  node.removeAttribute(attribute);
  if (node.dataset.asymptaEconomyTitle === "true") {
    node.removeAttribute("title");
    delete node.dataset.asymptaEconomyTitle;
  }
}

export function AsymptaWorkflowEconomy() {
  const movingSinceRef = useRef(new Map<string, number>());
  const previousRef = useRef({ workflow: "", cost: 0, at: 0, burn: 0 });

  useEffect(() => {
    let previousRows: HTMLElement[] = [];
    let previousSummary: HTMLElement | null = null;

    const clearPrevious = () => {
      clearNodeEconomy(previousSummary, "data-asympta-workflow-cost");
      previousRows.forEach((row) => clearNodeEconomy(row, "data-asympta-task-cost"));
      previousRows = [];
      previousSummary = null;
    };

    const sync = () => {
      if (document.hidden) return;
      const summary = document.querySelector<HTMLElement>(".atlas-safe-schedule__summary");
      const rows = Array.from(document.querySelectorAll<HTMLElement>(".atlas-safe-task__progress"));

      let snapshot: Snapshot | undefined;
      try { snapshot = demoApi()?.snapshot() as Snapshot | undefined; } catch { return; }
      const foreground = snapshot?.foreground;
      if (!summary || !foreground?.tasks?.length) {
        clearPrevious();
        return;
      }

      const language = locale();
      const copy = COPY[language];
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

      const [dominant, dominantCost] = dominantEconomyCost(total.breakdown);
      const summaryText = `${money(total.accrued)} ${copy.cost}${burn > 0 ? ` · ${money(burn)}${copy.perMinute}` : ""}`;
      summary.dataset.asymptaWorkflowCost = summaryText;
      summary.title = `${copy.dominant}: ${CATEGORY[language][dominant] ?? dominant} ${money(dominantCost)} · ${copy.projected} ${money(total.projected)}`;
      summary.dataset.asymptaEconomyTitle = "true";

      const unfinished = economicTasks.filter((task) => task.status !== "done");
      const active = unfinished.filter((task) => ACTIVE.has(task.status));
      const queued = unfinished.filter((task) => task.status === "queued");
      const visible = [...active, ...queued].slice(0, 6);

      rows.forEach((row, index) => {
        const task = visible[index];
        if (!task) {
          clearNodeEconomy(row, "data-asympta-task-cost");
          return;
        }
        const economy = workflowTaskAccruedEconomy(task);
        if (economy.accrued <= 0) {
          clearNodeEconomy(row, "data-asympta-task-cost");
          return;
        }
        row.dataset.asymptaTaskCost = money(economy.accrued);
        row.title = `${money(economy.accrued)} / ${money(economy.projected)}`;
        row.dataset.asymptaEconomyTitle = "true";
      });

      for (const oldRow of previousRows) {
        if (!rows.includes(oldRow)) clearNodeEconomy(oldRow, "data-asympta-task-cost");
      }
      if (previousSummary && previousSummary !== summary) clearNodeEconomy(previousSummary, "data-asympta-workflow-cost");
      previousRows = rows;
      previousSummary = summary;
    };

    sync();
    const timer = window.setInterval(sync, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      clearPrevious();
    };
  }, []);

  return null;
}

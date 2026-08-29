"use client";

import { useEffect } from "react";

import { estimateTaskProgress, type DisplayAgent, type DisplayTask } from "@/lib/atlas-display-progress";

type Locale = "en" | "zh-Hant" | "ja";
type Snapshot = {
  foreground?: {
    tasks?: DisplayTask[];
    agents?: DisplayAgent[];
  };
};

const ACTIVE_TASKS = new Set(["moving", "working", "waiting_approval", "blocked"]);
const STATUS: Record<Locale, Record<string, string>> = {
  en: { idle: "Ready", moving: "Moving", working: "Working", sharing: "Sharing", waiting: "Waiting", returning: "Returning", waiting_approval: "Approval" },
  "zh-Hant": { idle: "就緒", moving: "移動中", working: "工作中", sharing: "交接中", waiting: "等待中", returning: "返回中", waiting_approval: "待批准" },
  ja: { idle: "準備完了", moving: "移動中", working: "作業中", sharing: "共有中", waiting: "待機中", returning: "帰還中", waiting_approval: "承認待ち" },
};

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function setData(node: Element | null, key: string, value: string) {
  if (!(node instanceof HTMLElement)) return;
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

export function AsymptaEstimatedProgress() {
  useEffect(() => {
    const sync = () => {
      if (document.hidden) return;
      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const tasks = snapshot?.foreground?.tasks ?? [];
      const agents = snapshot?.foreground?.agents ?? [];
      if (!tasks.length) return;

      const agentById = new Map(agents.map((agent) => [agent.id, agent]));
      const unfinished = tasks.filter((task) => task.status !== "done");
      const active = unfinished.filter((task) => ACTIVE_TASKS.has(task.status));
      const queued = unfinished.filter((task) => task.status === "queued");
      const visibleTasks = [...active, ...queued].slice(0, 6);
      const progressNodes = document.querySelectorAll<HTMLElement>(".atlas-safe-task__progress");

      progressNodes.forEach((node, index) => {
        const task = visibleTasks[index];
        if (!task || task.status === "queued") {
          delete node.dataset.asymptaEstimatedProgress;
          return;
        }
        const estimate = estimateTaskProgress(task, agentById.get(task.agentId), tasks);
        setData(node, "asymptaEstimatedProgress", `${estimate.percent}%`);
      });

      const lang = locale();
      for (const agent of agents) {
        const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${agent.id}"]`);
        const statusNode = marker?.querySelector<HTMLElement>(".animal-map-marker__status-text");
        if (!statusNode) continue;
        const task = tasks.find((candidate) => candidate.agentId === agent.id && ACTIVE_TASKS.has(candidate.status));
        if (!task) {
          setData(statusNode, "asymptaEstimatedStatus", STATUS[lang][agent.status] ?? agent.status);
          continue;
        }
        const estimate = estimateTaskProgress(task, agentById.get(agent.id), tasks);
        const state = task.status === "waiting_approval"
          ? STATUS[lang].waiting_approval
          : STATUS[lang][agent.status] ?? agent.status;
        setData(statusNode, "asymptaEstimatedStatus", `${state} · ${estimate.percent}%`);
      }
    };

    sync();
    const timer = window.setInterval(sync, 400);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}

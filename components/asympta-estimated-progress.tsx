"use client";

import { useEffect, useRef } from "react";

import {
  currentTaskTravelDistance,
  estimateTaskProgress,
  type DisplayAgent,
  type DisplayTask,
} from "@/lib/atlas-display-progress";

type Snapshot = {
  foreground?: {
    tasks?: DisplayTask[];
    agents?: DisplayAgent[];
  };
};

const ACTIVE_TASKS = new Set(["moving", "working", "waiting_approval", "blocked"]);

function setData(node: Element | null, key: string, value: string) {
  if (!(node instanceof HTMLElement)) return;
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

function clearDuplicateAgentProgress() {
  document
    .querySelectorAll<HTMLElement>(".animal-map-marker__status-text[data-asympta-estimated-status]")
    .forEach((node) => delete node.dataset.asymptaEstimatedStatus);
}

export function AsymptaEstimatedProgress() {
  const travelOriginDistanceRef = useRef(new Map<string, number>());
  const previousStatusRef = useRef(new Map<string, string>());

  useEffect(() => {
    // The living-world renderer already owns the one visible agent status/progress
    // label. Estimated progress is useful in the schedule, but projecting a second
    // percentage onto the marker creates two competing moving-% readouts. Clear any
    // legacy marker annotation and keep this component schedule-only.
    clearDuplicateAgentProgress();

    const sync = () => {
      if (document.hidden) return;
      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const tasks = snapshot?.foreground?.tasks ?? [];
      const agents = snapshot?.foreground?.agents ?? [];
      if (!tasks.length) {
        clearDuplicateAgentProgress();
        return;
      }

      const agentById = new Map(agents.map((agent) => [agent.id, agent]));

      for (const task of tasks) {
        const previousStatus = previousStatusRef.current.get(task.id);
        if (task.status === "moving" && previousStatus !== "moving") {
          const distance = currentTaskTravelDistance(task, agentById.get(task.agentId));
          if (distance !== null && Number.isFinite(distance) && distance > 0) {
            travelOriginDistanceRef.current.set(task.id, distance);
          }
        }
        if (task.status === "queued") travelOriginDistanceRef.current.delete(task.id);
        previousStatusRef.current.set(task.id, task.status);
      }

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
        const estimate = estimateTaskProgress(
          task,
          agentById.get(task.agentId),
          tasks,
          travelOriginDistanceRef.current.get(task.id),
        );
        setData(node, "asymptaEstimatedProgress", `${estimate.percent}%`);
      });

      clearDuplicateAgentProgress();
    };

    sync();
    const timer = window.setInterval(sync, 400);
    return () => {
      window.clearInterval(timer);
      clearDuplicateAgentProgress();
    };
  }, []);

  return null;
}

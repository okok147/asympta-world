"use client";

import { useEffect, useRef } from "react";

import {
  currentTaskTravelDistance,
  estimateTaskProgress,
  type DisplayAgent,
  type DisplayTask,
} from "@/lib/atlas-display-progress";

type PendingApproval = {
  id: string;
  source?: string;
  actionType?: string | null;
  taskId?: string | null;
};

type ForegroundSnapshot = {
  phase?: string;
  workflowId?: string | null;
  tasks?: DisplayTask[];
  agents?: DisplayAgent[];
  pendingApprovals?: PendingApproval[];
};

type Snapshot = {
  foreground?: ForegroundSnapshot;
};

const ACTIVE_TASKS = new Set(["moving", "working", "waiting_approval", "blocked"]);
const MARKER_PROGRESS_TASKS = new Set(["moving", "working"]);
const FALLBACK_SYNC_MS = 180;

function setData(node: Element | null, key: string, value: string) {
  if (!(node instanceof HTMLElement)) return;
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

function clearDuplicateAgentProgress() {
  document
    .querySelectorAll<HTMLElement>(".animal-map-marker__status-text[data-asympta-estimated-status]")
    .forEach((node) => delete node.dataset.asymptaEstimatedStatus);
}

function markerForAgent(agentId: string) {
  return [...document.querySelectorAll<HTMLElement>(".animal-map-marker--foreground")]
    .find((node) => node.dataset.agentId === agentId) ?? null;
}

function statusLabel(status: string) {
  const language = document.documentElement.lang.toLowerCase();
  if (language.startsWith("zh")) {
    if (status === "moving" || status === "returning") return "移動中";
    if (status === "working" || status === "sharing") return "工作中";
    return status;
  }
  if (language.startsWith("ja")) {
    if (status === "moving" || status === "returning") return "移動中";
    if (status === "working" || status === "sharing") return "作業中";
    return status;
  }
  return status.replaceAll("_", " ");
}

function approvalBelongsToVisibleWorkflow(foreground: ForegroundSnapshot | undefined) {
  const approvals = foreground?.pendingApprovals ?? [];
  if (!approvals.length) return false;

  const waitingTaskIds = new Set(
    (foreground?.tasks ?? [])
      .filter((task) => task.status === "waiting_approval")
      .map((task) => task.id),
  );

  return approvals.some((approval) => {
    // A task approval is valid only at the current workflow checkpoint.
    if (approval.taskId) return Boolean(foreground?.workflowId && waitingTaskIds.has(approval.taskId));

    // A WebMCP request to START a workflow has no task/action yet and is a
    // legitimate explicit review surface. A standalone action request with an
    // actionType but no active workflow is an orphan and must never appear as a
    // random approval card.
    if (!foreground?.workflowId) return !approval.actionType;
    return true;
  });
}

function syncApprovalCard(foreground: ForegroundSnapshot | undefined) {
  const card = document.querySelector<HTMLElement>(".atlas-approval");
  if (!card) return;
  const visible = approvalBelongsToVisibleWorkflow(foreground);
  card.hidden = !visible;
  card.setAttribute("aria-hidden", visible ? "false" : "true");
  card.style.display = visible ? "" : "none";
  card.dataset.asymptaApprovalIntegrity = visible ? "verified" : "suppressed-orphan";
}

export function AsymptaEstimatedProgress() {
  const travelOriginDistanceRef = useRef(new Map<string, number>());
  const previousStatusRef = useRef(new Map<string, string>());

  useEffect(() => {
    clearDuplicateAgentProgress();
    let frame = 0;

    const sync = () => {
      frame = 0;
      if (document.hidden) return;
      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const foreground = snapshot?.foreground;
      const tasks = foreground?.tasks ?? [];
      const agents = foreground?.agents ?? [];

      syncApprovalCard(foreground);

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

      // There is exactly one visible status label per foreground agent. Write the
      // distance-based estimate into that existing label instead of adding a second
      // pseudo-element. The 60Hz renderer owns marker geometry; this component owns
      // only the display percentage while an active task is moving/working.
      for (const agent of agents) {
        const task = tasks.find((candidate) => candidate.agentId === agent.id && MARKER_PROGRESS_TASKS.has(candidate.status));
        if (!task) continue;
        const statusNode = markerForAgent(agent.id)?.querySelector<HTMLElement>(".animal-map-marker__status-text");
        if (!statusNode) continue;
        const estimate = estimateTaskProgress(
          task,
          agent,
          tasks,
          travelOriginDistanceRef.current.get(task.id),
        );
        const nextText = `${statusLabel(agent.status)} · ${estimate.percent}%`;
        if (statusNode.textContent !== nextText) statusNode.textContent = nextText;
        delete statusNode.dataset.asymptaEstimatedStatus;
      }

      clearDuplicateAgentProgress();
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const timer = window.setInterval(sync, FALLBACK_SYNC_MS);
    const observer = new MutationObserver((mutations) => {
      const markerTextChanged = mutations.some((mutation) => {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        return Boolean(target?.closest(".animal-map-marker__status-text"));
      });

      if (markerTextChanged) {
        // The canonical 60Hz renderer updates task metadata inside requestAnimationFrame.
        // During travel/work transitions its engine progress can momentarily be zero.
        // MutationObserver callbacks run at the microtask checkpoint before the browser
        // paints that frame, so correct the display synchronously here instead of waiting
        // for the next rAF. This removes the visible 0% flash without touching engine state.
        sync();
        return;
      }

      if (mutations.some((mutation) => {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        return Boolean(target?.closest(".animal-map-marker--foreground, .atlas-approval"));
      })) scheduleSync();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    return () => {
      window.clearInterval(timer);
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      clearDuplicateAgentProgress();
      document.querySelectorAll<HTMLElement>(".atlas-approval[data-asympta-approval-integrity]").forEach((card) => {
        card.hidden = false;
        card.style.removeProperty("display");
        card.removeAttribute("aria-hidden");
        delete card.dataset.asymptaApprovalIntegrity;
      });
    };
  }, []);

  return null;
}

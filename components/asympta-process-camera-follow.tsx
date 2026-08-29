"use client";

import { useEffect } from "react";

type TaskSnapshot = {
  id?: string;
  agentId: string;
  status: string;
};

type ForegroundSnapshot = {
  phase?: string;
  tasks?: TaskSnapshot[];
};

type DemoSnapshot = {
  foreground?: ForegroundSnapshot;
};

type FollowMap = {
  on(event: string, handler: (event?: unknown) => void): unknown;
  off?(event: string, handler: (event?: unknown) => void): unknown;
};

const FOLLOW_REFRESH_MS = 320;
const ACTIVE_STATUSES = ["working", "moving", "waiting_approval"] as const;

function bridge() {
  return window as unknown as {
    __ASYMPTA_MAP__?: FollowMap;
    __ASYMPTA_DEMO__?: { snapshot: () => unknown };
  };
}

function activeTasks(snapshot: DemoSnapshot) {
  const tasks = snapshot.foreground?.tasks ?? [];
  const ordered: TaskSnapshot[] = [];
  for (const status of ACTIVE_STATUSES) {
    for (const task of tasks) {
      if (task.status !== status || ordered.some((candidate) => candidate.agentId === task.agentId && candidate.id === task.id)) continue;
      ordered.push(task);
    }
  }
  return ordered;
}

function clickAgent(agentId: string) {
  const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${agentId}"]`);
  marker?.click();
}

function cameraFollowIsActive() {
  return Boolean(document.querySelector(".atlas-follow.is-active"));
}

export function AsymptaProcessCameraFollow() {
  useEffect(() => {
    let processLock = false;
    let followedAgentId: string | null = null;
    let followedTaskKey: string | null = null;
    let activeMap: FollowMap | null = null;

    const disableProcessLock = () => {
      processLock = false;
      followedAgentId = null;
      followedTaskKey = null;
      document.documentElement.dataset.asymptaProcessCameraLock = "off";
    };

    const enableProcessLock = () => {
      processLock = true;
      document.documentElement.dataset.asymptaProcessCameraLock = "on";
    };

    const followCurrentAgent = () => {
      let snapshot: DemoSnapshot = {};
      try {
        snapshot = (bridge().__ASYMPTA_DEMO__?.snapshot() ?? {}) as DemoSnapshot;
      } catch {
        return;
      }

      const foreground = snapshot.foreground;
      if (!foreground) return;

      // Turning on the regular Camera Follow control during a running workflow upgrades it
      // into process lock automatically. The user does not need to understand a second mode.
      if (!processLock && cameraFollowIsActive() && foreground.phase !== "completed" && foreground.phase !== "idle") {
        enableProcessLock();
      }
      if (!processLock) return;
      if (foreground.phase === "idle") return;

      const tasks = activeTasks(snapshot);
      if (!tasks.length) return;
      const current = tasks[0];
      const taskKey = `${current.id ?? "task"}:${current.agentId}:${current.status}`;
      const agentChanged = current.agentId !== followedAgentId;
      const taskChanged = taskKey !== followedTaskKey;
      const followDropped = !cameraFollowIsActive();

      // Re-clicking the marker is intentional when a task changes or the underlying map
      // temporarily dropped camera-follow. It re-arms the real 60Hz follow loop.
      if (agentChanged || taskChanged || followDropped) {
        followedAgentId = current.agentId;
        followedTaskKey = taskKey;
        clickAgent(current.agentId);
      }
    };

    const enableFromProcessClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      const workflow = element?.closest(".atlas-workflow");
      const scheduledTask = element?.closest(".atlas-safe-task");
      if (!workflow && !scheduledTask) return;

      // Do not cancel the real button click. We only add process camera lock after the
      // workflow/schedule interaction so React remains responsible for the actual task.
      enableProcessLock();
      followedAgentId = null;
      followedTaskKey = null;
      window.setTimeout(followCurrentAgent, 0);
    };

    const syncManualFollowToggle = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest(".atlas-follow") : null;
      if (!element) return;
      window.setTimeout(() => {
        if (cameraFollowIsActive()) {
          enableProcessLock();
          followedTaskKey = null;
          followCurrentAgent();
        } else {
          disableProcessLock();
        }
      }, 0);
    };

    document.addEventListener("click", enableFromProcessClick);
    document.addEventListener("click", syncManualFollowToggle);

    const syncMapListener = () => {
      const map = bridge().__ASYMPTA_MAP__ ?? null;
      if (map === activeMap) return;
      if (activeMap?.off) {
        try { activeMap.off("dragstart", disableProcessLock); } catch {}
      }
      activeMap = map;
      if (activeMap) {
        try { activeMap.on("dragstart", disableProcessLock); } catch {}
      }
    };

    const tick = () => {
      if (document.hidden) return;
      syncMapListener();
      followCurrentAgent();
    };

    tick();
    const timer = window.setInterval(tick, FOLLOW_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", enableFromProcessClick);
      document.removeEventListener("click", syncManualFollowToggle);
      if (activeMap?.off) {
        try { activeMap.off("dragstart", disableProcessLock); } catch {}
      }
      delete document.documentElement.dataset.asymptaProcessCameraLock;
    };
  }, []);

  return null;
}

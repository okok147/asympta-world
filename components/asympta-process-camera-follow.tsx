"use client";

import { useEffect } from "react";

type TaskSnapshot = {
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

const FOLLOW_REFRESH_MS = 450;
const ACTIVE_STATUSES = ["working", "moving", "waiting_approval"] as const;

function bridge() {
  return window as unknown as {
    __ASYMPTA_MAP__?: FollowMap;
    __ASYMPTA_DEMO__?: { snapshot: () => unknown };
  };
}

function activeAgentIds(snapshot: DemoSnapshot) {
  const tasks = snapshot.foreground?.tasks ?? [];
  const ordered: string[] = [];
  for (const status of ACTIVE_STATUSES) {
    for (const task of tasks) {
      if (task.status !== status || ordered.includes(task.agentId)) continue;
      ordered.push(task.agentId);
    }
  }
  return ordered;
}

function clickAgent(agentId: string) {
  const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${agentId}"]`);
  marker?.click();
}

export function AsymptaProcessCameraFollow() {
  useEffect(() => {
    let processLock = false;
    let followedAgentId: string | null = null;
    let activeMap: FollowMap | null = null;

    const disableProcessLock = () => {
      processLock = false;
      followedAgentId = null;
      document.documentElement.dataset.asymptaProcessCameraLock = "off";
    };

    const followCurrentAgent = () => {
      if (!processLock) return;
      let snapshot: DemoSnapshot = {};
      try {
        snapshot = (bridge().__ASYMPTA_DEMO__?.snapshot() ?? {}) as DemoSnapshot;
      } catch {
        return;
      }

      const foreground = snapshot.foreground;
      if (!foreground || foreground.phase === "completed" || foreground.phase === "idle") return;
      const activeIds = activeAgentIds(snapshot);
      if (!activeIds.length) return;

      const nextAgentId = followedAgentId && activeIds.includes(followedAgentId)
        ? followedAgentId
        : activeIds[0];
      if (nextAgentId === followedAgentId) return;

      followedAgentId = nextAgentId;
      clickAgent(nextAgentId);
    };

    const enableFromWorkflowClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(".atlas-workflow") : null;
      if (!target) return;

      // Workflow tiles are camera controls only. Never let their original React onClick
      // restart or replace the running process.
      event.preventDefault();
      event.stopPropagation();

      processLock = true;
      followedAgentId = null;
      document.documentElement.dataset.asymptaProcessCameraLock = "on";
      followCurrentAgent();
    };

    document.addEventListener("click", enableFromWorkflowClick, true);

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
      document.removeEventListener("click", enableFromWorkflowClick, true);
      if (activeMap?.off) {
        try { activeMap.off("dragstart", disableProcessLock); } catch {}
      }
      delete document.documentElement.dataset.asymptaProcessCameraLock;
    };
  }, []);

  return null;
}

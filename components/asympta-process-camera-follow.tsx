"use client";

import { useEffect } from "react";

import {
  ASYMPTA_CAMERA_FOLLOW_COMMAND_EVENT,
  publishAsymptaCameraFollowState,
  type AsymptaCameraFollowCommand,
} from "@/lib/asympta-camera-follow";

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
  fire?(event: string, data?: Record<string, unknown>): unknown;
};

const FOLLOW_REFRESH_MS = 450;
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

function disableVisibleCameraFollow() {
  const toggle = document.querySelector<HTMLButtonElement>(".atlas-follow.is-active");
  if (toggle) {
    toggle.click();
    return;
  }

  // The selected-agent card is hidden during approval sheets. Firing the same
  // map event used by a real drag turns off the underlying camera state without
  // moving the map or waiting for that card to reappear.
  try {
    bridge().__ASYMPTA_MAP__?.fire?.("dragstart", {
      originalEvent: { type: "asympta-camera-follow-off" },
    });
  } catch {}
}

export function AsymptaProcessCameraFollow() {
  useEffect(() => {
    let processLock = false;
    let manualFollowLock = false;
    let followedAgentId: string | null = null;
    let followedTaskKey: string | null = null;
    let activeMap: FollowMap | null = null;
    let lastPublishedState = "";

    const publishState = () => {
      const following = processLock && !manualFollowLock;
      document.documentElement.dataset.asymptaCameraFollow = following ? "on" : "off";
      const signature = `${following}:${manualFollowLock}:${followedAgentId ?? ""}`;
      if (signature === lastPublishedState) return;
      lastPublishedState = signature;
      publishAsymptaCameraFollowState({
        following,
        manualLock: manualFollowLock,
        activeAgentId: followedAgentId,
      });
    };

    const syncManualDataset = () => {
      document.documentElement.dataset.asymptaCameraFollowManualLock = manualFollowLock ? "on" : "off";
      publishState();
    };

    const disableProcessLock = (manual = false) => {
      processLock = false;
      followedAgentId = null;
      followedTaskKey = null;
      if (manual) manualFollowLock = true;
      document.documentElement.dataset.asymptaProcessCameraLock = "off";
      syncManualDataset();
    };

    const enableProcessLock = () => {
      processLock = true;
      document.documentElement.dataset.asymptaProcessCameraLock = "on";
      publishState();
    };

    const clearManualFollowLock = () => {
      manualFollowLock = false;
      syncManualDataset();
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

      // A manual off/drag is authoritative. Runtime handoffs, approvals and recovery
      // may still try to select/follow an agent, but they are not allowed to turn the
      // camera back on until the user explicitly re-triggers it.
      if (manualFollowLock) {
        if (cameraFollowIsActive()) disableVisibleCameraFollow();
        publishState();
        return;
      }

      // Before a manual override, an explicit Camera Follow click can still promote
      // regular follow into process follow for the currently running workflow.
      if (!processLock && cameraFollowIsActive() && foreground.phase !== "completed" && foreground.phase !== "idle") {
        enableProcessLock();
      }
      if (!processLock) return;
      if (foreground.phase === "idle") return;

      const tasks = activeTasks(snapshot);
      if (!tasks.length) return;
      const current = tasks[0];
      const nextAgentId = current.agentId;
      const taskKey = `${current.id ?? "task"}:${current.agentId}:${current.status}`;
      const agentChanged = nextAgentId !== followedAgentId;
      const taskChanged = taskKey !== followedTaskKey;
      const followDropped = !cameraFollowIsActive();

      // Re-click only while process follow is genuinely armed. A user-disabled camera
      // is filtered above and is never treated as an accidental dropped follow.
      if (agentChanged || taskChanged || followDropped) {
        followedAgentId = nextAgentId;
        followedTaskKey = taskKey;
        clickAgent(nextAgentId);
        publishState();
      }
    };

    const enableFromWorkflowClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      const workflow = element?.closest(".atlas-workflow");
      const scheduledTask = element?.closest(".atlas-safe-task");
      if (!workflow && !scheduledTask) return;

      // Schedule-task clicks are the canonical re-trigger after a manual camera off.
      // A workflow tile must not silently override a user's manual camera choice.
      if (scheduledTask) clearManualFollowLock();
      if (manualFollowLock) return;

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
          // Explicit user ON is allowed. It is not an automatic re-enable.
          clearManualFollowLock();
          enableProcessLock();
          followedTaskKey = null;
          followCurrentAgent();
        } else {
          disableProcessLock(true);
        }
      }, 0);
    };

    const handleFollowCommand = (event: Event) => {
      const command = (event as CustomEvent<AsymptaCameraFollowCommand>).detail;
      if (!command || typeof command.enabled !== "boolean") return;

      if (!command.enabled) {
        disableProcessLock(command.source === "user");
        disableVisibleCameraFollow();
        return;
      }

      // A new workflow may auto-arm follow only when the user has not explicitly
      // switched it off. A direct user tap always clears that manual lock.
      if (command.source === "workflow" && manualFollowLock) {
        publishState();
        return;
      }
      clearManualFollowLock();
      enableProcessLock();
      followedAgentId = null;
      followedTaskKey = null;
      followCurrentAgent();
      window.setTimeout(followCurrentAgent, 0);
    };

    document.addEventListener("click", enableFromWorkflowClick);
    document.addEventListener("click", syncManualFollowToggle);
    window.addEventListener(ASYMPTA_CAMERA_FOLLOW_COMMAND_EVENT, handleFollowCommand);

    const manualMapDrag = () => disableProcessLock(true);

    const syncMapListener = () => {
      const map = bridge().__ASYMPTA_MAP__ ?? null;
      if (map === activeMap) return;
      if (activeMap?.off) {
        try { activeMap.off("dragstart", manualMapDrag); } catch {}
      }
      activeMap = map;
      if (activeMap) {
        try { activeMap.on("dragstart", manualMapDrag); } catch {}
      }
    };

    const tick = () => {
      if (document.hidden) return;
      syncMapListener();
      followCurrentAgent();
    };

    syncManualDataset();
    tick();
    const timer = window.setInterval(tick, FOLLOW_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", enableFromWorkflowClick);
      document.removeEventListener("click", syncManualFollowToggle);
      window.removeEventListener(ASYMPTA_CAMERA_FOLLOW_COMMAND_EVENT, handleFollowCommand);
      if (activeMap?.off) {
        try { activeMap.off("dragstart", manualMapDrag); } catch {}
      }
      delete document.documentElement.dataset.asymptaProcessCameraLock;
      delete document.documentElement.dataset.asymptaCameraFollowManualLock;
      delete document.documentElement.dataset.asymptaCameraFollow;
    };
  }, []);

  return null;
}

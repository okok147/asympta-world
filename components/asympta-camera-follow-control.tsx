"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./asympta-camera-follow-control.module.css";

import {
  requestAsymptaCameraFollow,
  subscribeAsymptaCameraFollowState,
  type AsymptaCameraFollowState,
} from "@/lib/asympta-camera-follow";
import {
  MARKETPLACE_EXECUTION_EVENT,
  type MarketplaceExecution,
} from "@/lib/asympta-marketplace-intent";

type Locale = "en" | "zh-Hant" | "ja";

type CameraTask = {
  agentId?: string;
  status?: string;
};

type CameraSnapshot = {
  foreground?: {
    phase?: string;
    tasks?: CameraTask[];
  };
};

type CameraWindow = Window & {
  __ASYMPTA_DEMO__?: {
    snapshot: () => unknown;
  };
};

const ACTIVE_STATUSES = new Set(["moving", "working", "waiting_approval"]);
const STATE_REFRESH_MS = 320;
const WORKFLOW_RETRY_MS = 180;

const COPY: Record<Locale, {
  on: string;
  off: string;
  unavailable: string;
}> = {
  en: {
    on: "Turn camera follow on",
    off: "Turn camera follow off",
    unavailable: "No active agent to follow",
  },
  "zh-Hant": {
    on: "開啟鏡頭跟隨",
    off: "關閉鏡頭跟隨",
    unavailable: "目前沒有可跟隨的活動代理",
  },
  ja: {
    on: "カメラ追従をオンにする",
    off: "カメラ追従をオフにする",
    unavailable: "追従できる活動中のエージェントはいません",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function cameraWindow() {
  return window as CameraWindow;
}

function readCameraSnapshot(): CameraSnapshot {
  try {
    const raw = cameraWindow().__ASYMPTA_DEMO__?.snapshot();
    return raw && typeof raw === "object" ? raw as CameraSnapshot : {};
  } catch {
    return {};
  }
}

function hasActiveAgent() {
  const foreground = readCameraSnapshot().foreground;
  if (!foreground || foreground.phase === "idle" || foreground.phase === "completed" || foreground.phase === "blocked") return false;
  return (foreground.tasks ?? []).some((task) => Boolean(task.agentId && task.status && ACTIVE_STATUSES.has(task.status)));
}

function stateFromDocument(): AsymptaCameraFollowState {
  const root = document.documentElement;
  const manualLock = root.dataset.asymptaCameraFollowManualLock === "on";
  return {
    following: root.dataset.asymptaProcessCameraLock === "on" && !manualLock,
    manualLock,
    activeAgentId: null,
  };
}

export function AsymptaCameraFollowControl() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [following, setFollowing] = useState(false);
  const [available, setAvailable] = useState(false);
  const activeExecutionRef = useRef<string | null>(null);
  const retryTimersRef = useRef(new Set<number>());

  useEffect(() => {
    const syncHost = () => {
      const next = document.querySelector<HTMLElement>(".atlas-menu-bar");
      setHost((current) => current === next ? current : next);
    };
    queueMicrotask(syncHost);
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncLocale = () => setLocale(localeFromDocument());
    queueMicrotask(syncLocale);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const applyState = (state: AsymptaCameraFollowState) => {
      setFollowing(state.following);
      setAvailable(state.following || hasActiveAgent());
    };
    const sync = () => applyState(stateFromDocument());
    const unsubscribe = subscribeAsymptaCameraFollowState(applyState);
    const timer = window.setInterval(sync, STATE_REFRESH_MS);
    queueMicrotask(sync);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const requestWorkflowFollow = (executionId: string) => {
      if (document.documentElement.dataset.asymptaCameraFollowManualLock === "on") return;
      requestAsymptaCameraFollow({ enabled: true, source: "workflow" });
      const retry = window.setTimeout(() => {
        retryTimersRef.current.delete(retry);
        if (activeExecutionRef.current !== executionId) return;
        if (document.documentElement.dataset.asymptaCameraFollowManualLock === "on") return;
        requestAsymptaCameraFollow({ enabled: true, source: "workflow" });
      }, WORKFLOW_RETRY_MS);
      retryTimersRef.current.add(retry);
    };

    const onMarketplaceExecution = (event: Event) => {
      const execution = (event as CustomEvent<MarketplaceExecution>).detail;
      if (!execution?.executionId || ["completed", "blocked"].includes(execution.status)) return;
      if (activeExecutionRef.current === execution.executionId) return;
      activeExecutionRef.current = execution.executionId;
      requestWorkflowFollow(execution.executionId);
    };

    window.addEventListener(MARKETPLACE_EXECUTION_EVENT, onMarketplaceExecution);
    return () => {
      window.removeEventListener(MARKETPLACE_EXECUTION_EVENT, onMarketplaceExecution);
      for (const timer of retryTimersRef.current) window.clearTimeout(timer);
      retryTimersRef.current.clear();
    };
  }, []);

  if (!host) return null;
  const copy = COPY[locale];
  const label = following ? copy.off : available ? copy.on : copy.unavailable;

  return createPortal(
    <button
      type="button"
      className={`${styles.control} atlas-quick-icon asympta-camera-follow-toggle${following ? " is-active" : ""}`}
      data-asympta-camera-follow-control="true"
      aria-label={label}
      aria-pressed={following}
      title={label}
      disabled={!available && !following}
      onClick={() => requestAsymptaCameraFollow({ enabled: !following, source: "user" })}
    >
      {following ? <Eye size={17} strokeWidth={1.7} aria-hidden="true" /> : <EyeOff size={17} strokeWidth={1.7} aria-hidden="true" />}
      <span className={styles.status} aria-hidden="true" />
    </button>,
    host,
  );
}

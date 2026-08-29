"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Locale = "en" | "zh-Hant" | "ja";
type WorkflowId = "custom-order" | "dinner-network" | "launch-stock" | "service-recovery";
type DemoSnapshot = {
  foreground?: {
    phase?: string;
    workflow?: string | null;
    pendingApprovals?: Array<{ id: string }>;
  };
};

type DemoApi = {
  snapshot: () => unknown;
  startWorkflow: (workflowId: WorkflowId) => unknown;
  approve: (approvalId: string, approved: boolean) => unknown;
};

const COPY: Record<Locale, { explore: string; approve: string; on: string; off: string }> = {
  en: { explore: "Auto Explore", approve: "Auto Approve", on: "ON", off: "OFF" },
  "zh-Hant": { explore: "自動探索", approve: "自動批准", on: "開啟", off: "關閉" },
  ja: { explore: "自動探索", approve: "自動承認", on: "オン", off: "オフ" },
};

const WORKFLOW_SEQUENCE: WorkflowId[] = ["custom-order", "dinner-network", "launch-stock", "service-recovery"];
const WORKFLOW_BY_NAME: Record<string, WorkflowId> = {
  "Custom Order Network": "custom-order",
  "Dinner Coordination": "dinner-network",
  "Launch Stock Orchestration": "launch-stock",
  "Service Recovery Network": "service-recovery",
};
const CONTROL_REFRESH_MS = 700;
const EXPLORE_HANDOFF_DELAY_MS = 1_600;

function browserWindow() {
  return window as unknown as Window & { __ASYMPTA_DEMO__?: DemoApi };
}

function currentLocale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function nextWorkflow(name: string | null | undefined): WorkflowId {
  const current = name ? WORKFLOW_BY_NAME[name] : undefined;
  if (!current) return WORKFLOW_SEQUENCE[0];
  const index = WORKFLOW_SEQUENCE.indexOf(current);
  return WORKFLOW_SEQUENCE[(index + 1) % WORKFLOW_SEQUENCE.length];
}

export function AsymptaScheduleAutomationControls() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [autoExplore, setAutoExplore] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const approvedIdsRef = useRef(new Set<string>());
  const completedSinceRef = useRef<number | null>(null);
  const exploredWorkflowRef = useRef<string | null>(null);

  useEffect(() => {
    const syncTarget = () => {
      const card = document.querySelector<HTMLElement>(".atlas-safe-schedule");
      if (card && card !== target) setTarget(card);
      const nextLocale = currentLocale();
      setLocale((value) => value === nextLocale ? value : nextLocale);
    };
    syncTarget();
    const timer = window.setInterval(syncTarget, 500);
    return () => window.clearInterval(timer);
  }, [target]);

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      const api = browserWindow().__ASYMPTA_DEMO__;
      if (!api) return;

      let snapshot: DemoSnapshot;
      try {
        snapshot = api.snapshot() as DemoSnapshot;
      } catch {
        return;
      }
      const foreground = snapshot.foreground;
      if (!foreground) return;

      if (autoApprove) {
        const approval = foreground.pendingApprovals?.find((item) => !approvedIdsRef.current.has(item.id));
        if (approval) {
          approvedIdsRef.current.add(approval.id);
          try { api.approve(approval.id, true); } catch {}
        }
      }

      if (!autoExplore || foreground.phase !== "completed") {
        completedSinceRef.current = null;
        if (foreground.phase !== "completed") exploredWorkflowRef.current = null;
        return;
      }

      const workflowKey = foreground.workflow ?? "completed";
      if (exploredWorkflowRef.current === workflowKey) return;
      const now = performance.now();
      if (completedSinceRef.current === null) {
        completedSinceRef.current = now;
        return;
      }
      if (now - completedSinceRef.current < EXPLORE_HANDOFF_DELAY_MS) return;

      exploredWorkflowRef.current = workflowKey;
      completedSinceRef.current = null;
      try { api.startWorkflow(nextWorkflow(foreground.workflow)); } catch {}
    };

    tick();
    const timer = window.setInterval(tick, CONTROL_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoApprove, autoExplore]);

  if (!target) return null;
  const copy = COPY[locale];

  return createPortal(
    <section className="atlas-safe-automation" aria-label={`${copy.explore} / ${copy.approve}`}>
      <button
        type="button"
        className={`atlas-safe-automation__toggle${autoExplore ? " is-on" : ""}`}
        aria-pressed={autoExplore}
        onClick={() => setAutoExplore((value) => !value)}
      >
        <span className="atlas-safe-automation__indicator"><i /></span>
        <span>{copy.explore}</span>
        <strong>{autoExplore ? copy.on : copy.off}</strong>
      </button>
      <button
        type="button"
        className={`atlas-safe-automation__toggle${autoApprove ? " is-on" : ""}`}
        aria-pressed={autoApprove}
        onClick={() => setAutoApprove((value) => !value)}
      >
        <span className="atlas-safe-automation__indicator"><i /></span>
        <span>{copy.approve}</span>
        <strong>{autoApprove ? copy.on : copy.off}</strong>
      </button>
    </section>,
    target,
  );
}

"use client";

import { useEffect, useRef } from "react";

import type { AsymptaActivity, AsymptaActivityEvent } from "@/lib/asympta-activity";
import {
  completionReceiptFromActivity,
  completionReceiptFromCurrentRequest,
  completionReceiptFromMarketplaceExecution,
  completionReceiptFromWorkflowSnapshot,
  publishAsymptaCompletionReceipt,
  type AsymptaCompletionReceipt,
  type CompletionWorkflowSnapshot,
} from "@/lib/asympta-completion-receipt";
import { subscribeAsymptaCurrentRequest } from "@/lib/asympta-current-request";
import {
  MARKETPLACE_EXECUTION_EVENT,
  type MarketplaceExecution,
} from "@/lib/asympta-marketplace-intent";
import {
  createAsymptaWorkflowLifecycleTracker,
  observeAsymptaWorkflowLifecycle,
  publishAsymptaWorkflowStart,
  seedAsymptaWorkflowLifecycle,
  type AsymptaWorkflowLifecycleObservation,
} from "@/lib/asympta-workflow-lifecycle";

type ActivityDetail = {
  activity?: AsymptaActivity;
  event?: AsymptaActivityEvent;
};

type CompletionWindow = Window & {
  __ASYMPTA_DEMO__?: { snapshot: () => unknown };
  __ASYMPTA_MARKETPLACE__?: { snapshot: () => MarketplaceExecution | null };
};

const COMPLETION_SYNC_MS = 260;
const MAX_RECEIPT_IDS = 160;

function workflowSnapshot(value: unknown): CompletionWorkflowSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  const foreground = root.foreground;
  return (foreground && typeof foreground === "object" && !Array.isArray(foreground)
    ? foreground
    : root) as CompletionWorkflowSnapshot;
}

function lifecyclePhase(value: unknown): AsymptaWorkflowLifecycleObservation["phase"] {
  if (value === "completed") return "completed";
  if (value === "blocked" || value === "failed" || value === "cancelled") return "blocked";
  return "active";
}

function marketplaceObservation(execution: MarketplaceExecution): AsymptaWorkflowLifecycleObservation {
  return {
    source: "marketplace",
    fingerprint: execution.executionId,
    workflowId: execution.workflowId,
    title: execution.envelope.rawMessage.text,
    phase: lifecyclePhase(execution.status),
    simulated: true,
    requestId: execution.envelope.requestId,
    details: {
      executionId: execution.executionId,
      goalCount: execution.envelope.goals.length,
      status: execution.status,
    },
  };
}

function workflowObservation(
  snapshot: CompletionWorkflowSnapshot | null,
): AsymptaWorkflowLifecycleObservation | null {
  const workflowId = typeof snapshot?.workflowId === "string" ? snapshot.workflowId : "";
  if (!workflowId || workflowId === "marketplace-intent" || snapshot?.phase === "idle") return null;
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  if (!tasks.length) return null;
  return {
    source: "workflow",
    fingerprint: workflowId,
    workflowId,
    title: typeof snapshot.workflow === "string" ? snapshot.workflow : workflowId,
    phase: lifecyclePhase(snapshot.phase),
    simulated: true,
    requestId: null,
    details: {
      taskCount: tasks.length,
      phase: snapshot.phase,
    },
  };
}

function bindWorkflowReceiptToRun(
  receipt: AsymptaCompletionReceipt | null,
  runId: string,
): AsymptaCompletionReceipt | null {
  if (!receipt) return null;
  return {
    ...receipt,
    id: `workflow-run:${runId}`,
    details: {
      ...receipt.details,
      lifecycleRunId: runId,
    },
  };
}

export function AsymptaCompletionCoordinator() {
  const publishedIdsRef = useRef<string[]>([]);
  const lifecycleRef = useRef(createAsymptaWorkflowLifecycleTracker());

  useEffect(() => {
    const publishOnce = (receipt: AsymptaCompletionReceipt | null) => {
      if (!receipt || publishedIdsRef.current.includes(receipt.id)) return;
      publishedIdsRef.current = [...publishedIdsRef.current, receipt.id].slice(-MAX_RECEIPT_IDS);
      publishAsymptaCompletionReceipt(receipt);
    };

    const observeMarketplace = (execution: MarketplaceExecution | null) => {
      if (!execution) return;
      const transition = observeAsymptaWorkflowLifecycle(
        lifecycleRef.current,
        marketplaceObservation(execution),
      );
      if (transition.start) publishAsymptaWorkflowStart(transition.start);
      if (transition.completionRunId) {
        publishOnce(completionReceiptFromMarketplaceExecution(execution));
      }
    };

    const observeWorkflow = (snapshot: CompletionWorkflowSnapshot | null) => {
      const observation = workflowObservation(snapshot);
      if (!observation || !snapshot) return;
      const transition = observeAsymptaWorkflowLifecycle(lifecycleRef.current, observation);
      if (transition.start) publishAsymptaWorkflowStart(transition.start);
      if (transition.completionRunId) {
        publishOnce(bindWorkflowReceiptToRun(
          completionReceiptFromWorkflowSnapshot(snapshot),
          transition.completionRunId,
        ));
      }
    };

    const app = window as CompletionWindow;
    let initialMarketplace: MarketplaceExecution | null = null;
    let initialWorkflow: CompletionWorkflowSnapshot | null = null;
    try {
      initialMarketplace = app.__ASYMPTA_MARKETPLACE__?.snapshot() ?? null;
    } catch {
      initialMarketplace = null;
    }
    try {
      initialWorkflow = workflowSnapshot(app.__ASYMPTA_DEMO__?.snapshot());
    } catch {
      initialWorkflow = null;
    }

    // Hydration is a baseline, never a new celebration. An already-running job
    // stays eligible for its eventual large completion celebration, while an
    // already-completed persisted job cannot replay a false completion on boot.
    seedAsymptaWorkflowLifecycle(
      lifecycleRef.current,
      "marketplace",
      initialMarketplace ? marketplaceObservation(initialMarketplace) : null,
    );
    seedAsymptaWorkflowLifecycle(
      lifecycleRef.current,
      "workflow",
      workflowObservation(initialWorkflow),
    );

    const unsubscribeRequest = subscribeAsymptaCurrentRequest((request) => {
      // Marketplace completion is accepted only from its inventory/receipt-backed
      // execution state below. Generic actions are accepted only from their
      // provenance-bearing Asympta activity outcome.
      if (request.kind === "marketplace" || request.kind === "action") return;
      publishOnce(completionReceiptFromCurrentRequest(request));
    });

    const onMarketplace = (event: Event) => {
      observeMarketplace((event as CustomEvent<MarketplaceExecution>).detail);
    };
    window.addEventListener(MARKETPLACE_EXECUTION_EVENT, onMarketplace);

    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      // `completionReceiptFromActivity` fails closed unless the activity itself
      // contains a verified outcome plus explicit execution provenance. A bare
      // `status: completed` event can never create a celebration receipt.
      if (!detail?.activity) return;
      publishOnce(completionReceiptFromActivity(detail.activity));
    };
    window.addEventListener("asympta:activity", onActivity);

    const syncCanonicalEngines = () => {
      if (document.hidden) return;
      try {
        observeMarketplace(app.__ASYMPTA_MARKETPLACE__?.snapshot() ?? null);
      } catch {
        // A partial bridge snapshot is not lifecycle or completion evidence.
      }
      try {
        observeWorkflow(workflowSnapshot(app.__ASYMPTA_DEMO__?.snapshot()));
      } catch {
        // The world may be remounting. A later canonical snapshot will retry.
      }
    };

    const timer = window.setInterval(syncCanonicalEngines, COMPLETION_SYNC_MS);
    return () => {
      window.clearInterval(timer);
      unsubscribeRequest();
      window.removeEventListener(MARKETPLACE_EXECUTION_EVENT, onMarketplace);
      window.removeEventListener("asympta:activity", onActivity);
    };
  }, []);

  return null;
}

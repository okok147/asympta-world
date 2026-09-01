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

export function AsymptaCompletionCoordinator() {
  const publishedIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const publishOnce = (receipt: AsymptaCompletionReceipt | null) => {
      if (!receipt || publishedIdsRef.current.includes(receipt.id)) return;
      publishedIdsRef.current = [...publishedIdsRef.current, receipt.id].slice(-MAX_RECEIPT_IDS);
      publishAsymptaCompletionReceipt(receipt);
    };

    const unsubscribeRequest = subscribeAsymptaCurrentRequest((request) => {
      // Marketplace completion is accepted only from its inventory/receipt-backed
      // execution state below. Generic actions are accepted only from their
      // provenance-bearing Asympta activity outcome.
      if (request.kind === "marketplace" || request.kind === "action") return;
      publishOnce(completionReceiptFromCurrentRequest(request));
    });

    const onMarketplace = (event: Event) => {
      const execution = (event as CustomEvent<MarketplaceExecution>).detail;
      publishOnce(completionReceiptFromMarketplaceExecution(execution));
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
      const app = window as CompletionWindow;
      try {
        const marketplace = app.__ASYMPTA_MARKETPLACE__?.snapshot() ?? null;
        if (marketplace) publishOnce(completionReceiptFromMarketplaceExecution(marketplace));
      } catch {
        // A partial bridge snapshot is not completion evidence. Keep polling.
      }
      try {
        const world = workflowSnapshot(app.__ASYMPTA_DEMO__?.snapshot());
        if (world) publishOnce(completionReceiptFromWorkflowSnapshot(world));
      } catch {
        // The world may be remounting. A later canonical snapshot will retry.
      }
    };

    syncCanonicalEngines();
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

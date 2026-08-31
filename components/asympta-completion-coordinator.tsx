"use client";

import { useEffect, useRef } from "react";

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
  activity?: {
    id?: string;
    intent?: unknown;
    status?: string;
  };
  event?: {
    status?: string;
    summary?: string;
  };
};

type CompletionWindow = Window & {
  __ASYMPTA_DEMO__?: { snapshot: () => unknown };
  __ASYMPTA_MARKETPLACE__?: { snapshot: () => MarketplaceExecution | null };
};

const COMPLETION_SYNC_MS = 260;
const MAX_RECEIPT_IDS = 160;

function activityIntent(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const raw = Reflect.get(value, "raw");
  return typeof raw === "string" ? raw.trim() : "";
}

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
      // execution state below. This prevents a display-only request update from
      // celebrating before delivery is actually recorded.
      if (request.kind === "marketplace") return;
      publishOnce(completionReceiptFromCurrentRequest(request));
    });

    const onMarketplace = (event: Event) => {
      const execution = (event as CustomEvent<MarketplaceExecution>).detail;
      publishOnce(completionReceiptFromMarketplaceExecution(execution));
    };
    window.addEventListener(MARKETPLACE_EXECUTION_EVENT, onMarketplace);

    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      const status = detail?.event?.status ?? detail?.activity?.status;
      const id = detail?.activity?.id?.trim() ?? "";
      if (status !== "completed" || !id) return;
      const title = activityIntent(detail?.activity?.intent) || "Job completed";
      publishOnce(completionReceiptFromActivity(id, title, detail?.event?.summary ?? "The requested job was completed."));
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

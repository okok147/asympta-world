"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import {
  subscribeAsymptaCompletionReceipts,
  type AsymptaCompletionReceipt,
} from "@/lib/asympta-completion-receipt";
import { prepareAtlasDemoWorkflowReset } from "@/lib/atlas-demo";

export const ASYMPTA_WORKFLOW_RUNTIME_RESET_EVENT = "asympta:workflow-runtime-reset" as const;

export type AsymptaWorkflowRuntimeResetSignal = {
  schemaVersion: "asympta.workflow-runtime-reset.v1";
  completionId: string;
  requestId: string | null;
  provenance: AsymptaCompletionReceipt["provenance"];
  completedAt: string;
};

type Props = {
  children: ReactNode;
  prepareWorldReset?: boolean;
  emitResetSignal?: boolean;
};

const MAX_RESET_RECEIPTS = 160;

/**
 * Completion receipts are the only verified finish boundary in the UI.
 * The celebration/coordinator stay outside these reset scopes, while task
 * runtime scopes remount behind them so completed state cannot leak forward.
 */
export function AsymptaWorkflowRuntimeBoundary({
  children,
  prepareWorldReset = false,
  emitResetSignal = false,
}: Props) {
  const [generation, setGeneration] = useState(0);
  const seenReceiptIdsRef = useRef<string[]>([]);
  const resetQueuedRef = useRef(false);
  const pendingSignalRef = useRef<AsymptaWorkflowRuntimeResetSignal | null>(null);

  useEffect(() => subscribeAsymptaCompletionReceipts((receipt) => {
    if (seenReceiptIdsRef.current.includes(receipt.id)) return;
    seenReceiptIdsRef.current = [...seenReceiptIdsRef.current, receipt.id].slice(-MAX_RESET_RECEIPTS);
    pendingSignalRef.current = {
      schemaVersion: "asympta.workflow-runtime-reset.v1",
      completionId: receipt.id,
      requestId: receipt.requestId,
      provenance: receipt.provenance,
      completedAt: receipt.completedAt,
    };

    // Receipt delivery is synchronous. Every receipt listener, especially the
    // full-screen celebration, captures the verified result before this remount.
    if (resetQueuedRef.current) return;
    resetQueuedRef.current = true;
    queueMicrotask(() => {
      resetQueuedRef.current = false;
      const signal = pendingSignalRef.current;
      pendingSignalRef.current = null;

      // Only the scope that owns AsymptaWorldLive60Hz arms the one-shot idle
      // world. Initial page load still boots the living demo as before.
      if (prepareWorldReset) prepareAtlasDemoWorkflowReset();
      setGeneration((value) => value + 1);

      if (emitResetSignal && signal) {
        window.dispatchEvent(new CustomEvent<AsymptaWorkflowRuntimeResetSignal>(
          ASYMPTA_WORKFLOW_RUNTIME_RESET_EVENT,
          { detail: signal },
        ));
      }
    });
  }), [emitResetSignal, prepareWorldReset]);

  return <Fragment key={generation}>{children}</Fragment>;
}

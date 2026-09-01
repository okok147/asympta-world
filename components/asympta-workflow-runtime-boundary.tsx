"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import {
  subscribeAsymptaCompletionReceipts,
  type AsymptaCompletionReceipt,
} from "@/lib/asympta-completion-receipt";

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
};

const MAX_RESET_RECEIPTS = 160;

/**
 * Completion receipts are the only verified finish boundary in the UI.
 * Keep the celebration/coordinator outside this component, then remount the
 * task runtime behind the celebration so a completed run cannot leak state
 * into the next request.
 */
export function AsymptaWorkflowRuntimeBoundary({ children }: Props) {
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

    // Completion receipt dispatch is synchronous. Defer the remount until all
    // receipt listeners (especially the full-screen celebration) have captured
    // the verified result. The celebration then stays mounted above a clean,
    // idle runtime instead of being destroyed with the completed workflow.
    if (resetQueuedRef.current) return;
    resetQueuedRef.current = true;
    queueMicrotask(() => {
      resetQueuedRef.current = false;
      const signal = pendingSignalRef.current;
      pendingSignalRef.current = null;
      setGeneration((value) => value + 1);
      if (signal) {
        window.dispatchEvent(new CustomEvent<AsymptaWorkflowRuntimeResetSignal>(
          ASYMPTA_WORKFLOW_RUNTIME_RESET_EVENT,
          { detail: signal },
        ));
      }
    });
  }), []);

  return <Fragment key={generation}>{children}</Fragment>;
}

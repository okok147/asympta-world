"use client";

import { useEffect } from "react";

import {
  MARKETPLACE_EXECUTION_EVENT,
  MARKETPLACE_WORKFLOW_ID,
  type MarketplaceExecution,
} from "@/lib/asympta-marketplace-intent";

type DemoBridge = {
  approve: (approvalId: string, approved: boolean) => unknown;
};

type MarketplaceWindow = Window & {
  __ASYMPTA_DEMO__?: DemoBridge;
};

/**
 * Payment is a human checkpoint even in the simulated marketplace.
 *
 * The older intent router contains a legacy demo convenience that attempts to
 * auto-approve simulated authorize_payment checkpoints when it receives an
 * awaiting-approval execution event. The dedicated payment card now owns that
 * decision, so suppress that legacy call during the synchronous event dispatch.
 * The real bridge is restored in the next microtask, which means an actual click
 * on Confirm/Decline still reaches the canonical engine normally.
 */
export function AsymptaMarketplaceManualPaymentBoundary() {
  useEffect(() => {
    const onExecution = (event: Event) => {
      const execution = (event as CustomEvent<MarketplaceExecution>).detail;
      if (
        execution?.workflowId !== MARKETPLACE_WORKFLOW_ID
        || execution.status !== "awaiting_approval"
      ) return;

      const demo = (window as MarketplaceWindow).__ASYMPTA_DEMO__;
      if (!demo) return;
      const originalApprove = demo.approve;

      const requireExplicitUserDecision: DemoBridge["approve"] = () => {
        throw new Error("Marketplace payment requires explicit user confirmation.");
      };

      demo.approve = requireExplicitUserDecision;
      queueMicrotask(() => {
        if (demo.approve === requireExplicitUserDecision) demo.approve = originalApprove;
      });
    };

    window.addEventListener(MARKETPLACE_EXECUTION_EVENT, onExecution, true);
    return () => window.removeEventListener(MARKETPLACE_EXECUTION_EVENT, onExecution, true);
  }, []);

  return null;
}

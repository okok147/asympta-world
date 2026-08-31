"use client";

import { useEffect, useRef } from "react";

import {
  publishAsymptaCurrentRequest,
  subscribeAsymptaCurrentRequest,
  type AsymptaCurrentRequest,
} from "@/lib/asympta-current-request";
import {
  inferUnsafeProposalMissingFields,
  isRecoverableUnsafeProposal,
  unsafeProposalRecoveryPrompt,
  type UnsafeProposalRecoveryLocale,
} from "@/lib/asympta-unsafe-proposal-recovery";

function localeFromDocument(): UnsafeProposalRecoveryLocale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function setLegacyErrorVisible(visible: boolean) {
  const error = document.querySelector<HTMLElement>(".asympta-intent-error");
  if (!error) return;
  if (visible) {
    if (error.dataset.asymptaRecoveryHidden === "true") {
      error.style.removeProperty("display");
      delete error.dataset.asymptaRecoveryHidden;
    }
    return;
  }
  error.dataset.asymptaRecoveryHidden = "true";
  error.style.setProperty("display", "none", "important");
}

function recoverRequest(request: AsymptaCurrentRequest) {
  const locale = localeFromDocument();
  const missingFields = inferUnsafeProposalMissingFields(request.intent);
  if (!missingFields.length) return false;

  const prompt = unsafeProposalRecoveryPrompt(locale);
  const nextRequest: AsymptaCurrentRequest = {
    ...request,
    status: "waiting_input",
    actor: "Asympta",
    step: prompt,
    events: [...request.events, prompt].slice(-6),
    updatedAt: new Date().toISOString(),
  };

  publishAsymptaCurrentRequest(nextRequest);
  window.dispatchEvent(new CustomEvent("asympta:activity", {
    detail: {
      activity: {
        id: request.requestId,
        intent: request.intent,
        status: "waiting_input",
      },
      event: {
        status: "waiting_input",
        summary: prompt,
        data: {
          missingFields,
          recovery: "unsafe_action_proposal",
          factPolicy: "unknown_until_user_confirmation",
        },
      },
    },
  }));
  return true;
}

export function AsymptaUnsafeProposalRecovery() {
  const processedRef = useRef(new Set<string>());
  const activeRef = useRef(false);

  useEffect(() => subscribeAsymptaCurrentRequest((request) => {
    if (request.status !== "failed") {
      if (activeRef.current) {
        activeRef.current = false;
        setLegacyErrorVisible(true);
      }
      return;
    }

    if (!isRecoverableUnsafeProposal(request.step)) return;
    const key = `${request.requestId}:${request.updatedAt}:${request.step}`;
    if (processedRef.current.has(key)) return;
    processedRef.current.add(key);

    queueMicrotask(() => {
      const recovered = recoverRequest(request);
      if (!recovered) return;
      activeRef.current = true;
      setLegacyErrorVisible(false);
    });
  }), []);

  useEffect(() => () => setLegacyErrorVisible(true), []);
  return null;
}

"use client";

import { useEffect, useRef } from "react";

import styles from "./asympta-marketplace-intent-router.module.css";

import {
  publishAsymptaCurrentRequest,
  type AsymptaCurrentRequestSource,
} from "@/lib/asympta-current-request";
import {
  MARKETPLACE_EXECUTION_EVENT,
  MARKETPLACE_PROFILE_REQUIRED_EVENT,
  compileAsymptaContext,
  type ContextCompilation,
  type MarketplaceExecution,
} from "@/lib/asympta-marketplace-intent";
import {
  marketplaceCurrentRequestForFailure,
  marketplaceCurrentRequestForProfile,
  marketplaceCurrentRequestForStart,
  marketplaceCurrentRequestFromExecution,
  type MarketplaceProfileRequiredDetail,
  type MarketplaceRequestLocale,
} from "@/lib/asympta-marketplace-request-routing";
import { readAsymptaMarketplaceProfile } from "@/lib/asympta-user-preferences";

type MarketplaceBrowserBridge = {
  runIntent: (intent: string) => Promise<MarketplaceExecution | null>;
};

type MarketplaceWindow = Window & {
  __ASYMPTA_MARKETPLACE__?: MarketplaceBrowserBridge;
};

type ClaimedIntent = {
  intent: string;
  source: AsymptaCurrentRequestSource;
  compilation: ContextCompilation & { envelope: NonNullable<ContextCompilation["envelope"]> };
};

const BRIDGE_WAIT_FRAMES = 180;
const DUPLICATE_WINDOW_MS = 500;

function localeFromDocument(): MarketplaceRequestLocale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function marketplaceWindow() {
  return window as MarketplaceWindow;
}

function compileMarketplaceIntent(intent: string): ClaimedIntent["compilation"] | null {
  const compilation = compileAsymptaContext(intent, {
    locale: localeFromDocument(),
    now: Date.now(),
    profile: readAsymptaMarketplaceProfile(),
  });
  return compilation.supported && compilation.envelope
    ? compilation as ClaimedIntent["compilation"]
    : null;
}

function requestSource(intent: string): AsymptaCurrentRequestSource {
  const draftIntent = document.querySelector<HTMLElement>(".asympta-webmcp-draft small")?.textContent?.trim();
  return draftIntent === intent ? "webmcp" : "human";
}

function setControlledTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(textarea, value);
  else textarea.value = value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function waitForMarketplaceBridge(isDisposed: () => boolean) {
  return new Promise<MarketplaceBrowserBridge>((resolve, reject) => {
    let frame = 0;
    const check = () => {
      if (isDisposed()) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const bridge = marketplaceWindow().__ASYMPTA_MARKETPLACE__;
      if (bridge) {
        resolve(bridge);
        return;
      }
      frame += 1;
      if (frame >= BRIDGE_WAIT_FRAMES) {
        reject(new Error("The simulated marketplace bridge is unavailable."));
        return;
      }
      window.requestAnimationFrame(check);
    };
    check();
  });
}

export function AsymptaMarketplaceIntentRouter() {
  const activeRequestIdRef = useRef<string | null>(null);
  const sourceByRequestRef = useRef(new Map<string, AsymptaCurrentRequestSource>());
  const lastClaimRef = useRef<{ requestId: string; at: number } | null>(null);

  useEffect(() => {
    let disposed = false;

    const releaseOwnership = () => {
      activeRequestIdRef.current = null;
      delete document.documentElement.dataset.asymptaIntentOwner;
      delete document.documentElement.dataset.asymptaMarketplaceRequest;
    };

    const claim = async ({ intent, source, compilation }: ClaimedIntent) => {
      const envelope = compilation.envelope;
      const duplicate = lastClaimRef.current;
      if (duplicate?.requestId === envelope.requestId && performance.now() - duplicate.at < DUPLICATE_WINDOW_MS) return;
      lastClaimRef.current = { requestId: envelope.requestId, at: performance.now() };
      activeRequestIdRef.current = envelope.requestId;
      sourceByRequestRef.current.set(envelope.requestId, source);
      document.documentElement.dataset.asymptaIntentOwner = "marketplace";
      document.documentElement.dataset.asymptaMarketplaceRequest = envelope.requestId;
      publishAsymptaCurrentRequest(marketplaceCurrentRequestForStart(envelope, source, localeFromDocument()));

      try {
        const bridge = await waitForMarketplaceBridge(() => disposed || activeRequestIdRef.current !== envelope.requestId);
        await bridge.runIntent(intent);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (activeRequestIdRef.current !== envelope.requestId) return;
        publishAsymptaCurrentRequest(marketplaceCurrentRequestForFailure(
          envelope,
          source,
          localeFromDocument(),
          error instanceof Error ? error.message : undefined,
        ));
      }
    };

    const claimedIntent = (intent: string): ClaimedIntent | null => {
      const clean = intent.replace(/\s+/g, " ").trim();
      if (!clean) return null;
      const compilation = compileMarketplaceIntent(clean);
      return compilation ? { intent: clean, source: requestSource(clean), compilation } : null;
    };

    const intercept = (event: Event, textarea: HTMLTextAreaElement) => {
      const claimed = claimedIntent(textarea.value);
      if (!claimed) {
        releaseOwnership();
        return false;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setControlledTextareaValue(textarea, "");
      void claim(claimed);
      return true;
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form?.matches("form.asympta-intent-composer")) return;
      const textarea = form.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea) intercept(event, textarea);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (!textarea?.closest("form.asympta-intent-composer")) return;
      intercept(event, textarea);
    };

    const onExecution = (event: Event) => {
      const execution = (event as CustomEvent<MarketplaceExecution>).detail;
      if (!execution?.envelope?.requestId || execution.envelope.requestId !== activeRequestIdRef.current) return;
      const source = sourceByRequestRef.current.get(execution.envelope.requestId) ?? "human";
      document.documentElement.dataset.asymptaIntentOwner = "marketplace";
      publishAsymptaCurrentRequest(marketplaceCurrentRequestFromExecution(
        execution,
        source,
        localeFromDocument(),
      ));
    };

    const onProfileRequired = (event: Event) => {
      const detail = (event as CustomEvent<MarketplaceProfileRequiredDetail>).detail;
      if (!detail?.requestId || detail.requestId !== activeRequestIdRef.current) return;
      const source = sourceByRequestRef.current.get(detail.requestId) ?? "human";
      publishAsymptaCurrentRequest(marketplaceCurrentRequestForProfile(
        detail,
        source,
        localeFromDocument(),
      ));
    };

    window.addEventListener("submit", onSubmit, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener(MARKETPLACE_EXECUTION_EVENT, onExecution);
    window.addEventListener(MARKETPLACE_PROFILE_REQUIRED_EVENT, onProfileRequired);

    return () => {
      disposed = true;
      window.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener(MARKETPLACE_EXECUTION_EVENT, onExecution);
      window.removeEventListener(MARKETPLACE_PROFILE_REQUIRED_EVENT, onProfileRequired);
      releaseOwnership();
    };
  }, []);

  return <span className={styles.router} data-asympta-marketplace-intent-router="true" aria-hidden="true" />;
}

"use client";

import { useEffect } from "react";

import type { AsymptaUniversalBenchmarkReport } from "@/lib/asympta-universal-benchmark";
import type { AdaptiveInteractionSchema } from "@/lib/asympta-adaptive-interaction";

type BrowserBenchmarkBridge = {
  run: (options?: { coreCount?: number; stressCount?: number; seed?: number }) => AsymptaUniversalBenchmarkReport;
  cases: (count?: number) => unknown[];
  stressCases: (options?: { count?: number; seed?: number }) => unknown[];
  compileClarification: (input: {
    intent: string;
    missingFields: string[];
    locale?: string;
  }) => AdaptiveInteractionSchema;
};

declare global {
  interface Window {
    __ASYMPTA_BENCHMARK__?: BrowserBenchmarkBridge;
  }
}

export function AsymptaUniversalBenchmarkBridge() {
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    if (!parameters.has("asympta-benchmark")) return;

    let cancelled = false;
    void Promise.all([
      import("@/lib/asympta-universal-benchmark"),
      import("@/lib/asympta-adaptive-interaction"),
    ]).then(([benchmark, adaptive]) => {
      if (cancelled) return;
      window.__ASYMPTA_BENCHMARK__ = {
        run: benchmark.runUniversalBenchmark,
        cases: benchmark.generateUniversalUseCases,
        stressCases: (options = {}) => benchmark.generateUniversalStressCases(options),
        compileClarification: (input) => adaptive.createAdaptiveInteractionSchema({
          ...input,
          interactionId: "browser-benchmark-clarification",
          now: "2026-08-31T09:00:00.000Z",
        }),
      };
      document.documentElement.dataset.asymptaBenchmark = "ready";
      window.dispatchEvent(new CustomEvent("asympta:benchmark-ready"));
    }).catch((error) => {
      document.documentElement.dataset.asymptaBenchmark = "failed";
      console.error("Asympta benchmark bridge failed", error);
    });

    return () => {
      cancelled = true;
      if (window.__ASYMPTA_BENCHMARK__) delete window.__ASYMPTA_BENCHMARK__;
      delete document.documentElement.dataset.asymptaBenchmark;
    };
  }, []);

  return null;
}

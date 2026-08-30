"use client";

import { useLayoutEffect } from "react";

type GlobalWorldBridge = {
  setScale: (scale: "world" | "city") => void;
};

const SCALE_KEY = "asympta-world.scale.v1";
const RESTORE_KEY = "asympta-world.cute-agents-restored.v1";
const RETRY_MS = 120;
const MAX_ATTEMPTS = 50;

function browserWindow() {
  return window as unknown as Window & {
    __ASYMPTA_GLOBAL_WORLD__?: GlobalWorldBridge;
  };
}

export function AsymptaCuteAgentVisibility() {
  useLayoutEffect(() => {
    let shouldRestore = false;
    try {
      shouldRestore = localStorage.getItem(RESTORE_KEY) !== "1";
      if (shouldRestore) {
        // The global layer historically defaulted to world scale, which moved the
        // camera away from Tokyo and made the still-mounted animal agents appear
        // to vanish. Migrate that old default back to the living city once.
        localStorage.setItem(SCALE_KEY, "city");
        localStorage.setItem(RESTORE_KEY, "1");
      }
    } catch {
      shouldRestore = true;
    }

    document.documentElement.dataset.asymptaCuteAgents = "visible";
    if (!shouldRestore) return () => { delete document.documentElement.dataset.asymptaCuteAgents; };

    let attempts = 0;
    const restoreCity = () => {
      attempts += 1;
      const bridge = browserWindow().__ASYMPTA_GLOBAL_WORLD__;
      if (!bridge) return false;
      try {
        bridge.setScale("city");
        return true;
      } catch {
        return false;
      }
    };

    if (restoreCity()) {
      return () => { delete document.documentElement.dataset.asymptaCuteAgents; };
    }

    const timer = window.setInterval(() => {
      if (restoreCity() || attempts >= MAX_ATTEMPTS) window.clearInterval(timer);
    }, RETRY_MS);

    return () => {
      window.clearInterval(timer);
      delete document.documentElement.dataset.asymptaCuteAgents;
    };
  }, []);

  return null;
}

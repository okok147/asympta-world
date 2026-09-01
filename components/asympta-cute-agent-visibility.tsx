"use client";

import { useLayoutEffect } from "react";

type GlobalWorldBridge = {
  setScale: (scale: "world" | "city") => void;
};

type MapBridge = {
  flyTo: (options: Record<string, unknown>) => void;
};

const SCALE_KEY = "asympta-world.scale.v1";
const RESTORE_KEY = "asympta-world.cute-agents-restored.v1";
const RETRY_MS = 120;
const MAX_ATTEMPTS = 50;
const TOKYO_CENTER: [number, number] = [139.7544, 35.6762];
const TOKYO_CUTE_AGENT_ZOOM = 12.2;

function browserWindow() {
  return window as unknown as Window & {
    __ASYMPTA_GLOBAL_WORLD__?: GlobalWorldBridge;
    __ASYMPTA_MAP__?: MapBridge;
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
      const currentWindow = browserWindow();
      const bridge = currentWindow.__ASYMPTA_GLOBAL_WORLD__;
      const map = currentWindow.__ASYMPTA_MAP__;

      // The global bridge can mount before MapLibre finishes constructing its
      // real map instance. Treating the bridge alone as success leaves the
      // foreground agent off-screen on fast hydration/remount paths. Only stop
      // retrying after both coordination state and the actual camera are ready.
      if (!bridge || !map) return false;

      try {
        bridge.setScale("city");
        // Restore the original wider Tokyo living-city composition instead of the
        // tighter global-layer city zoom, so foreground and ambient animals are
        // visible together again.
        map.flyTo({
          center: TOKYO_CENTER,
          zoom: TOKYO_CUTE_AGENT_ZOOM,
          bearing: 0,
          pitch: 0,
          duration: 520,
          essential: true,
        });
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

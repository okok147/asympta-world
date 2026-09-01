"use client";

import { useLayoutEffect } from "react";

type GlobalWorldBridge = {
  setScale: (scale: "world" | "city") => void;
};

type MapBridge = {
  flyTo: (options: Record<string, unknown>) => void;
};

type DemoBridge = {
  snapshot: () => unknown;
};

type Point = { lon: number; lat: number };

const SCALE_KEY = "asympta-world.scale.v1";
const RESTORE_KEY = "asympta-world.cute-agents-restored.v2";
const RETRY_MS = 140;
const MAX_ATTEMPTS = 64;
const TOKYO_CENTER: [number, number] = [139.7544, 35.6762];
const TOKYO_CUTE_AGENT_ZOOM = 12.2;

function browserWindow() {
  return window as unknown as Window & {
    __ASYMPTA_GLOBAL_WORLD__?: GlobalWorldBridge;
    __ASYMPTA_MAP__?: MapBridge;
    __ASYMPTA_DEMO__?: DemoBridge;
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function activeAgentPoint(): Point | null {
  const root = record(browserWindow().__ASYMPTA_DEMO__?.snapshot?.());
  const foreground = record(root?.foreground);
  if (!foreground || !Array.isArray(foreground.agents)) return null;
  const agents = foreground.agents.map(record).filter((agent): agent is Record<string, unknown> => Boolean(agent));
  const active = agents.find((agent) => ["moving", "working", "sharing", "returning"].includes(String(agent.status)))
    ?? agents[0];
  if (!active) return null;
  const lon = Number(active.lon);
  const lat = Number(active.lat);
  return Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : null;
}

function foregroundMarkerVisible() {
  const markers = [...document.querySelectorAll<HTMLElement>(".animal-map-marker--foreground")];
  return markers.some((marker) => {
    const rect = marker.getBoundingClientRect();
    const style = getComputedStyle(marker);
    return !marker.hidden
      && style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || 1) > 0
      && rect.width > 0
      && rect.height > 0
      && rect.right >= 0
      && rect.bottom >= 0
      && rect.left <= window.innerWidth
      && rect.top <= window.innerHeight;
  });
}

function markRestored() {
  try { localStorage.setItem(RESTORE_KEY, "1"); } catch {}
}

export function AsymptaCuteAgentVisibility() {
  useLayoutEffect(() => {
    let shouldRestore = false;
    try {
      shouldRestore = localStorage.getItem(RESTORE_KEY) !== "1";
      if (shouldRestore) {
        // Keep the canonical living-city scale while the real map and foreground
        // markers hydrate. Do not mark the migration complete until an agent is
        // actually visible in the viewport.
        localStorage.setItem(SCALE_KEY, "city");
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

      // MapLibre and the raster pencil tiles can become available before the
      // foreground marker layer has finished mounting. Bridge availability alone
      // is therefore not proof that the agents are visible.
      if (!bridge || !map) return false;
      if (foregroundMarkerVisible()) {
        markRestored();
        return true;
      }

      try {
        if (document.documentElement.dataset.asymptaScale !== "city") bridge.setScale("city");
        const active = activeAgentPoint();
        const center: [number, number] = active ? [active.lon, active.lat] : TOKYO_CENTER;
        map.flyTo({
          center,
          zoom: TOKYO_CUTE_AGENT_ZOOM,
          bearing: 0,
          pitch: 0,
          // First attempt keeps a gentle transition. Subsequent bounded retries
          // use an immediate recenter so a slow raster/style hydration cannot
          // continuously restart the same animation.
          duration: attempts === 1 ? 420 : 0,
          essential: true,
        });
        return false;
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

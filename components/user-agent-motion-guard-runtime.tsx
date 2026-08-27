"use client";

import { useEffect } from "react";

const PREFS_KEY = "asympta-user-preferences-v1";
const VISIBILITY_MIGRATION_KEY = "asympta-user-motion-visible-v1";
const OWNER_NAME = "Your Agent";
const HOME_X = 1085;
const HOME_Y = 665;
const WORLD_MIN_X = 68;
const WORLD_MAX_X = 1132;
const WORLD_MIN_Y = 78;
const WORLD_MAX_Y = 688;

type MotionTargetDetail = {
  agentName?: string;
  x?: number;
  y?: number;
  durationMs?: number;
};

type TargetState = {
  x: number;
  y: number;
  expiresAt: number;
};

type Point = {
  x: number;
  y: number;
  changedAt: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function readPosition(node: HTMLElement) {
  return {
    x: Number.parseFloat(node.style.left) || node.offsetLeft || HOME_X,
    y: Number.parseFloat(node.style.top) || node.offsetTop || HOME_Y,
  };
}

function writePosition(node: HTMLElement, x: number, y: number) {
  node.style.left = clamp(x, WORLD_MIN_X, WORLD_MAX_X).toFixed(2) + "px";
  node.style.top = clamp(y, WORLD_MIN_Y, WORLD_MAX_Y).toFixed(2) + "px";
}

function migrateCameraFollowDefault() {
  try {
    if (localStorage.getItem(VISIBILITY_MIGRATION_KEY) === "1") return;
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        ...parsed,
        version: 1,
        cameraFollow: false,
      }),
    );
    localStorage.setItem(VISIBILITY_MIGRATION_KEY, "1");
  } catch {
    // The movement guard still works when local storage is unavailable.
  }
}

export function UserAgentMotionGuardRuntime() {
  useEffect(() => {
    // The first-run camera should show the agent crossing the world rather than
    // continuously pinning it to the exact centre of the screen. Users can
    // still opt back into Camera follow from the agent menu.
    migrateCameraFollowDefault();

    let frame = 0;
    let host: HTMLElement | null = null;
    let lastTick = performance.now();
    let lastPoint: Point = {
      x: HOME_X,
      y: HOME_Y,
      changedAt: performance.now(),
    };
    let explicitTarget: TargetState | null = null;
    let fallbackRoamTarget: TargetState | null = null;

    const onMotionTarget = (event: Event) => {
      const detail = (event as CustomEvent<MotionTargetDetail>).detail ?? {};
      if (
        detail.agentName !== OWNER_NAME ||
        !Number.isFinite(detail.x) ||
        !Number.isFinite(detail.y)
      ) {
        return;
      }
      explicitTarget = {
        x: clamp(Number(detail.x), WORLD_MIN_X, WORLD_MAX_X),
        y: clamp(Number(detail.y), WORLD_MIN_Y, WORLD_MAX_Y),
        expiresAt:
          Date.now() +
          Math.max(2400, Math.min(18000, Number(detail.durationMs ?? 6200) + 1800)),
      };
      fallbackRoamTarget = null;
    };

    const chooseFallbackRoam = (point: Point) => {
      const radius = 70 + Math.random() * 120;
      const angle = Math.random() * Math.PI * 2;
      fallbackRoamTarget = {
        x: clamp(point.x + Math.cos(angle) * radius, WORLD_MIN_X, WORLD_MAX_X),
        y: clamp(point.y + Math.sin(angle) * radius, WORLD_MIN_Y, WORLD_MAX_Y),
        expiresAt: Date.now() + 9000,
      };
    };

    const animate = (time: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (time - lastTick) / 1000));
      lastTick = time;
      const now = Date.now();
      const nextHost = document.querySelector<HTMLElement>(".mission-user-agent");

      if (nextHost !== host) {
        host = nextHost;
        if (host) {
          const point = readPosition(host);
          lastPoint = { ...point, changedAt: time };
          host.dataset.userMotionGuard = "active";
        }
        fallbackRoamTarget = null;
      }

      if (host) {
        let current = readPosition(host);
        const home = { x: HOME_X, y: HOME_Y };

        // MissionSocietyRuntime historically re-renders the user agent with its
        // home coordinates. Detect that large instantaneous jump and restore the
        // last genuine motion position instead of letting React visually pin it.
        const resetToHome =
          distance(current, home) < 1.5 &&
          distance(lastPoint, home) > 22 &&
          time - lastPoint.changedAt < 1400;
        if (resetToHome) {
          writePosition(host, lastPoint.x, lastPoint.y);
          current = { x: lastPoint.x, y: lastPoint.y };
        }

        const observedDelta = distance(current, lastPoint);
        if (observedDelta > 0.55) {
          lastPoint = { ...current, changedAt: time };
        }

        if (explicitTarget && explicitTarget.expiresAt < now) explicitTarget = null;
        if (fallbackRoamTarget && fallbackRoamTarget.expiresAt < now) {
          fallbackRoamTarget = null;
        }

        const activeTarget = explicitTarget ?? fallbackRoamTarget;
        const stalledFor = time - lastPoint.changedAt;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // Only take over if the normal motion runtime has stopped changing the
        // user-agent position. This keeps one effective owner during healthy runs.
        if (activeTarget && stalledFor > 360) {
          const dx = activeTarget.x - current.x;
          const dy = activeTarget.y - current.y;
          const remaining = Math.hypot(dx, dy);
          if (remaining <= 3) {
            if (explicitTarget === activeTarget) explicitTarget = null;
            if (fallbackRoamTarget === activeTarget) fallbackRoamTarget = null;
            host.classList.remove("is-world-walking");
            host.classList.add("is-world-paused");
          } else {
            const speed = reducedMotion ? 22 : 38;
            const step = Math.min(remaining, speed * dt);
            const nextX = current.x + (dx / remaining) * step;
            const nextY = current.y + (dy / remaining) * step;
            writePosition(host, nextX, nextY);
            lastPoint = { x: nextX, y: nextY, changedAt: time };
            host.classList.add("is-world-walking");
            host.classList.remove("is-world-paused");
          }
        } else if (
          !activeTarget &&
          !reducedMotion &&
          !host.classList.contains("is-world-encountering") &&
          stalledFor > 2600
        ) {
          // A final safety net for the web build: if the normal roaming loop is
          // absent or blocked, the user agent still behaves like a living agent.
          chooseFallbackRoam(lastPoint);
        }
      }

      frame = window.requestAnimationFrame(animate);
    };

    window.addEventListener("asympta:agent-motion-target", onMotionTarget);
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("asympta:agent-motion-target", onMotionTarget);
      window.cancelAnimationFrame(frame);
      host?.removeAttribute("data-user-motion-guard");
    };
  }, []);

  return null;
}

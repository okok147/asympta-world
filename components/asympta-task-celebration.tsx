"use client";

import { useEffect, useRef } from "react";

import { subscribeAsymptaCurrentRequest } from "@/lib/asympta-current-request";

type TaskSnapshot = {
  id: string;
  agentId: string;
  status: string;
};

type DemoSnapshot = {
  foreground?: {
    tasks?: TaskSnapshot[];
  };
};

type ActivityDetail = {
  activity?: {
    id?: string;
    status?: string;
  };
  event?: {
    status?: string;
  };
};

const CELEBRATION_SYNC_MS = 280;
const CELEBRATION_LIFETIME_MS = 1_150;
const SCREEN_CELEBRATION_LIFETIME_MS = 1_720;
const SCREEN_CELEBRATION_COOLDOWN_MS = 1_000;
const PARTICLES = [
  [0, -23],
  [16, -17],
  [23, 0],
  [16, 17],
  [0, 23],
  [-16, 17],
  [-23, 0],
  [-16, -17],
] as const;

const SPLASHES = [
  [8, 18, 22, 0],
  [24, 76, 18, 1],
  [45, 30, 26, 2],
  [67, 82, 24, 3],
  [82, 20, 20, 4],
  [91, 58, 17, 5],
] as const;

const SCREEN_SPARKS = [
  [10, 42, -22, -48, 0],
  [18, 70, 28, -56, 1],
  [31, 17, -18, 46, 2],
  [39, 86, 22, 54, 3],
  [52, 52, -34, -60, 4],
  [61, 13, 30, 48, 5],
  [72, 70, -26, 58, 0],
  [81, 34, 34, -48, 1],
  [91, 78, -24, -46, 2],
  [95, 12, 20, 42, 3],
] as const;

function celebrate(agentId: string) {
  const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${agentId}"]`);
  if (!marker || marker.querySelector(".asympta-task-celebration")) return;

  const burst = document.createElement("span");
  burst.className = "asympta-task-celebration";
  burst.setAttribute("aria-hidden", "true");

  const ring = document.createElement("i");
  ring.className = "asympta-task-celebration__ring";
  burst.appendChild(ring);

  PARTICLES.forEach(([x, y], index) => {
    const particle = document.createElement("i");
    particle.className = "asympta-task-celebration__particle";
    particle.style.setProperty("--burst-x", `${x}px`);
    particle.style.setProperty("--burst-y", `${y}px`);
    particle.style.setProperty("--burst-delay", `${index * 18}ms`);
    particle.dataset.kind = String(index % 3);
    burst.appendChild(particle);
  });

  marker.appendChild(burst);
  window.setTimeout(() => burst.remove(), CELEBRATION_LIFETIME_MS);
}

function celebrateScreen() {
  document.querySelector(".asympta-screen-celebration")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "asympta-screen-celebration";
  overlay.setAttribute("aria-hidden", "true");

  const wash = document.createElement("i");
  wash.className = "asympta-screen-celebration__wash";
  overlay.appendChild(wash);

  SPLASHES.forEach(([x, y, size, kind], index) => {
    const splash = document.createElement("i");
    splash.className = "asympta-screen-celebration__splash";
    splash.style.setProperty("--splash-x", `${x}%`);
    splash.style.setProperty("--splash-y", `${y}%`);
    splash.style.setProperty("--splash-size", `${size}vmin`);
    splash.style.setProperty("--splash-delay", `${index * 52}ms`);
    splash.dataset.kind = String(kind);
    overlay.appendChild(splash);
  });

  SCREEN_SPARKS.forEach(([x, y, dx, dy, kind], index) => {
    const spark = document.createElement("i");
    spark.className = "asympta-screen-celebration__spark";
    spark.style.setProperty("--spark-x", `${x}%`);
    spark.style.setProperty("--spark-y", `${y}%`);
    spark.style.setProperty("--spark-dx", `${dx}px`);
    spark.style.setProperty("--spark-dy", `${dy}px`);
    spark.style.setProperty("--spark-delay", `${90 + index * 28}ms`);
    spark.dataset.kind = String(kind);
    overlay.appendChild(spark);
  });

  document.body.dataset.asymptaCelebrating = "true";
  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
    if (!document.querySelector(".asympta-screen-celebration")) {
      delete document.body.dataset.asymptaCelebrating;
    }
  }, SCREEN_CELEBRATION_LIFETIME_MS);
}

export function AsymptaTaskCelebration() {
  const previousStatusRef = useRef(new Map<string, string>());
  const seededRef = useRef(false);
  const previousAllDoneRef = useRef(false);
  const celebratedRequestIdsRef = useRef(new Set<string>());
  const lastScreenCelebrationAtRef = useRef(0);

  useEffect(() => {
    const screenCelebrateOnce = (key: string) => {
      if (!key || celebratedRequestIdsRef.current.has(key)) return;
      const now = Date.now();
      if (now - lastScreenCelebrationAtRef.current < SCREEN_CELEBRATION_COOLDOWN_MS) return;
      celebratedRequestIdsRef.current.add(key);
      lastScreenCelebrationAtRef.current = now;
      celebrateScreen();
    };

    const unsubscribeRequest = subscribeAsymptaCurrentRequest((request) => {
      if (request.status === "completed") screenCelebrateOnce(`request:${request.requestId}`);
    });

    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      const status = detail?.event?.status ?? detail?.activity?.status;
      const id = detail?.activity?.id;
      if (status === "completed" && id) screenCelebrateOnce(`activity:${id}`);
    };
    window.addEventListener("asympta:activity", onActivity);

    const sync = () => {
      if (document.hidden) return;
      let snapshot: DemoSnapshot | undefined;
      try {
        snapshot = window.__ASYMPTA_DEMO__?.snapshot() as DemoSnapshot | undefined;
      } catch {
        return;
      }

      const tasks = snapshot?.foreground?.tasks ?? [];
      const current = new Map<string, string>();
      for (const task of tasks) current.set(task.id, task.status);

      if (!seededRef.current) {
        previousStatusRef.current = current;
        previousAllDoneRef.current = tasks.length > 0 && tasks.every((task) => task.status === "done");
        seededRef.current = true;
        return;
      }

      for (const task of tasks) {
        const previous = previousStatusRef.current.get(task.id);
        if (task.status === "done" && previous && previous !== "done") celebrate(task.agentId);
      }

      const allDone = tasks.length > 0 && tasks.every((task) => task.status === "done");
      if (allDone && !previousAllDoneRef.current) screenCelebrateOnce(`world:${tasks.map((task) => task.id).sort().join("|")}`);
      previousAllDoneRef.current = allDone;
      previousStatusRef.current = current;
    };

    sync();
    const timer = window.setInterval(sync, CELEBRATION_SYNC_MS);
    return () => {
      window.clearInterval(timer);
      unsubscribeRequest();
      window.removeEventListener("asympta:activity", onActivity);
      document.querySelector(".asympta-screen-celebration")?.remove();
      delete document.body.dataset.asymptaCelebrating;
    };
  }, []);

  return null;
}

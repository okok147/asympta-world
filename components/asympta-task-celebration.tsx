"use client";

import { useEffect, useRef } from "react";

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

const CELEBRATION_SYNC_MS = 280;
const CELEBRATION_LIFETIME_MS = 1_150;
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

export function AsymptaTaskCelebration() {
  const previousStatusRef = useRef(new Map<string, string>());
  const seededRef = useRef(false);

  useEffect(() => {
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
        seededRef.current = true;
        return;
      }

      for (const task of tasks) {
        const previous = previousStatusRef.current.get(task.id);
        if (task.status === "done" && previous && previous !== "done") celebrate(task.agentId);
      }

      previousStatusRef.current = current;
    };

    sync();
    const timer = window.setInterval(sync, CELEBRATION_SYNC_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}

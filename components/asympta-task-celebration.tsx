"use client";

import { useEffect, useRef } from "react";

import {
  subscribeAsymptaCompletionReceipts,
  type AsymptaCompletionReceipt,
} from "@/lib/asympta-completion-receipt";

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

type Locale = "en" | "zh-Hant" | "ja";

const CELEBRATION_SYNC_MS = 280;
const CELEBRATION_LIFETIME_MS = 1_150;
const SCREEN_CELEBRATION_LIFETIME_MS = 5_600;
const SCREEN_CELEBRATION_QUEUE_GAP_MS = 220;
const MAX_CELEBRATED_RECEIPTS = 160;
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

const COPY: Record<Locale, {
  eyebrow: string;
  verified: string;
  simulated: string;
  completed: string;
}> = {
  en: {
    eyebrow: "Job completed",
    verified: "Verified result",
    simulated: "Simulated world",
    completed: "Completed",
  },
  "zh-Hant": {
    eyebrow: "任務完成",
    verified: "已驗證結果",
    simulated: "模擬世界",
    completed: "已完成",
  },
  ja: {
    eyebrow: "ジョブ完了",
    verified: "検証済み",
    simulated: "シミュレーション世界",
    completed: "完了",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

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

function celebrationText(tag: "small" | "strong" | "p" | "span", className: string, text: string) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function createScreenCelebration(receipt: AsymptaCompletionReceipt) {
  const locale = localeFromDocument();
  const copy = COPY[locale];
  const overlay = document.createElement("section");
  overlay.className = "asympta-screen-celebration";
  overlay.dataset.completionId = receipt.id;
  overlay.dataset.verification = receipt.verification;
  overlay.dataset.provenance = receipt.provenance;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "assertive");
  overlay.setAttribute("aria-atomic", "true");

  const wash = document.createElement("i");
  wash.className = "asympta-screen-celebration__wash";
  wash.setAttribute("aria-hidden", "true");
  overlay.appendChild(wash);

  SPLASHES.forEach(([x, y, size, kind], index) => {
    const splash = document.createElement("i");
    splash.className = "asympta-screen-celebration__splash";
    splash.style.setProperty("--splash-x", `${x}%`);
    splash.style.setProperty("--splash-y", `${y}%`);
    splash.style.setProperty("--splash-size", `${size}vmin`);
    splash.style.setProperty("--splash-delay", `${index * 110}ms`);
    splash.dataset.kind = String(kind);
    splash.setAttribute("aria-hidden", "true");
    overlay.appendChild(splash);
  });

  SCREEN_SPARKS.forEach(([x, y, dx, dy, kind], index) => {
    const spark = document.createElement("i");
    spark.className = "asympta-screen-celebration__spark";
    spark.style.setProperty("--spark-x", `${x}%`);
    spark.style.setProperty("--spark-y", `${y}%`);
    spark.style.setProperty("--spark-dx", `${dx}px`);
    spark.style.setProperty("--spark-dy", `${dy}px`);
    spark.style.setProperty("--spark-delay", `${180 + index * 60}ms`);
    spark.dataset.kind = String(kind);
    spark.setAttribute("aria-hidden", "true");
    overlay.appendChild(spark);
  });

  const content = document.createElement("div");
  content.className = "asympta-screen-celebration__content";

  const seal = document.createElement("span");
  seal.className = "asympta-screen-celebration__seal";
  seal.textContent = "✓";
  seal.setAttribute("aria-hidden", "true");
  content.appendChild(seal);

  content.appendChild(celebrationText("small", "asympta-screen-celebration__eyebrow", copy.eyebrow));
  content.appendChild(celebrationText("strong", "asympta-screen-celebration__title", receipt.title || copy.completed));
  content.appendChild(celebrationText("p", "asympta-screen-celebration__summary", receipt.summary));

  const meta = document.createElement("div");
  meta.className = "asympta-screen-celebration__meta";
  meta.appendChild(celebrationText("span", "is-verified", copy.verified));
  meta.appendChild(celebrationText("span", receipt.simulated ? "is-simulated" : "is-completed", receipt.simulated ? copy.simulated : copy.completed));
  content.appendChild(meta);
  overlay.appendChild(content);

  document.body.dataset.asymptaCelebrating = "true";
  document.body.appendChild(overlay);
  return overlay;
}

function removeScreenCelebration(overlay: HTMLElement | null) {
  overlay?.remove();
  if (!document.querySelector(".asympta-screen-celebration")) {
    delete document.body.dataset.asymptaCelebrating;
  }
}

export function AsymptaTaskCelebration() {
  const previousStatusRef = useRef(new Map<string, string>());
  const seededRef = useRef(false);

  useEffect(() => {
    const queue: AsymptaCompletionReceipt[] = [];
    const celebratedIds: string[] = [];
    let activeOverlay: HTMLElement | null = null;
    let lifetimeTimer = 0;
    let gapTimer = 0;
    let disposed = false;

    const startNext = () => {
      if (disposed || activeOverlay || !queue.length) return;
      const receipt = queue.shift();
      if (!receipt) return;
      activeOverlay = createScreenCelebration(receipt);
      lifetimeTimer = window.setTimeout(() => {
        removeScreenCelebration(activeOverlay);
        activeOverlay = null;
        gapTimer = window.setTimeout(startNext, SCREEN_CELEBRATION_QUEUE_GAP_MS);
      }, SCREEN_CELEBRATION_LIFETIME_MS);
    };

    const unsubscribeReceipt = subscribeAsymptaCompletionReceipts((receipt) => {
      if (celebratedIds.includes(receipt.id)) return;
      celebratedIds.push(receipt.id);
      if (celebratedIds.length > MAX_CELEBRATED_RECEIPTS) celebratedIds.splice(0, celebratedIds.length - MAX_CELEBRATED_RECEIPTS);
      queue.push(receipt);
      startNext();
    });

    const syncTaskBursts = () => {
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

    syncTaskBursts();
    const syncTimer = window.setInterval(syncTaskBursts, CELEBRATION_SYNC_MS);
    return () => {
      disposed = true;
      window.clearInterval(syncTimer);
      window.clearTimeout(lifetimeTimer);
      window.clearTimeout(gapTimer);
      unsubscribeReceipt();
      queue.length = 0;
      removeScreenCelebration(activeOverlay);
      document.querySelectorAll(".asympta-screen-celebration").forEach((node) => node.remove());
      delete document.body.dataset.asymptaCelebrating;
    };
  }, []);

  return null;
}

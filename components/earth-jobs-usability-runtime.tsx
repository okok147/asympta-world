"use client";

import { useEffect } from "react";

const PANEL_SELECTOR = ".earth-panel";
const JOBS_ATTRIBUTE = "data-earth-jobs-panel";

function isJobsPanel(panel: HTMLElement) {
  return panel.querySelector("header strong")?.textContent?.trim() === "Opportunity Mode";
}

function markPanels() {
  document.querySelectorAll<HTMLElement>(PANEL_SELECTOR).forEach((panel) => {
    if (isJobsPanel(panel)) panel.setAttribute(JOBS_ATTRIBUTE, "true");
    else panel.removeAttribute(JOBS_ATTRIBUTE);
  });
}

/**
 * Earth panels are rendered inside the draggable/zoomable world viewport.
 * The viewport intentionally consumes pointer and wheel input, but a long jobs
 * panel must behave like a normal scroll surface. Stop those gestures at the
 * panel boundary so they never become canvas pan/zoom gestures.
 */
export function EarthJobsUsabilityRuntime() {
  useEffect(() => {
    const stopWorldGesture = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const panel = target?.closest<HTMLElement>(`[${JOBS_ATTRIBUTE}="true"]`);
      if (!panel) return;
      event.stopPropagation();
    };

    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      const panel = target?.closest<HTMLElement>(`[${JOBS_ATTRIBUTE}="true"]`);
      if (!panel) return;

      // Let the panel consume the wheel naturally. Only stop propagation so
      // HomePage.onWheel cannot reinterpret it as world zoom.
      event.stopPropagation();
    };

    const scan = () => markPanels();
    const first = window.setTimeout(scan, 0);
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("pointerdown", stopWorldGesture, true);
    document.addEventListener("pointermove", stopWorldGesture, true);
    document.addEventListener("pointerup", stopWorldGesture, true);
    document.addEventListener("pointercancel", stopWorldGesture, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    document.addEventListener("touchstart", stopWorldGesture, { capture: true, passive: true });
    document.addEventListener("touchmove", stopWorldGesture, { capture: true, passive: true });

    return () => {
      window.clearTimeout(first);
      observer.disconnect();
      document.removeEventListener("pointerdown", stopWorldGesture, true);
      document.removeEventListener("pointermove", stopWorldGesture, true);
      document.removeEventListener("pointerup", stopWorldGesture, true);
      document.removeEventListener("pointercancel", stopWorldGesture, true);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("touchstart", stopWorldGesture, true);
      document.removeEventListener("touchmove", stopWorldGesture, true);
      document
        .querySelectorAll<HTMLElement>(`[${JOBS_ATTRIBUTE}="true"]`)
        .forEach((panel) => panel.removeAttribute(JOBS_ATTRIBUTE));
    };
  }, []);

  return (
    <style>{`
      .earth-panel[data-earth-jobs-panel="true"] {
        max-height: calc(100svh - 190px) !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        scrollbar-gutter: stable;
        touch-action: pan-y !important;
        -webkit-overflow-scrolling: touch;
        padding-bottom: max(18px, calc(12px + env(safe-area-inset-bottom))) !important;
        pointer-events: auto !important;
        user-select: text;
      }

      .earth-panel[data-earth-jobs-panel="true"] > header {
        position: sticky;
        z-index: 4;
        top: -11px;
        margin: -11px -11px 0;
        padding: 11px 11px 8px;
        background: linear-gradient(
          to bottom,
          rgba(248,247,241,.995) 78%,
          rgba(248,247,241,.92)
        );
        backdrop-filter: blur(18px);
      }

      .earth-panel[data-earth-jobs-panel="true"] .earth-list {
        max-height: min(230px, 34svh) !important;
        overscroll-behavior: contain;
        touch-action: pan-y !important;
      }

      .earth-panel[data-earth-jobs-panel="true"] button,
      .earth-panel[data-earth-jobs-panel="true"] input,
      .earth-panel[data-earth-jobs-panel="true"] textarea,
      .earth-panel[data-earth-jobs-panel="true"] select {
        pointer-events: auto !important;
        touch-action: manipulation;
      }

      .earth-panel[data-earth-jobs-panel="true"] .earth-action {
        cursor: pointer;
      }

      .earth-panel[data-earth-jobs-panel="true"] .earth-action:disabled {
        cursor: default;
        opacity: .48;
      }

      @media (max-width: 620px) {
        .earth-panel[data-earth-jobs-panel="true"] {
          max-height: calc(100svh - 188px) !important;
          padding-bottom: max(22px, calc(14px + env(safe-area-inset-bottom))) !important;
        }
      }
    `}</style>
  );
}

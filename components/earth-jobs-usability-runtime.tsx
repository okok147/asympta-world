"use client";

import { useEffect } from "react";

const PANEL_SELECTOR = ".earth-panel";
const JOBS_ATTRIBUTE = "data-earth-jobs-panel";

function isJobsPanel(panel: HTMLElement) {
  return panel.querySelector("header strong")?.textContent?.trim() === "Opportunity Mode";
}

/**
 * Earth panels live inside a draggable / zoomable viewport. A long jobs panel
 * must keep its own scroll and controls without leaking those gestures into the
 * world canvas. Bind at the panel itself so inputs/buttons still receive their
 * native pointer events before propagation stops.
 */
export function EarthJobsUsabilityRuntime() {
  useEffect(() => {
    const boundPanels = new Set<HTMLElement>();
    const stopWorldGesture = (event: Event) => event.stopPropagation();
    const stopWorldWheel = (event: WheelEvent) => event.stopPropagation();

    const bindPanel = (panel: HTMLElement) => {
      if (boundPanels.has(panel)) return;
      boundPanels.add(panel);
      panel.setAttribute(JOBS_ATTRIBUTE, "true");
      panel.addEventListener("pointerdown", stopWorldGesture);
      panel.addEventListener("pointermove", stopWorldGesture);
      panel.addEventListener("pointerup", stopWorldGesture);
      panel.addEventListener("pointercancel", stopWorldGesture);
      panel.addEventListener("wheel", stopWorldWheel, { passive: true });
      panel.addEventListener("touchstart", stopWorldGesture, { passive: true });
      panel.addEventListener("touchmove", stopWorldGesture, { passive: true });
    };

    const unbindPanel = (panel: HTMLElement) => {
      panel.removeAttribute(JOBS_ATTRIBUTE);
      panel.removeEventListener("pointerdown", stopWorldGesture);
      panel.removeEventListener("pointermove", stopWorldGesture);
      panel.removeEventListener("pointerup", stopWorldGesture);
      panel.removeEventListener("pointercancel", stopWorldGesture);
      panel.removeEventListener("wheel", stopWorldWheel);
      panel.removeEventListener("touchstart", stopWorldGesture);
      panel.removeEventListener("touchmove", stopWorldGesture);
      boundPanels.delete(panel);
    };

    const scan = () => {
      const livePanels = new Set(
        Array.from(document.querySelectorAll<HTMLElement>(PANEL_SELECTOR)).filter(isJobsPanel),
      );

      livePanels.forEach(bindPanel);
      Array.from(boundPanels).forEach((panel) => {
        if (!panel.isConnected || !livePanels.has(panel)) unbindPanel(panel);
      });
    };

    const first = window.setTimeout(scan, 0);
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(first);
      observer.disconnect();
      Array.from(boundPanels).forEach(unbindPanel);
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
        max-height: min(190px, 28svh) !important;
        overscroll-behavior-y: auto !important;
        touch-action: pan-y !important;
      }

      .earth-panel[data-earth-jobs-panel="true"] button,
      .earth-panel[data-earth-jobs-panel="true"] input,
      .earth-panel[data-earth-jobs-panel="true"] textarea,
      .earth-panel[data-earth-jobs-panel="true"] select {
        pointer-events: auto !important;
      }

      .earth-panel[data-earth-jobs-panel="true"] button {
        touch-action: manipulation;
      }

      .earth-panel[data-earth-jobs-panel="true"] input,
      .earth-panel[data-earth-jobs-panel="true"] textarea,
      .earth-panel[data-earth-jobs-panel="true"] select {
        touch-action: auto;
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

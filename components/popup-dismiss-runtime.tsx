"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type PopupTargets = {
  places: HTMLElement | null;
  route: HTMLElement | null;
};

const EMPTY_TARGETS: PopupTargets = {
  places: null,
  route: null,
};

const CLOSE_SELECTOR = [
  '[data-asympta-runtime-close="true"]',
  '[data-slot="sheet-close"]',
  'button[aria-label^="Close"]',
  'button[aria-label^="Cancel"]',
  ".earth-close",
  ".community-close",
  ".city-inspector-close",
  ".discovery-close",
  ".territory-confirm-close",
  ".agent-task-close",
].join(", ");

function isVisible(node: HTMLElement) {
  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || "1") > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function ancestorZIndex(node: HTMLElement) {
  let current: HTMLElement | null = node;
  let highest = 0;
  while (current) {
    const value = Number.parseInt(window.getComputedStyle(current).zIndex, 10);
    if (Number.isFinite(value)) highest = Math.max(highest, value);
    current = current.parentElement;
  }
  return highest;
}

function DismissButton({
  label,
  onDismiss,
}: {
  label: string;
  onDismiss: () => void;
}) {
  return (
    <button
      type="button"
      className="asympta-runtime-popup-close"
      data-asympta-runtime-close="true"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    >
      <X aria-hidden="true" />
    </button>
  );
}

export function PopupDismissRuntime() {
  const [targets, setTargets] = useState<PopupTargets>(EMPTY_TARGETS);
  const [routeDismissed, setRouteDismissed] = useState(false);

  useEffect(() => {
    const scan = () => {
      const next: PopupTargets = {
        places: document.querySelector<HTMLElement>(".places-directory-panel"),
        route: document.querySelector<HTMLElement>(".route-visit-card"),
      };
      setTargets((current) =>
        current.places === next.places && current.route === next.route
          ? current
          : next,
      );
    };

    const initial = window.setTimeout(scan, 0);
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(initial);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const hidden = routeDismissed && Boolean(targets.route);
    if (hidden) root.dataset.routeComparisonDismissed = "true";
    else delete root.dataset.routeComparisonDismissed;
    return () => {
      delete root.dataset.routeComparisonDismissed;
    };
  }, [routeDismissed, targets.route]);

  useEffect(() => {
    const resetForNewTask = (event: Event) => {
      if (event.type === "submit") {
        const form = event.target as HTMLFormElement | null;
        if (form?.classList.contains("need-composer")) setRouteDismissed(false);
        return;
      }
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const progress = Number(detail.progress ?? 100);
      const text = String(detail.label ?? "") + " " + String(detail.detail ?? "");
      if (progress <= 16 && /(bread|bakery|loaf|麵包|比較|compare)/i.test(text)) {
        setRouteDismissed(false);
      }
    };
    document.addEventListener("submit", resetForNewTask, true);
    window.addEventListener("asympta:user-task-process", resetForNewTask as EventListener);
    return () => {
      document.removeEventListener("submit", resetForNewTask, true);
      window.removeEventListener("asympta:user-task-process", resetForNewTask as EventListener);
    };
  }, []);

  const closePlaces = useCallback(() => {
    const control = document.querySelector<HTMLButtonElement>(
      '.places-directory-button[aria-expanded="true"]',
    );
    control?.click();
  }, []);

  const closeRoute = useCallback(() => {
    setRouteDismissed(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const candidates = Array.from(
        document.querySelectorAll<HTMLButtonElement>(CLOSE_SELECTOR),
      ).filter((button) => isVisible(button));
      if (!candidates.length) return;
      candidates.sort((left, right) => ancestorZIndex(right) - ancestorZIndex(left));
      event.preventDefault();
      event.stopPropagation();
      candidates[0]?.click();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <>
      <style>{`
        .places-directory-panel { position: relative !important; }
        html[data-route-comparison-dismissed="true"] .route-visit-card {
          display: none !important;
        }
        .asympta-runtime-popup-close {
          position: absolute;
          z-index: 12;
          top: 8px;
          right: 8px;
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          padding: 0;
          border: 1px solid rgba(112, 122, 114, .12);
          border-radius: 50%;
          background: rgba(248, 247, 241, .9);
          color: #707a73;
          box-shadow: 0 4px 14px rgba(54, 63, 58, .05);
          cursor: pointer;
          backdrop-filter: blur(10px);
        }
        .asympta-runtime-popup-close:hover,
        .asympta-runtime-popup-close:focus-visible {
          color: #4f5d55;
          background: rgba(255, 255, 255, .96);
          outline: 2px solid rgba(118, 139, 181, .18);
          outline-offset: 1px;
        }
        .asympta-runtime-popup-close svg { width: 12px; height: 12px; }
        .places-directory-panel .places-directory-tools,
        .route-visit-card header { padding-right: 31px; }
        @media (max-width: 620px) {
          .asympta-runtime-popup-close { top: 7px; right: 7px; width: 27px; height: 27px; }
        }
      `}</style>

      {targets.places
        ? createPortal(
            <DismissButton label="Close places directory" onDismiss={closePlaces} />,
            targets.places,
            "places-directory-runtime-close",
          )
        : null}

      {targets.route && !routeDismissed
        ? createPortal(
            <DismissButton label="Close comparison card" onDismiss={closeRoute} />,
            targets.route,
            "route-comparison-runtime-close",
          )
        : null}
    </>
  );
}

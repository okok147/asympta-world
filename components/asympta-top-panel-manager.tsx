"use client";

import { useEffect } from "react";

import styles from "./asympta-top-panel-manager.module.css";

import {
  calculateAsymptaTopPanelLayout,
  type AsymptaTopPanelName,
} from "@/lib/asympta-top-panel-layout";

const ACCESS_SELECTOR = ".asympta-access-card";
const REQUEST_SELECTOR = ".asympta-request-card";
const PANEL_GAP_PX = 10;

function visibleRect(node: Element | null) {
  if (!(node instanceof HTMLElement)) return null;
  const style = getComputedStyle(node);
  if (node.hidden || style.display === "none" || style.visibility === "hidden") return null;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function accessOccupiedHeight(access: HTMLElement, accessRect: DOMRect) {
  let bottom = accessRect.bottom;
  const floatingChildren = access.querySelectorAll<HTMLElement>(
    ".atlas-language-menu.is-open, [data-asympta-camera-follow-control='true']",
  );
  for (const child of floatingChildren) {
    const rect = visibleRect(child);
    if (rect) bottom = Math.max(bottom, rect.bottom);
  }
  return Math.max(accessRect.height, bottom - accessRect.top);
}

function setProperty(node: HTMLElement, name: string, value: string) {
  if (node.style.getPropertyValue(name) === value) return;
  node.style.setProperty(name, value);
}

function clearProperty(node: HTMLElement | null, name: string) {
  node?.style.removeProperty(name);
}

export function AsymptaTopPanelManager() {
  useEffect(() => {
    const root = document.documentElement;
    let access: HTMLElement | null = null;
    let request: HTMLElement | null = null;
    let frame = 0;
    let front: AsymptaTopPanelName = "access";
    let previousRequest: HTMLElement | null = null;
    const observed = new Set<HTMLElement>();

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => scheduleLayout())
      : null;

    const bringToFront = (next: AsymptaTopPanelName) => {
      front = next;
      root.dataset.asymptaTopPanelFront = next;
      access?.classList.toggle("is-asympta-front", next === "access");
      request?.classList.toggle("is-asympta-front", next === "request");
      access?.setAttribute("data-asympta-panel-layer", next === "access" ? "front" : "back");
      request?.setAttribute("data-asympta-panel-layer", next === "request" ? "front" : "back");
    };

    const clearLayout = () => {
      root.dataset.asymptaTopPanels = access || request ? "single" : "none";
      clearProperty(access, "--asympta-top-panel-access-panel-max-height");
      clearProperty(request, "--asympta-top-panel-request-top");
      clearProperty(request, "--asympta-top-panel-request-max-height");
      clearProperty(request, "--asympta-top-panel-request-details-max-height");
    };

    const layout = () => {
      frame = 0;
      const accessRect = visibleRect(access);
      const requestRect = visibleRect(request);
      if (!accessRect || !requestRect || !access || !request) {
        clearLayout();
        bringToFront(front);
        return;
      }

      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const model = calculateAsymptaTopPanelLayout({
        viewportWidth,
        viewportHeight,
        accessTop: accessRect.top,
        accessWidth: accessRect.width,
        accessHeight: accessOccupiedHeight(access, accessRect),
        requestWidth: requestRect.width,
      });

      root.dataset.asymptaTopPanels = model.mode;
      if (model.mode === "stacked") {
        setProperty(
          access,
          "--asympta-top-panel-access-panel-max-height",
          `${model.accessPanelMaxHeight ?? 120}px`,
        );
        setProperty(request, "--asympta-top-panel-request-top", `${model.requestTop ?? 64}px`);
        setProperty(
          request,
          "--asympta-top-panel-request-max-height",
          `${model.requestMaxHeight ?? 220}px`,
        );
        setProperty(
          request,
          "--asympta-top-panel-request-details-max-height",
          `${model.requestDetailsMaxHeight ?? 140}px`,
        );

        // Absolute language and portal controls are measured above. This final guard
        // keeps the request below the actual occupied access-card edge on the same frame.
        const occupiedBottom = accessRect.top + Math.min(
          accessOccupiedHeight(access, accessRect),
          (model.accessPanelMaxHeight ?? accessRect.height) + 50,
        );
        const requestedTop = Number.parseFloat(
          request.style.getPropertyValue("--asympta-top-panel-request-top"),
        );
        const safeTop = Math.ceil(occupiedBottom + PANEL_GAP_PX);
        if (Number.isFinite(requestedTop) && requestedTop < safeTop) {
          setProperty(request, "--asympta-top-panel-request-top", `${safeTop}px`);
          const safeHeight = Math.max(74, Math.floor(viewportHeight - safeTop - 92));
          setProperty(request, "--asympta-top-panel-request-max-height", `${safeHeight}px`);
          setProperty(
            request,
            "--asympta-top-panel-request-details-max-height",
            `${Math.max(44, safeHeight - 76)}px`,
          );
        }
      } else {
        clearProperty(access, "--asympta-top-panel-access-panel-max-height");
        clearProperty(request, "--asympta-top-panel-request-top");
        clearProperty(request, "--asympta-top-panel-request-max-height");
        clearProperty(request, "--asympta-top-panel-request-details-max-height");
      }
      bringToFront(front);
    };

    function scheduleLayout() {
      if (frame) return;
      frame = window.requestAnimationFrame(layout);
    }

    const syncNodes = () => {
      const nextAccess = document.querySelector<HTMLElement>(ACCESS_SELECTOR);
      const nextRequest = document.querySelector<HTMLElement>(REQUEST_SELECTOR);

      for (const node of [...observed]) {
        if (node === nextAccess || node === nextRequest) continue;
        resizeObserver?.unobserve(node);
        observed.delete(node);
        node.classList.remove("is-asympta-front");
        node.removeAttribute("data-asympta-top-panel");
        node.removeAttribute("data-asympta-panel-layer");
      }

      access = nextAccess;
      request = nextRequest;
      if (access && !observed.has(access)) {
        observed.add(access);
        resizeObserver?.observe(access);
        access.dataset.asymptaTopPanel = "access";
      }
      if (request && !observed.has(request)) {
        observed.add(request);
        resizeObserver?.observe(request);
        request.dataset.asymptaTopPanel = "request";
      }

      if (request && request !== previousRequest) {
        previousRequest = request;
        bringToFront("request");
      } else if (!request) {
        previousRequest = null;
      }
      scheduleLayout();
    };

    const panelFromTarget = (target: EventTarget | null): AsymptaTopPanelName | null => {
      const element = target instanceof Element ? target : null;
      const panel = element?.closest<HTMLElement>("[data-asympta-top-panel]");
      const name = panel?.dataset.asymptaTopPanel;
      return name === "access" || name === "request" ? name : null;
    };

    const onPointerDown = (event: PointerEvent) => {
      const panel = panelFromTarget(event.target);
      if (panel) bringToFront(panel);
    };

    const onFocusIn = (event: FocusEvent) => {
      const panel = panelFromTarget(event.target);
      if (panel) bringToFront(panel);
    };

    const onViewportChange = () => scheduleLayout();
    const mutationObserver = new MutationObserver(() => syncNodes());
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-expanded"],
    });

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("orientationchange", onViewportChange, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewportChange, { passive: true });
    window.visualViewport?.addEventListener("scroll", onViewportChange, { passive: true });

    syncNodes();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      clearLayout();
      for (const node of observed) {
        node.classList.remove("is-asympta-front");
        node.removeAttribute("data-asympta-top-panel");
        node.removeAttribute("data-asympta-panel-layer");
      }
      delete root.dataset.asymptaTopPanels;
      delete root.dataset.asymptaTopPanelFront;
    };
  }, []);

  return <span className={styles.manager} data-asympta-top-panel-manager="true" aria-hidden="true" />;
}

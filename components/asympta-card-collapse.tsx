"use client";

import { useEffect } from "react";

type TaskSnapshot = { id: string; agentId: string; status: string };
type DemoSnapshot = { foreground?: { tasks?: TaskSnapshot[] } };

const COLLAPSE_SYNC_MS = 320;
const AGENT_AUTO_COLLAPSE_MS = 5_500;
const MOBILE_MAX_WIDTH = 700;
const PANEL_GAP_PX = 10;
const BOTTOM_UI_RESERVE_PX = 92;

function setExpanded(node: HTMLElement, expanded: boolean) {
  node.classList.toggle("is-collapsed", !expanded);
  node.dataset.asymptaExpanded = expanded ? "true" : "false";
  node.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function isMobile() {
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

function selectedAgentId() {
  return document.querySelector<HTMLElement>(".animal-map-marker--foreground.is-selected")?.dataset.agentId ?? null;
}

function activeTaskKey(agentId: string | null) {
  if (!agentId) return "none";
  let snapshot: DemoSnapshot | undefined;
  try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as DemoSnapshot | undefined; } catch { return `${agentId}:unknown`; }
  const task = snapshot?.foreground?.tasks?.find((item) => item.agentId === agentId && ["moving", "working", "waiting_approval", "blocked"].includes(item.status));
  return task ? `${agentId}:${task.id}:${task.status}` : `${agentId}:idle`;
}

function menuIsOpen() {
  return document.querySelector<HTMLElement>(".atlas-console")?.classList.contains("is-open") ?? false;
}

function setMenuOpen(open: boolean) {
  const menu = document.querySelector<HTMLElement>(".atlas-console");
  if (!menu || menu.classList.contains("is-open") === open) return;
  menu.querySelector<HTMLButtonElement>(".atlas-menu-identity")?.click();
}

export function AsymptaCardCollapse() {
  useEffect(() => {
    let scheduleInitialized = false;
    let scheduleExpanded = false;
    let lastAgentId: string | null = null;
    let lastTaskKey = "";
    let lastAgentInteractionAt = performance.now();

    const positionMobileSchedule = () => {
      const schedule = document.querySelector<HTMLElement>(".atlas-safe-schedule");
      const menu = document.querySelector<HTMLElement>(".atlas-console");
      if (!schedule) return;

      if (!isMobile()) {
        schedule.removeAttribute("data-asympta-mobile-dock");
        schedule.style.removeProperty("--asympta-mobile-schedule-top");
        delete document.documentElement.dataset.asymptaMobilePanels;
        return;
      }

      if (!menu || !menu.classList.contains("is-open")) {
        schedule.dataset.asymptaMobileDock = "top";
        schedule.style.removeProperty("--asympta-mobile-schedule-top");
        document.documentElement.dataset.asymptaMobilePanels = "schedule-top";
        return;
      }

      const menuRect = menu.getBoundingClientRect();
      const scheduleHeight = Math.max(72, schedule.getBoundingClientRect().height);
      const desiredTop = Math.ceil(menuRect.bottom + PANEL_GAP_PX);
      const availableBottom = window.innerHeight - BOTTOM_UI_RESERVE_PX;

      if (desiredTop + scheduleHeight <= availableBottom) {
        schedule.dataset.asymptaMobileDock = "below-menu";
        schedule.style.setProperty("--asympta-mobile-schedule-top", `${desiredTop}px`);
        document.documentElement.dataset.asymptaMobilePanels = "schedule-below-menu";
      } else {
        schedule.dataset.asymptaMobileDock = "bottom";
        schedule.style.removeProperty("--asympta-mobile-schedule-top");
        document.documentElement.dataset.asymptaMobilePanels = "schedule-bottom";
      }
    };

    const applySchedule = (expanded: boolean) => {
      const card = document.querySelector<HTMLElement>(".atlas-safe-schedule");
      if (!card) return;
      scheduleExpanded = expanded;
      setExpanded(card, expanded);
      const header = card.querySelector<HTMLElement>(".atlas-safe-schedule__header");
      if (header) {
        header.dataset.asymptaCollapseToggle = "schedule";
        header.setAttribute("role", "button");
        header.tabIndex = 0;
        header.setAttribute("aria-expanded", expanded ? "true" : "false");
      }

      // Schedule is user controlled. It never collapses merely because time passed.
      // Explicitly opening it may still close the mutually exclusive coordination menu.
      if (expanded && menuIsOpen()) {
        window.setTimeout(() => {
          setMenuOpen(false);
          window.setTimeout(positionMobileSchedule, 0);
        }, 0);
      } else {
        window.setTimeout(positionMobileSchedule, 0);
      }
    };

    const expandAgentCard = () => {
      const card = document.querySelector<HTMLElement>(".atlas-agent-card");
      if (!card) return;
      setExpanded(card, true);
      const top = card.querySelector<HTMLElement>(".atlas-agent-card__top");
      if (top) {
        top.dataset.asymptaCollapseToggle = "agent";
        top.setAttribute("role", "button");
        top.tabIndex = 0;
        top.setAttribute("aria-expanded", "true");
      }
      lastAgentInteractionAt = performance.now();
    };

    const collapseAgentCard = () => {
      const card = document.querySelector<HTMLElement>(".atlas-agent-card");
      if (!card) return;
      setExpanded(card, false);
      const top = card.querySelector<HTMLElement>(".atlas-agent-card__top");
      if (top) top.setAttribute("aria-expanded", "false");
    };

    const sync = () => {
      if (document.hidden) return;

      const schedule = document.querySelector<HTMLElement>(".atlas-safe-schedule");
      if (schedule && !scheduleInitialized) {
        scheduleInitialized = true;
        applySchedule(false);
      }

      // Coordination menu owns the detailed-information slot while it is explicitly open.
      if (menuIsOpen() && scheduleExpanded) applySchedule(false);
      positionMobileSchedule();

      const card = document.querySelector<HTMLElement>(".atlas-agent-card");
      if (!card) {
        lastAgentId = null;
        lastTaskKey = "";
        return;
      }

      const agentId = selectedAgentId();
      const taskKey = activeTaskKey(agentId);
      const cardFresh = card.dataset.asymptaCollapseReady !== "true";
      if (cardFresh) {
        card.dataset.asymptaCollapseReady = "true";
        expandAgentCard();
      }

      if (agentId !== lastAgentId || taskKey !== lastTaskKey) {
        lastAgentId = agentId;
        lastTaskKey = taskKey;
        expandAgentCard();
      }

      const expanded = card.dataset.asymptaExpanded !== "false";
      if (expanded && performance.now() - lastAgentInteractionAt >= AGENT_AUTO_COLLAPSE_MS) collapseAgentCard();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest(".atlas-safe-schedule__header")) {
        applySchedule(!scheduleExpanded);
        return;
      }

      const menuToggle = target.closest(".atlas-menu-identity, .atlas-menu-bar > .atlas-quick-icon:last-child");
      if (menuToggle) {
        window.setTimeout(() => {
          if (menuIsOpen()) applySchedule(false);
          positionMobileSchedule();
        }, 0);
      }

      const marker = target.closest(".animal-map-marker--foreground");
      if (marker) {
        lastAgentInteractionAt = performance.now();
        window.setTimeout(expandAgentCard, 0);
        return;
      }

      const card = target.closest<HTMLElement>(".atlas-agent-card");
      if (!card) return;
      if (target.closest(".atlas-card-close")) return;
      lastAgentInteractionAt = performance.now();
      if (card.classList.contains("is-collapsed") || target.closest(".atlas-agent-card__top")) expandAgentCard();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(".atlas-agent-card") || target.closest(".animal-map-marker--foreground")) {
        lastAgentInteractionAt = performance.now();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (target.closest(".atlas-safe-schedule__header")) {
        event.preventDefault();
        applySchedule(!scheduleExpanded);
        return;
      }
      if (target.closest(".atlas-agent-card__top")) {
        event.preventDefault();
        expandAgentCard();
      }
    };

    const onViewportChange = () => window.setTimeout(positionMobileSchedule, 0);

    sync();
    const timer = window.setInterval(sync, COLLAPSE_SYNC_MS);
    document.addEventListener("click", onClick);
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("orientationchange", onViewportChange, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewportChange, { passive: true });

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      delete document.documentElement.dataset.asymptaMobilePanels;
    };
  }, []);

  return null;
}

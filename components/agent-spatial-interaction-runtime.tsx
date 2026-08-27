"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Registry = {
  invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
};

type CitySnapshot = {
  businesses?: Array<{ id: string; name: string; x: number; y: number }>;
};

type CommunitySnapshot = {
  places?: Array<{ id: string; name: string; x: number; y: number }>;
};

type Destination = {
  kind: "city" | "community" | "route";
  id: string;
  name: string;
  x: number;
  y: number;
};

type SpatialRouter = {
  visitDestination: (destination: Destination) => Promise<boolean>;
  userPosition: () => { x: number; y: number } | null;
};

type WrappedRegistry = Registry & { __spatialWrapped?: boolean; __rawInvoke?: Registry["invoke"] };

type SpatialWindow = Window & {
  __ASYMPTA_CITY_WEBMCP__?: WrappedRegistry;
  __ASYMPTA_COMMUNITY_WEBMCP__?: WrappedRegistry;
  __ASYMPTA_SPATIAL_ROUTER__?: SpatialRouter;
};

const CITY_KEY = "asympta-latent-city-v1";
const COMMUNITY_KEY = "asympta-community-v2";
const ARRIVAL_RADIUS = 36;
const ARRIVAL_TIMEOUT_MS = 52000;
const RETARGET_INTERVAL_MS = 4800;

const CITY_ACTION_BY_LABEL: Record<string, string> = {
  "瀏覽商品": "browse_products",
  "查看庫存": "check_stock",
  "購買商品": "buy_product",
  "預約服務": "book_service",
  "取得報價": "request_quote",
  "出售資源": "sell_resource",
  "配送": "deliver",
  "詢問": "inquire",
};

const COMMUNITY_ACTION_BY_LABEL: Record<string, string> = {
  "查看活動": "inspect_programs",
  "預留資源": "reserve_item",
  "借用物品": "borrow_item",
  "歸還物品": "return_item",
  "參加活動": "attend_event",
  "參與義工": "volunteer",
  "捐出資源": "donate_resource",
  "尋求協助": "request_help",
  "張貼公告": "post_notice",
  "預約服務": "book_service",
  "購買物品": "purchase_item",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function emitProcess(label: string, detail: string, progress: number, tone: string) {
  window.dispatchEvent(
    new CustomEvent("asympta:user-task-process", {
      detail: { label, detail, progress, tone },
    }),
  );
}

function userPosition() {
  const node = document.querySelector<HTMLElement>(".mission-user-agent");
  if (!node) return null;
  return {
    x: Number.parseFloat(node.style.left) || node.offsetLeft || 600,
    y: Number.parseFloat(node.style.top) || node.offsetTop || 380,
  };
}

function cityDestination(id: string): Destination | null {
  const state = readJson<CitySnapshot>(CITY_KEY, {});
  const item = state.businesses?.find((candidate) => candidate.id === id);
  return item ? { kind: "city", id: item.id, name: item.name, x: item.x, y: item.y } : null;
}

function communityDestination(id: string): Destination | null {
  const state = readJson<CommunitySnapshot>(COMMUNITY_KEY, {});
  const item = state.places?.find((candidate) => candidate.id === id);
  return item ? { kind: "community", id: item.id, name: item.name, x: item.x, y: item.y } : null;
}

function findDestinationNode(destination: Destination) {
  const selector =
    destination.kind === "city"
      ? ".latent-business"
      : destination.kind === "community"
        ? ".community-place"
        : ".route-market-store";
  return [...document.querySelectorAll<HTMLElement>(selector)].find((node) =>
    (node.getAttribute("aria-label") ?? node.textContent ?? "").includes(destination.name),
  ) ?? null;
}

function markDestination(destination: Destination, active: boolean) {
  const node = findDestinationNode(destination);
  node?.classList.toggle("is-user-destination", active);
  if (active) node?.setAttribute("data-user-destination", "true");
  else node?.removeAttribute("data-user-destination");
}

function dispatchTarget(destination: Destination) {
  window.dispatchEvent(
    new CustomEvent("asympta:agent-motion-target", {
      detail: {
        agentName: "Your Agent",
        x: destination.x,
        y: destination.y,
        durationMs: 12000,
      },
    }),
  );
}

async function visitDestination(destination: Destination) {
  markDestination(destination, true);
  emitProcess("前往地點", "Your Agent 正在前往 " + destination.name, 40, "moving");
  let lastTargetAt = 0;
  const startedAt = Date.now();

  try {
    while (Date.now() - startedAt < ARRIVAL_TIMEOUT_MS) {
      const now = Date.now();
      if (now - lastTargetAt >= RETARGET_INTERVAL_MS) {
        dispatchTarget(destination);
        lastTargetAt = now;
      }
      const position = userPosition();
      if (position) {
        const distance = Math.hypot(position.x - destination.x, position.y - destination.y);
        if (distance <= ARRIVAL_RADIUS) {
          emitProcess("已到達", destination.name + " · 現在才開始互動", 55, "talking");
          return true;
        }
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
    }
    emitProcess("路程未完成", destination.name + " · 暫停行動，避免遠距離直接執行", 45, "blocked");
    return false;
  } finally {
    window.setTimeout(() => markDestination(destination, false), 2600);
  }
}

function businessIdFromInspector() {
  const name = document.querySelector<HTMLElement>(".city-business-inspector header strong")?.textContent?.trim();
  if (!name) return null;
  const state = readJson<CitySnapshot>(CITY_KEY, {});
  return state.businesses?.find((item) => item.name === name)?.id ?? null;
}

function placeIdFromInspector() {
  const name = document.querySelector<HTMLElement>(".community-inspector header strong")?.textContent?.trim();
  if (!name) return null;
  const state = readJson<CommunitySnapshot>(COMMUNITY_KEY, {});
  return state.places?.find((item) => item.name === name)?.id ?? null;
}

export function AgentSpatialInteractionRuntime() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);

  const visit = useCallback(async (target: Destination) => {
    setDestination(target);
    const arrived = await visitDestination(target);
    window.setTimeout(() => setDestination((current) => current?.id === target.id ? null : current), 2200);
    return arrived;
  }, []);

  useEffect(() => {
    const spatialWindow = window as SpatialWindow;
    spatialWindow.__ASYMPTA_SPATIAL_ROUTER__ = {
      visitDestination: visit,
      userPosition,
    };
    const initial = window.setTimeout(() => setViewport(document.querySelector<HTMLElement>(".world-viewport")), 0);
    return () => {
      window.clearTimeout(initial);
      delete spatialWindow.__ASYMPTA_SPATIAL_ROUTER__;
    };
  }, [visit]);

  useEffect(() => {
    const spatialWindow = window as SpatialWindow;

    const wrapRegistry = (kind: "city" | "community", registry: WrappedRegistry | undefined) => {
      if (!registry || registry.__spatialWrapped) return;
      const rawInvoke = registry.invoke.bind(registry);
      registry.__rawInvoke = rawInvoke;
      registry.__spatialWrapped = true;
      registry.invoke = async (name, input = {}) => {
        const isExecution =
          (kind === "city" && name === "city_execute_action") ||
          (kind === "community" && name === "community_execute_action");
        const isUser = !input.agentId || input.agentId === "your-agent";
        if (isExecution && isUser) {
          const id = String(kind === "city" ? input.businessId ?? "" : input.placeId ?? "");
          const target = kind === "city" ? cityDestination(id) : communityDestination(id);
          if (target) {
            const arrived = await visit(target);
            if (!arrived) {
              return { ok: false, error: "Your Agent did not reach " + target.name + ". Action was not executed." };
            }
          }
        }
        return rawInvoke(name, input);
      };
    };

    const timer = window.setInterval(() => {
      wrapRegistry("city", spatialWindow.__ASYMPTA_CITY_WEBMCP__);
      wrapRegistry("community", spatialWindow.__ASYMPTA_COMMUNITY_WEBMCP__);
    }, 500);
    return () => window.clearInterval(timer);
  }, [visit]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const cityButton = target?.closest<HTMLButtonElement>(".city-inspector-action");
      const communityButton = target?.closest<HTMLButtonElement>(".community-action");
      if (!cityButton && !communityButton) return;

      if (cityButton) {
        const businessId = businessIdFromInspector();
        const action = CITY_ACTION_BY_LABEL[cityButton.textContent?.trim() ?? ""];
        const registry = (window as SpatialWindow).__ASYMPTA_CITY_WEBMCP__;
        if (!businessId || !action || !registry) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void registry.invoke("city_execute_action", { businessId, action, agentId: "your-agent" });
        return;
      }

      if (communityButton) {
        const placeId = placeIdFromInspector();
        const action = COMMUNITY_ACTION_BY_LABEL[communityButton.textContent?.trim() ?? ""];
        const registry = (window as SpatialWindow).__ASYMPTA_COMMUNITY_WEBMCP__;
        if (!placeId || !action || !registry) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void registry.invoke("community_execute_action", { placeId, action, agentId: "your-agent" });
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <>
      <style>{`
        /* Spatial information hierarchy: thoughts above, task/status below. */
        .business-thought,
        .city-agent-thought,
        .community-agent-thought {
          top: auto !important;
          bottom: calc(100% + 8px) !important;
          z-index: 86 !important;
        }
        .city-agent-thought,
        .community-agent-thought {
          left: 50% !important;
          transform: translateX(-28%) !important;
        }
        .task-process-bubble {
          top: calc(100% + 9px) !important;
          bottom: auto !important;
          z-index: 81 !important;
        }
        .task-process-bubble::after {
          top: -5px !important;
          bottom: auto !important;
          border: 0 !important;
          border-top: 1px solid rgba(118,128,120,.18) !important;
          border-left: 1px solid rgba(118,128,120,.18) !important;
        }
        .city-user-delta,
        .community-user-delta {
          top: calc(100% + 58px) !important;
          bottom: auto !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 79 !important;
        }
        .latent-business.is-user-destination,
        .community-place.is-user-destination,
        .route-market-store.is-user-destination {
          opacity: 1 !important;
          visibility: visible !important;
          z-index: 34 !important;
          filter: drop-shadow(0 0 8px rgba(111,139,181,.28));
        }
        .latent-business.is-user-destination svg path,
        .community-place.is-user-destination svg path,
        .route-market-store.is-user-destination svg path {
          stroke-width: 1.3 !important;
          opacity: 1 !important;
        }
        .latent-business.is-user-destination .latent-business-name,
        .community-place.is-user-destination .community-place-name,
        .route-market-store.is-user-destination .route-market-name {
          opacity: 1 !important;
          font-weight: 700;
        }
        .spatial-destination-status {
          position: absolute;
          left: 50%;
          bottom: max(70px, calc(env(safe-area-inset-bottom) + 62px));
          z-index: 110;
          max-width: min(320px, calc(100vw - 30px));
          padding: 6px 9px;
          transform: translateX(-50%);
          border: 1px solid rgba(118,139,181,.16);
          border-radius: 11px;
          background: rgba(248,247,241,.9);
          color: #66716a;
          font-family: var(--pixel-font);
          font-size: .34rem;
          letter-spacing: .03em;
          pointer-events: none;
          backdrop-filter: blur(10px);
        }
        @media(max-width:620px) {
          .task-process-bubble { top: calc(100% + 7px) !important; }
          .city-user-delta,.community-user-delta { top: calc(100% + 54px) !important; }
        }
      `}</style>
      {viewport && destination
        ? createPortal(
            <div className="spatial-destination-status" role="status">
              前往 · {destination.name} · 到達後才執行
            </div>,
            viewport,
            "spatial-destination-status",
          )
        : null}
    </>
  );
}

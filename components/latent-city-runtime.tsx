"use client";

import {
  Bot,
  Box,
  Clock3,
  Coins,
  PackageSearch,
  ShoppingBag,
  Store,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  advanceMissionNeed,
  chooseBusinessForAgent,
  deriveAgentNeed,
  executeCityAction,
  listBusinessActions,
  needDialogue,
  restoreCitySupply,
  searchCityBusinesses,
  seedLatentCity,
  type CityActionId,
  type CityAgent,
  type CityBusiness,
  type CityBusinessKind,
  type CityNeed,
  type LatentCityState,
} from "@/lib/latent-city";

type CityTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

type InspectorState = {
  businessId: string;
  x: number;
  y: number;
};

const CITY_KEY = "asympta-latent-city-v1";
const CITY_AGENT_COUNT = 100;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 760;
const BEHAVIOR_BATCH = 10;

const ACTIONS: CityActionId[] = [
  "browse_products",
  "check_stock",
  "buy_product",
  "book_service",
  "request_quote",
  "sell_resource",
  "deliver",
  "inquire",
];

const KINDS: CityBusinessKind[] = [
  "cafe",
  "grocery",
  "bakery",
  "repair",
  "design",
  "print",
  "courier",
  "learning",
  "coworking",
  "automation",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function loadCity() {
  try {
    const raw = localStorage.getItem(CITY_KEY);
    if (!raw) return seedLatentCity(Date.now(), CITY_AGENT_COUNT);
    const parsed = JSON.parse(raw) as LatentCityState;
    if (
      parsed.version !== 1 ||
      parsed.businesses?.length !== 10 ||
      parsed.agents?.length !== CITY_AGENT_COUNT
    ) {
      return seedLatentCity(Date.now(), CITY_AGENT_COUNT);
    }
    return parsed;
  } catch {
    return seedLatentCity(Date.now(), CITY_AGENT_COUNT);
  }
}

function saveCity(city: LatentCityState) {
  try {
    localStorage.setItem(CITY_KEY, JSON.stringify(city));
  } catch {
    // The city can remain memory-only if local persistence is unavailable.
  }
}

function renderSnapshot(city: LatentCityState): LatentCityState {
  return {
    ...city,
    businesses: city.businesses.map((business) => ({
      ...business,
      products: business.products.map((item) => ({ ...item })),
      services: business.services.map((item) => ({ ...item })),
    })),
    agents: city.agents.map((agent) => ({
      ...agent,
      inventory: { ...agent.inventory },
      traits: { ...agent.traits },
      preferredKinds: [...agent.preferredKinds],
      memory: agent.memory.map((entry) => ({ ...entry })),
      thought: agent.thought ? { ...agent.thought } : undefined,
    })),
    transactions: [...city.transactions],
  };
}

function lineValue(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function linePaths(seed: number) {
  const roof = 10 + lineValue(seed, 1) * 9;
  const left = 7 + lineValue(seed, 2) * 6;
  const right = 43 - lineValue(seed, 3) * 6;
  const mid = 22 + lineValue(seed, 4) * 8;
  const door = 16 + lineValue(seed, 5) * 12;
  return [
    `M ${left} 34 L ${left + 2} ${roof + 6} L ${mid} ${roof} L ${right} ${roof + 7} L ${right} 34`,
    `M ${left + 5} 25 L ${right - 5} 25`,
    `M ${door} 34 L ${door} 25 L ${door + 7} 25 L ${door + 7} 34`,
    `M ${left + 8} 19 L ${left + 13} 15 L ${left + 18} 19`,
  ];
}

function agentActionForNeed(agent: CityAgent, business: CityBusiness, need: CityNeed) {
  if (agent.wallet < 42 && business.actions.includes("deliver") && agent.traits.curiosity > 0.45) {
    return "deliver" as const;
  }
  if (agent.resources >= 2 && business.actions.includes("sell_resource") && agent.traits.thrift > 0.62) {
    return "sell_resource" as const;
  }
  if (need === "meal" || need === "groceries" || need === "rest") {
    if (business.actions.includes("buy_product")) return "buy_product" as const;
  }
  if (business.actions.includes("book_service")) return "book_service" as const;
  if (business.actions.includes("buy_product")) return "buy_product" as const;
  return "inquire" as const;
}

function productForNeed(business: CityBusiness, agent: CityAgent, need: CityNeed) {
  const tagged = business.products.filter((item) =>
    need === "meal" || need === "rest"
      ? item.tags.includes("food")
      : need === "groceries"
        ? item.tags.includes("grocery") || item.tags.includes("resource")
        : true,
  );
  const pool = tagged.length > 0 ? tagged : business.products;
  return [...pool].sort((a, b) =>
    agent.traits.thrift >= 0.5 ? a.price - b.price : b.price - a.price,
  )[0];
}

function serviceForNeed(business: CityBusiness, agent: CityAgent) {
  return [...business.services].sort((a, b) =>
    agent.traits.thrift >= 0.5 ? a.price - b.price : b.price - a.price,
  )[0];
}

function actionLabel(action: CityActionId) {
  if (action === "buy_product") return "接受交易";
  if (action === "book_service") return "預約服務";
  if (action === "deliver") return "完成配送";
  if (action === "sell_resource") return "出售資源";
  if (action === "request_quote") return "取得報價";
  if (action === "check_stock") return "查看庫存";
  if (action === "browse_products") return "瀏覽商品";
  return "詢問商店";
}

function thoughtKind(action: CityActionId) {
  if (action === "buy_product" || action === "book_service") return "deal" as const;
  if (action === "sell_resource") return "resource" as const;
  if (action === "deliver") return "work" as const;
  return "status" as const;
}

function nextInteractionDuration(agent: CityAgent) {
  return 2600 + agent.traits.patience * 3100 + agent.traits.sociability * 1500;
}

function nextNeedLabel(agent: CityAgent) {
  return needDialogue(deriveAgentNeed(agent));
}

function businessKindLabel(kind: CityBusinessKind) {
  if (kind === "cafe") return "Cafe";
  if (kind === "grocery") return "Grocery";
  if (kind === "bakery") return "Bakery";
  if (kind === "repair") return "Repair";
  if (kind === "design") return "Design";
  if (kind === "print") return "Print";
  if (kind === "courier") return "Courier";
  if (kind === "learning") return "Learning";
  if (kind === "coworking") return "Coworking";
  return "Automation";
}

function exposeYourAgentMotion(business: CityBusiness, action: CityActionId) {
  window.dispatchEvent(
    new CustomEvent("asympta:agent-motion-target", {
      detail: {
        agentName: "Your Agent",
        x: business.x,
        y: business.y,
        durationMs: 6200,
      },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("asympta:agent-behavior", {
      detail: {
        actorName: "Your Agent",
        kind: action === "buy_product" || action === "book_service" ? "deal" : "workflow",
        message: actionLabel(action),
        symbols:
          action === "buy_product"
            ? ["deal", "payment"]
            : action === "book_service"
              ? ["target", "deal"]
              : ["target", "work"],
        durationMs: 6200,
      },
    }),
  );
}

export function LatentCityRuntime() {
  const cityRef = useRef<LatentCityState>(seedLatentCity(0, CITY_AGENT_COUNT));
  const agentNodesRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const decisionCursorRef = useRef(0);
  const [city, setCity] = useState<LatentCityState | null>(null);
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [inspector, setInspector] = useState<InspectorState | null>(null);

  const commitCity = useCallback((next: LatentCityState) => {
    cityRef.current = next;
    setCity(renderSnapshot(next));
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const loaded = loadCity();
      cityRef.current = loaded;
      setCity(renderSnapshot(loaded));
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane"));
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
    }, 0);
    return () => window.clearTimeout(initialize);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const animate = (time: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
      last = time;
      for (const agent of cityRef.current.agents) {
        const node = agentNodesRef.current.get(agent.id);
        if (!node) continue;
        if (agent.status === "walking") {
          const dx = agent.targetX - agent.x;
          const dy = agent.targetY - agent.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 1.5) {
            const step = Math.min(distance, agent.speed * dt);
            agent.x = clamp(agent.x + (dx / distance) * step, 48, WORLD_WIDTH - 48);
            agent.y = clamp(agent.y + (dy / distance) * step, 48, WORLD_HEIGHT - 48);
          }
        }
        node.style.transform =
          "translate3d(" + agent.x.toFixed(2) + "px," + agent.y.toFixed(2) + "px,0)";
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const performInteraction = useCallback((agent: CityAgent, now: number) => {
    const current = cityRef.current;
    const business = current.businesses.find((candidate) => candidate.id === agent.targetBusinessId);
    if (!business || !agent.currentNeed) {
      agent.status = "idle";
      agent.targetBusinessId = undefined;
      agent.nextDecisionAt = now + 1600;
      return;
    }
    const action = agent.pendingAction ?? agentActionForNeed(agent, business, agent.currentNeed);
    const product = action === "buy_product" ? productForNeed(business, agent, agent.currentNeed) : undefined;
    const service = action === "book_service" ? serviceForNeed(business, agent) : undefined;
    const result = executeCityAction(
      current,
      {
        businessId: business.id,
        action,
        agentId: agent.id,
        itemId: product?.id ?? service?.id,
        quantity: action === "sell_resource" ? Math.min(2, agent.resources) : 1,
      },
      now,
    );
    cityRef.current = result.state;
    const updated = cityRef.current.agents.find((candidate) => candidate.id === agent.id);
    if (!updated) return;
    updated.status = "idle";
    updated.targetBusinessId = undefined;
    updated.currentNeed = undefined;
    updated.pendingAction = undefined;
    updated.interactionUntil = undefined;
    updated.nextDecisionAt = now + 3000 + updated.traits.curiosity * 6500;
    updated.thought = {
      label: result.ok ? actionLabel(action) : "重新尋找",
      kind: result.ok ? thoughtKind(action) : "search",
      until: now + 3000,
    };
    if (result.ok) {
      updated.missionNeed = advanceMissionNeed(updated, cityRef.current.transactions.length + updated.id.length);
      updated.ownerGoal = needDialogue(updated.missionNeed);
    }
  }, []);

  const planAgent = useCallback((agent: CityAgent, now: number) => {
    agent.hunger = clamp(agent.hunger + 1.1, 0, 100);
    agent.energy = clamp(agent.energy - 0.42, 0, 100);
    if (agent.thought && agent.thought.until < now) agent.thought = undefined;

    if (agent.status === "walking" && agent.targetBusinessId) {
      const business = cityRef.current.businesses.find(
        (candidate) => candidate.id === agent.targetBusinessId,
      );
      if (!business) {
        agent.status = "idle";
        agent.targetBusinessId = undefined;
        return;
      }
      const distance = Math.hypot(agent.x - business.x, agent.y - business.y);
      if (distance <= 24) {
        const duration = nextInteractionDuration(agent);
        agent.status = "interacting";
        agent.interactionUntil = now + duration;
        agent.thought = {
          label: agent.pendingAction === "buy_product" ? "詢問價格" : "詢問服務",
          kind: "status",
          until: now + duration,
        };
      }
      return;
    }

    if (agent.status === "interacting") {
      if ((agent.interactionUntil ?? 0) <= now) performInteraction(agent, now);
      return;
    }

    if (agent.status === "working") {
      if ((agent.interactionUntil ?? 0) <= now) {
        agent.status = "idle";
        agent.interactionUntil = undefined;
        agent.nextDecisionAt = now + 2600;
      }
      return;
    }

    if (now < agent.nextDecisionAt) return;
    const need = deriveAgentNeed(agent);
    const business = chooseBusinessForAgent(cityRef.current.businesses, agent, need);
    if (!business) {
      agent.nextDecisionAt = now + 2200;
      agent.thought = { label: "重新尋找", kind: "search", until: now + 2200 };
      return;
    }
    const action = agentActionForNeed(agent, business, need);
    agent.currentNeed = need;
    agent.pendingAction = action;
    agent.targetBusinessId = business.id;
    agent.targetX = business.x + ((agent.id.length % 3) - 1) * 18;
    agent.targetY = business.y + ((agent.id.charCodeAt(agent.id.length - 1) % 3) - 1) * 15;
    agent.status = "walking";
    agent.thought = {
      label: needDialogue(need),
      kind: need === "meal" || need === "groceries" ? "food" : "search",
      until: now + 4200,
    };
  }, [performInteraction]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const current = cityRef.current;
      const start = decisionCursorRef.current;
      for (let offset = 0; offset < BEHAVIOR_BATCH; offset += 1) {
        const index = (start + offset) % current.agents.length;
        planAgent(current.agents[index], now);
      }
      decisionCursorRef.current = (start + BEHAVIOR_BATCH) % current.agents.length;
      current.worldTime = now;
      setCity(renderSnapshot(current));
    }, 900);
    return () => window.clearInterval(timer);
  }, [planAgent]);

  useEffect(() => {
    const persist = window.setInterval(() => saveCity(cityRef.current), 5200);
    const supply = window.setInterval(() => {
      commitCity(restoreCitySupply(cityRef.current, Date.now()));
    }, 22000);
    return () => {
      window.clearInterval(persist);
      window.clearInterval(supply);
    };
  }, [commitCity]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: CityTool[] = [
      {
        name: "city_search_businesses",
        title: "Search businesses in the latent city",
        description:
          "Search the ten local businesses by name, category, product, service, or need. Returns lightweight map and capability summaries.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", maxLength: 120 },
            kind: { type: "string", enum: KINDS },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) =>
          JSON.stringify({
            ok: true,
            businesses: searchCityBusinesses(
              cityRef.current,
              typeof input.query === "string" ? input.query : "",
              KINDS.includes(input.kind as CityBusinessKind)
                ? (input.kind as CityBusinessKind)
                : undefined,
            ),
          }),
      },
      {
        name: "city_inspect_business",
        title: "Inspect one latent-city business",
        description:
          "Read a business's products, services, prices, stock, service slots, reputation, treasury and supported actions.",
        inputSchema: {
          type: "object",
          properties: { businessId: { type: "string" } },
          required: ["businessId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const business = cityRef.current.businesses.find(
            (candidate) => candidate.id === String(input.businessId),
          );
          return JSON.stringify(
            business
              ? { ok: true, business, actions: listBusinessActions(business) }
              : { ok: false, error: "Business not found." },
          );
        },
      },
      {
        name: "city_list_actions",
        title: "List actions available at a city business",
        description:
          "List the action schema exposed by one local business before deciding what an agent should do there.",
        inputSchema: {
          type: "object",
          properties: { businessId: { type: "string" } },
          required: ["businessId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const business = cityRef.current.businesses.find(
            (candidate) => candidate.id === String(input.businessId),
          );
          return JSON.stringify(
            business
              ? { ok: true, businessId: business.id, actions: listBusinessActions(business) }
              : { ok: false, error: "Business not found." },
          );
        },
      },
      {
        name: "city_execute_action",
        title: "Execute an action at a latent-city business",
        description:
          "Execute one supported business action using the same live inventory, service capacity, treasury and resident-agent state shown in the city. Use agentId='your-agent' to act on behalf of the current user's visible agent.",
        inputSchema: {
          type: "object",
          properties: {
            businessId: { type: "string" },
            action: { type: "string", enum: ACTIONS },
            agentId: { type: "string" },
            itemId: { type: "string" },
            quantity: { type: "number", minimum: 1, maximum: 8 },
            note: { type: "string", maxLength: 180 },
          },
          required: ["businessId", "action"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const business = cityRef.current.businesses.find(
            (candidate) => candidate.id === String(input.businessId),
          );
          const action = ACTIONS.includes(input.action as CityActionId)
            ? (input.action as CityActionId)
            : "inquire";
          if (!business) return JSON.stringify({ ok: false, error: "Business not found." });
          if (String(input.agentId ?? "") === "your-agent") exposeYourAgentMotion(business, action);
          const result = executeCityAction(
            cityRef.current,
            {
              businessId: business.id,
              action,
              agentId:
                typeof input.agentId === "string" && input.agentId !== "your-agent"
                  ? input.agentId
                  : undefined,
              itemId: typeof input.itemId === "string" ? input.itemId : undefined,
              quantity: typeof input.quantity === "number" ? input.quantity : undefined,
              note: typeof input.note === "string" ? input.note : undefined,
            },
            Date.now(),
          );
          commitCity(result.state);
          return JSON.stringify({
            ok: result.ok,
            summary: result.summary,
            credits: result.credits,
            stock: result.stock,
            quote: result.quote,
            externalCredits: result.state.externalCredits,
          });
        },
      },
    ];

    const fallback = window as unknown as {
      __ASYMPTA_CITY_WEBMCP__?: {
        tools: CityTool[];
        invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    fallback.__ASYMPTA_CITY_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown city WebMCP tool: " + name);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };

    const modelContext = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: CityTool,
            options?: { signal?: AbortSignal },
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (modelContext?.registerTool) {
      tools.forEach((tool) => {
        void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(
          () => undefined,
        );
      });
    }
    return () => {
      controller.abort();
      delete fallback.__ASYMPTA_CITY_WEBMCP__;
    };
  }, [commitCity]);

  const selectedBusiness = useMemo(
    () =>
      inspector && city
        ? city.businesses.find((business) => business.id === inspector.businessId)
        : undefined,
    [city, inspector],
  );

  const activeBusinessIds = useMemo(
    () =>
      new Set(
        city?.agents
          .filter((agent) => agent.status === "interacting" && agent.targetBusinessId)
          .map((agent) => agent.targetBusinessId as string) ?? [],
      ),
    [city],
  );

  const visibleThoughtIds = useMemo(
    () =>
      new Set(
        city?.agents
          .filter((agent) => agent.thought && agent.status !== "idle")
          .slice(0, 12)
          .map((agent) => agent.id) ?? [],
      ),
    [city],
  );

  if (!city || !worldPlane || !viewport) return null;

  const openBusiness = (business: CityBusiness, clientX: number, clientY: number) => {
    const rect = viewport.getBoundingClientRect();
    setInspector({
      businessId: business.id,
      x: clamp(clientX - rect.left + 12, 12, Math.max(12, rect.width - 300)),
      y: clamp(clientY - rect.top + 12, 12, Math.max(12, rect.height - 390)),
    });
  };

  return (
    <>
      {createPortal(
        <>
          <style>{`
            .latent-city-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
            .latent-city-streets { position: absolute; inset: 0; width: 1200px; height: 760px; overflow: visible; opacity: .14; pointer-events: none; }
            .latent-city-streets path { fill: none; stroke: #8f9a92; stroke-width: .8; stroke-dasharray: 3 8; }
            .latent-business {
              position: absolute;
              z-index: 7;
              width: 94px;
              height: 62px;
              padding: 0;
              transform: translate(-50%, -50%);
              border: 0;
              background: transparent;
              color: #6d756f;
              cursor: pointer;
              pointer-events: auto;
              opacity: .52;
              transition: opacity 180ms ease, transform 180ms ease;
            }
            .latent-business:hover,
            .latent-business:focus-visible,
            .latent-business.is-active { opacity: .9; transform: translate(-50%, -50%) scale(1.035); outline: none; }
            .latent-business svg { position: absolute; left: 23px; top: 2px; width: 48px; height: 39px; overflow: visible; }
            .latent-business svg path { fill: none; stroke: currentColor; stroke-width: .85; stroke-linecap: round; stroke-linejoin: round; opacity: .7; }
            .latent-business span {
              position: absolute;
              left: 0;
              right: 0;
              bottom: 3px;
              overflow: hidden;
              color: #646d67;
              font-family: var(--pixel-font);
              font-size: .38rem;
              letter-spacing: .035em;
              line-height: 1;
              text-align: center;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .city-agent {
              position: absolute;
              z-index: 9;
              left: 0;
              top: 0;
              width: 9px;
              height: 9px;
              transform: translate3d(0,0,0);
              pointer-events: none;
              will-change: transform;
            }
            .city-agent-body {
              position: absolute;
              inset: 1px;
              border: 1px solid rgba(83, 94, 87, .48);
              border-radius: 50%;
              background: rgba(105, 119, 109, .4);
            }
            .city-agent[data-avatar="cat"] .city-agent-body::before,
            .city-agent[data-avatar="fox"] .city-agent-body::before,
            .city-agent[data-avatar="rabbit"] .city-agent-body::before,
            .city-agent[data-avatar="bear"] .city-agent-body::before {
              content: "";
              position: absolute;
              left: 0;
              top: -3px;
              width: 3px;
              height: 3px;
              border-radius: 1px 1px 0 0;
              background: currentColor;
              box-shadow: 4px 0 0 currentColor;
              opacity: .72;
            }
            .city-agent--walking .city-agent-body { background: rgba(100, 126, 139, .5); }
            .city-agent--interacting { z-index: 11; }
            .city-agent--interacting .city-agent-body {
              inset: 0;
              border-color: rgba(126, 104, 79, .58);
              background: rgba(166, 137, 102, .48);
              box-shadow: 0 0 0 3px rgba(166, 137, 102, .07);
            }
            .city-agent-thought {
              position: absolute;
              left: 7px;
              bottom: 9px;
              width: max-content;
              max-width: 78px;
              padding: 3px 5px;
              border: 1px solid rgba(121, 129, 123, .18);
              border-radius: 8px;
              background: rgba(248,247,241,.88);
              color: #68716b;
              font-family: var(--pixel-font);
              font-size: .3rem;
              font-weight: 700;
              line-height: 1;
              white-space: nowrap;
              backdrop-filter: blur(8px);
            }
            .city-business-inspector {
              position: absolute;
              z-index: 96;
              width: min(286px, calc(100vw - 24px));
              max-height: min(370px, calc(100svh - 24px));
              overflow: auto;
              padding: 12px;
              border: 1px solid rgba(116, 126, 118, .2);
              border-radius: 16px;
              background: rgba(248,247,241,.96);
              box-shadow: 0 14px 42px rgba(54,63,58,.12);
              color: #3e4641;
              backdrop-filter: blur(18px);
            }
            .city-business-inspector header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
            .city-business-inspector header span { display: grid; gap: 2px; min-width: 0; }
            .city-business-inspector header small,
            .city-inspector-label {
              color: #848c86;
              font-family: var(--pixel-font);
              font-size: .34rem;
              letter-spacing: .06em;
              text-transform: uppercase;
            }
            .city-business-inspector header strong { font-size: .72rem; line-height: 1.2; }
            .city-inspector-close {
              display: grid; place-items: center; width: 28px; height: 28px; flex: 0 0 28px;
              padding: 0; border: 0; border-radius: 50%; background: rgba(91,102,94,.06); color: #69726c; cursor: pointer;
            }
            .city-inspector-close svg { width: 13px; height: 13px; }
            .city-inspector-stats { display: flex; gap: 6px; margin: 9px 0 11px; }
            .city-inspector-stat { display: inline-flex; align-items: center; gap: 4px; padding: 5px 6px; border-radius: 9px; background: rgba(100,113,104,.06); color: #67716a; font-size: .43rem; }
            .city-inspector-stat svg { width: 11px; height: 11px; }
            .city-inspector-section { display: grid; gap: 5px; margin-top: 9px; }
            .city-inspector-item { display: grid; grid-template-columns: 1fr auto; gap: 7px; align-items: center; min-height: 26px; padding: 5px 6px; border-radius: 8px; background: rgba(255,255,255,.2); font-size: .46rem; }
            .city-inspector-item span:last-child { color: #747d77; font-family: var(--pixel-font); font-size: .34rem; }
            .city-inspector-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
            .city-inspector-action { padding: 5px 6px; border: 1px solid rgba(112,121,114,.14); border-radius: 8px; background: rgba(255,255,255,.24); color: #69736c; font-family: var(--pixel-font); font-size: .31rem; }
            @media (max-width: 620px) {
              .latent-business { width: 82px; }
              .latent-business span { font-size: .34rem; }
              .city-business-inspector { left: 12px !important; right: 12px; bottom: 68px; top: auto !important; width: auto; max-height: 48svh; }
            }
            @media (prefers-reduced-motion: reduce) {
              .latent-business { transition: none; }
            }
          `}</style>
          <div className="latent-city-layer" aria-label="Latent city with ten local businesses and one hundred autonomous resident agents">
            <svg className="latent-city-streets" viewBox="0 0 1200 760" aria-hidden="true">
              <path d="M155 180 C280 175 300 120 405 120 C545 120 610 150 735 150 C860 150 920 205 1015 205" />
              <path d="M230 420 C330 370 430 365 520 365 C655 365 735 370 850 370 C950 370 1000 435 1040 515" />
              <path d="M390 620 C520 600 640 620 760 610 C870 600 960 560 1040 515" />
              <path d="M405 120 C420 260 430 330 520 365 C560 430 520 520 390 620" />
              <path d="M735 150 C720 260 765 320 850 370 C820 470 790 540 760 610" />
            </svg>
            {city.businesses.map((business) => (
              <button
                key={business.id}
                type="button"
                className={"latent-business" + (activeBusinessIds.has(business.id) ? " is-active" : "")}
                style={{ left: business.x, top: business.y }}
                aria-label={business.name + ", " + businessKindLabel(business.kind)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => openBusiness(business, event.clientX, event.clientY)}
              >
                <svg viewBox="0 0 50 40" aria-hidden="true">
                  {linePaths(business.seed).map((path, index) => (
                    <path key={String(index)} d={path} />
                  ))}
                </svg>
                <span>{business.name}</span>
              </button>
            ))}
            {city.agents.map((agent) => (
              <span
                key={agent.id}
                ref={(node) => {
                  if (node) agentNodesRef.current.set(agent.id, node);
                  else agentNodesRef.current.delete(agent.id);
                }}
                className={"city-agent city-agent--" + agent.status}
                data-avatar={agent.avatar}
                style={{ transform: `translate3d(${agent.x}px,${agent.y}px,0)` }}
                role="img"
                aria-label={agent.name + ", agent for " + agent.ownerLabel + ", " + nextNeedLabel(agent)}
              >
                <span className="city-agent-body" aria-hidden="true" />
                {visibleThoughtIds.has(agent.id) && agent.thought ? (
                  <span className="city-agent-thought" aria-hidden="true">{agent.thought.label}</span>
                ) : null}
              </span>
            ))}
          </div>
        </>,
        worldPlane,
      )}

      {selectedBusiness && inspector
        ? createPortal(
            <aside
              className="city-business-inspector"
              style={{ left: inspector.x, top: inspector.y }}
              aria-label={selectedBusiness.name + " information"}
            >
              <header>
                <span>
                  <small>{businessKindLabel(selectedBusiness.kind)}</small>
                  <strong>{selectedBusiness.name}</strong>
                </span>
                <button
                  type="button"
                  className="city-inspector-close"
                  aria-label="Close business information"
                  onClick={() => setInspector(null)}
                >
                  <X />
                </button>
              </header>
              <div className="city-inspector-stats">
                <span className="city-inspector-stat"><Store /> {Math.round(selectedBusiness.reputation)}</span>
                <span className="city-inspector-stat"><Coins /> {Math.round(selectedBusiness.treasury)}</span>
                <span className="city-inspector-stat"><Bot /> {city.agents.filter((agent) => agent.targetBusinessId === selectedBusiness.id).length}</span>
              </div>

              {selectedBusiness.products.length > 0 ? (
                <section className="city-inspector-section">
                  <span className="city-inspector-label"><ShoppingBag /> Products</span>
                  {selectedBusiness.products.map((item) => (
                    <div className="city-inspector-item" key={item.id}>
                      <span>{item.name}</span>
                      <span>₡{item.price} · {item.stock}</span>
                    </div>
                  ))}
                </section>
              ) : null}

              {selectedBusiness.services.length > 0 ? (
                <section className="city-inspector-section">
                  <span className="city-inspector-label"><Wrench /> Services</span>
                  {selectedBusiness.services.map((item) => (
                    <div className="city-inspector-item" key={item.id}>
                      <span>{item.name}</span>
                      <span>₡{item.price} · {item.slots} · {item.minutes}m</span>
                    </div>
                  ))}
                </section>
              ) : null}

              <section className="city-inspector-section">
                <span className="city-inspector-label"><PackageSearch /> WebMCP actions</span>
                <div className="city-inspector-actions">
                  {listBusinessActions(selectedBusiness).map((action) => (
                    <span className="city-inspector-action" key={action.action}>{action.label}</span>
                  ))}
                </div>
              </section>

              <section className="city-inspector-section">
                <span className="city-inspector-label"><Clock3 /> Recent activity</span>
                {city.transactions
                  .filter((transaction) => transaction.businessId === selectedBusiness.id)
                  .slice(0, 3)
                  .map((transaction) => (
                    <div className="city-inspector-item" key={transaction.id}>
                      <span>{transaction.summary}</span>
                      <span>₡{transaction.credits}</span>
                    </div>
                  ))}
                {city.transactions.every((transaction) => transaction.businessId !== selectedBusiness.id) ? (
                  <div className="city-inspector-item"><span>Waiting for first transaction</span><span>—</span></div>
                ) : null}
              </section>
            </aside>,
            viewport,
          )
        : null}
    </>
  );
}

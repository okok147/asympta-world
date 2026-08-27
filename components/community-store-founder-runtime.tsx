"use client";

import { Camera, PackageSearch, Store, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type FoundedCatalogItem = {
  id: string;
  name: string;
  type: "product" | "service";
  price: number;
  capacity: number;
  available: number;
  tags: string[];
};

type FoundingPhase = "discover" | "research" | "capture" | "catalog" | "review" | "build" | "open";

type StoreProject = {
  id: string;
  name: string;
  summary: string;
  triggerNeed: string;
  sourceLabel: string;
  screenshot?: string;
  catalog: FoundedCatalogItem[];
  phase: FoundingPhase;
  phaseStartedAt: number;
  createdAt: number;
  updatedAt: number;
};

type FoundedPlace = {
  id: string;
  name: string;
  summary: string;
  x: number;
  y: number;
  seed: number;
  reputation: number;
  treasury: number;
  screenshot?: string;
  catalog: FoundedCatalogItem[];
  createdAt: number;
  celebratingUntil: number;
};

type FounderState = {
  version: 1;
  projects: StoreProject[];
  places: FoundedPlace[];
  lastEvaluationAt: number;
};

type RegistryTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

type Template = {
  key: string;
  name: string;
  summary: string;
  needs: string[];
  sourceLabel: string;
  catalog: Array<Omit<FoundedCatalogItem, "available">>;
};

type CommunitySnapshot = {
  agents?: Array<{ need?: string }>;
  notices?: Array<{ type?: string }>;
};

const FOUNDER_KEY = "asympta-community-store-founder-v1";
const COMMUNITY_KEY = "asympta-community-v2";
const FIRST_AUTONOMOUS_START_MS = 16000;
const NEXT_PROJECT_COOLDOWN_MS = 90000;
const MAX_FOUNDED_PLACES = 6;

const TEMPLATES: Template[] = [
  {
    key: "wellness",
    name: "Calm Wellness Corner",
    summary: "A tiny neighbourhood place for recovery, stretching and everyday wellbeing.",
    needs: ["help", "social", "rest"],
    sourceLabel: "community wellbeing demand",
    catalog: [
      { id: "recovery-session", name: "Recovery session", type: "service", price: 18, capacity: 8, tags: ["wellness", "help"] },
      { id: "stretch-class", name: "Gentle stretch class", type: "service", price: 10, capacity: 12, tags: ["wellness", "social"] },
      { id: "warm-pack", name: "Warm pack", type: "product", price: 7, capacity: 16, tags: ["wellness", "product"] },
    ],
  },
  {
    key: "tool-share",
    name: "Neighbour Tool Shelf",
    summary: "Shared tools, small repairs and practical help without every resident buying everything.",
    needs: ["mobility", "help", "garden"],
    sourceLabel: "repair and practical-help demand",
    catalog: [
      { id: "tool-kit", name: "Borrow tool kit", type: "service", price: 2, capacity: 14, tags: ["repair", "resource"] },
      { id: "small-repair", name: "Small repair help", type: "service", price: 9, capacity: 8, tags: ["repair", "help"] },
      { id: "fastener-pack", name: "Fastener pack", type: "product", price: 4, capacity: 20, tags: ["repair", "product"] },
    ],
  },
  {
    key: "care",
    name: "Neighbour Care Desk",
    summary: "Lightweight local coordination for errands, check-ins and small requests for help.",
    needs: ["help", "petcare", "laundry"],
    sourceLabel: "repeated local help requests",
    catalog: [
      { id: "errand-help", name: "Errand help", type: "service", price: 8, capacity: 10, tags: ["help", "community"] },
      { id: "check-in", name: "Neighbour check-in", type: "service", price: 0, capacity: 12, tags: ["help", "social"] },
      { id: "care-pack", name: "Care pack", type: "product", price: 6, capacity: 18, tags: ["help", "product"] },
    ],
  },
  {
    key: "photo",
    name: "Soft Light Photo Lab",
    summary: "Small portraits, product photography and calm visual documentation for local makers.",
    needs: ["culture", "gift", "social"],
    sourceLabel: "creative and local-business demand",
    catalog: [
      { id: "portrait-slot", name: "Portrait slot", type: "service", price: 20, capacity: 8, tags: ["photo", "culture"] },
      { id: "product-shoot", name: "Product shoot", type: "service", price: 34, capacity: 6, tags: ["photo", "business"] },
      { id: "mini-print", name: "Mini photo print", type: "product", price: 5, capacity: 22, tags: ["photo", "gift"] },
    ],
  },
  {
    key: "tea",
    name: "Slow Tea Room",
    summary: "A quiet social service for tea, small conversations and community meetups.",
    needs: ["social", "read", "culture"],
    sourceLabel: "quiet social demand",
    catalog: [
      { id: "tea-pot", name: "Tea pot", type: "product", price: 8, capacity: 20, tags: ["drink", "social"] },
      { id: "quiet-table", name: "Quiet table", type: "service", price: 3, capacity: 10, tags: ["social", "read"] },
      { id: "tea-circle", name: "Tea circle", type: "service", price: 4, capacity: 12, tags: ["culture", "social"] },
    ],
  },
  {
    key: "maker",
    name: "Tiny Maker Bench",
    summary: "A small fabrication and prototyping service for neighbourhood projects and experiments.",
    needs: ["help", "culture", "mobility"],
    sourceLabel: "maker and prototyping demand",
    catalog: [
      { id: "prototype-hour", name: "Prototype hour", type: "service", price: 16, capacity: 8, tags: ["maker", "service"] },
      { id: "material-pack", name: "Material pack", type: "product", price: 10, capacity: 16, tags: ["maker", "resource"] },
      { id: "maker-help", name: "Maker help", type: "service", price: 12, capacity: 9, tags: ["maker", "help"] },
    ],
  },
];

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function emptyState(now = 0): FounderState {
  return { version: 1, projects: [], places: [], lastEvaluationAt: now };
}

function loadState(now: number): FounderState {
  try {
    const raw = localStorage.getItem(FOUNDER_KEY);
    if (!raw) return emptyState(now);
    const parsed = JSON.parse(raw) as FounderState;
    if (parsed.version !== 1 || !Array.isArray(parsed.projects) || !Array.isArray(parsed.places)) return emptyState(now);
    return { ...parsed, lastEvaluationAt: parsed.lastEvaluationAt || now };
  } catch {
    return emptyState(now);
  }
}

function saveState(state: FounderState) {
  try { localStorage.setItem(FOUNDER_KEY, JSON.stringify(state)); } catch { /* memory fallback */ }
}

function communitySnapshot(): CommunitySnapshot {
  try {
    const raw = localStorage.getItem(COMMUNITY_KEY);
    return raw ? JSON.parse(raw) as CommunitySnapshot : {};
  } catch {
    return {};
  }
}

function demandNeed() {
  const snapshot = communitySnapshot();
  const counts = new Map<string, number>();
  snapshot.agents?.forEach((agent) => {
    if (agent.need) counts.set(agent.need, (counts.get(agent.need) ?? 0) + 1);
  });
  snapshot.notices?.forEach((notice) => {
    if (notice.type === "help") counts.set("help", (counts.get("help") ?? 0) + 3);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "help";
}

function templateForNeed(need: string, existing: FoundedPlace[]) {
  const unused = TEMPLATES.filter((template) => !existing.some((place) => place.id === "founded-" + template.key));
  return unused.find((template) => template.needs.includes(need)) ?? unused[0];
}

function captureReferenceScreenshot(project: StoreProject) {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 210;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "#f3f1e9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#58635c";
  context.font = "600 17px system-ui";
  context.fillText(project.name, 20, 34);
  context.fillStyle = "#7b847e";
  context.font = "12px system-ui";
  context.fillText("REFERENCE SNAPSHOT · " + project.sourceLabel, 20, 56);
  context.strokeStyle = "rgba(94,108,98,.18)";
  context.strokeRect(18, 72, 324, 112);
  context.fillStyle = "#626d65";
  project.catalog.slice(0, 4).forEach((item, index) => {
    context.fillText((item.type === "product" ? "PRODUCT" : "SERVICE") + "  " + item.name + "  ₡" + String(item.price), 30, 96 + index * 22);
  });
  context.fillStyle = "#909792";
  context.font = "10px system-ui";
  context.fillText("Captured by Asympta community research agent", 20, 202);
  return canvas.toDataURL("image/png");
}

function nextPhase(phase: FoundingPhase): FoundingPhase {
  const order: FoundingPhase[] = ["discover", "research", "capture", "catalog", "review", "build", "open"];
  return order[Math.min(order.length - 1, order.indexOf(phase) + 1)];
}

function phaseDuration(phase: FoundingPhase) {
  if (phase === "discover") return 7000;
  if (phase === "research") return 9000;
  if (phase === "capture") return 7000;
  if (phase === "catalog") return 9000;
  if (phase === "review") return 9000;
  if (phase === "build") return 11000;
  return 0;
}

function phaseLabel(phase: FoundingPhase) {
  if (phase === "discover") return "發現未滿足需求";
  if (phase === "research") return "蒐集店鋪／服務資訊";
  if (phase === "capture") return "擷取 reference screenshot";
  if (phase === "catalog") return "輸入 products / services";
  if (phase === "review") return "社區評估可行性";
  if (phase === "build") return "建立新地點";
  return "正式開張";
}

function choosePosition(index: number) {
  const positions = [[305,232],[930,255],[650,505],[300,545],[990,500],[500,245]] as const;
  return positions[index % positions.length];
}

function linePaths(seed: number) {
  const a = 8 + seed % 7;
  const b = 43 - seed % 5;
  const mid = 22 + seed % 9 - 4;
  return [
    `M ${a} 34 L ${a + 2} 18 L ${mid} 10 L ${b} 19 L ${b} 34`,
    `M ${a + 5} 25 L ${b - 5} 25`,
    `M ${mid - 4} 34 L ${mid - 4} 25 L ${mid + 5} 25 L ${mid + 5} 34`,
  ];
}

export function CommunityStoreFounderRuntime() {
  const stateRef = useRef<FounderState>(emptyState());
  const [state, setState] = useState<FounderState | null>(null);
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clock, setClock] = useState(0);

  const commit = useCallback((next: FounderState) => {
    stateRef.current = next;
    saveState(next);
    setState({
      ...next,
      projects: next.projects.map((project) => ({ ...project, catalog: project.catalog.map((item) => ({ ...item })) })),
      places: next.places.map((place) => ({ ...place, catalog: place.catalog.map((item) => ({ ...item })) })),
    });
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const now = Date.now();
      const loaded = loadState(now);
      stateRef.current = loaded;
      setState(loaded);
      setClock(now);
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane"));
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
    }, 0);
    return () => window.clearTimeout(initialize);
  }, []);

  const startProject = useCallback((template?: Template, triggerNeed?: string) => {
    const current = stateRef.current;
    const active = current.projects.find((project) => project.phase !== "open");
    if (active) return active;
    if (current.places.length >= MAX_FOUNDED_PLACES) return undefined;
    const need = triggerNeed ?? demandNeed();
    const target = template ?? templateForNeed(need, current.places);
    if (!target) return undefined;
    const now = Date.now();
    const project: StoreProject = {
      id: "project-" + target.key + "-" + now.toString(36),
      name: target.name,
      summary: target.summary,
      triggerNeed: need,
      sourceLabel: target.sourceLabel,
      catalog: target.catalog.map((item) => ({ ...item, available: item.capacity })),
      phase: "discover",
      phaseStartedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    commit({ ...current, projects: [project, ...current.projects].slice(0, 8), lastEvaluationAt: now });
    return project;
  }, [commit]);

  const publishProject = useCallback((project: StoreProject, now: number) => {
    const current = stateRef.current;
    if (current.places.some((place) => place.name === project.name)) return;
    const [x, y] = choosePosition(current.places.length);
    const key = TEMPLATES.find((template) => template.name === project.name)?.key ?? project.id;
    const place: FoundedPlace = {
      id: "founded-" + key,
      name: project.name,
      summary: project.summary,
      x, y,
      seed: hash(project.id) % 1000,
      reputation: 72,
      treasury: 120,
      screenshot: project.screenshot,
      catalog: project.catalog.map((item) => ({ ...item })),
      createdAt: now,
      celebratingUntil: now + 9000,
    };
    commit({
      ...current,
      projects: current.projects.map((candidate) => candidate.id === project.id ? { ...candidate, phase: "open", phaseStartedAt: now, updatedAt: now } : candidate),
      places: [...current.places, place],
      lastEvaluationAt: now,
    });
    window.dispatchEvent(new CustomEvent("asympta:user-task-process", {
      detail: { label: "社區新店開張", detail: place.name + " · 已加入地圖與 WebMCP", progress: 100, tone: "done" },
    }));
  }, [commit]);

  useEffect(() => {
    if (!state) return;
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      const now = Date.now();
      setClock(now);
      const active = current.projects.find((project) => project.phase !== "open");
      if (!active) {
        const cooldown = current.places.length === 0 ? FIRST_AUTONOMOUS_START_MS : NEXT_PROJECT_COOLDOWN_MS;
        if (now - current.lastEvaluationAt >= cooldown && current.places.length < MAX_FOUNDED_PLACES) startProject();
        return;
      }
      if (now - active.phaseStartedAt < phaseDuration(active.phase)) return;
      if (active.phase === "build") {
        publishProject(active, now);
        return;
      }
      const phase = nextPhase(active.phase);
      const updated: StoreProject = {
        ...active,
        phase,
        phaseStartedAt: now,
        updatedAt: now,
        screenshot: phase === "catalog" && !active.screenshot ? captureReferenceScreenshot(active) : active.screenshot,
      };
      commit({ ...current, projects: current.projects.map((project) => project.id === active.id ? updated : project) });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [commit, publishProject, startProject, state]);

  const executeFoundedAction = useCallback((place: FoundedPlace, action: "inspect" | "buy_product" | "book_service" | "inquire", itemId?: string) => {
    const current = stateRef.current;
    const target = current.places.find((candidate) => candidate.id === place.id);
    if (!target) return { ok: false, summary: "Founded place not found." };
    if (action === "inspect" || action === "inquire") return { ok: true, summary: target.name + " shared its current catalog." };
    const type = action === "buy_product" ? "product" : "service";
    const item = target.catalog.find((candidate) => candidate.id === itemId && candidate.type === type) ?? target.catalog.find((candidate) => candidate.type === type && candidate.available > 0);
    if (!item || item.available <= 0) return { ok: false, summary: "No suitable item is available." };
    item.available -= 1;
    target.treasury += item.price;
    commit({ ...current, places: current.places.map((candidate) => candidate.id === target.id ? { ...target, catalog: target.catalog.map((entry) => ({ ...entry })) } : candidate) });
    return { ok: true, summary: (action === "buy_product" ? "Bought " : "Booked ") + item.name + " at " + target.name + ".", item };
  }, [commit]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: RegistryTool[] = [
      {
        name: "community_observe_store_projects",
        title: "Observe community store founding projects",
        description: "Observe unmet-demand discovery, research, screenshot evidence, catalog entry, review, build and opening stages.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => JSON.stringify({ ok: true, projects: stateRef.current.projects, foundedPlaces: stateRef.current.places }),
      },
      {
        name: "community_start_store_project",
        title: "Start a new community store or service project",
        description: "Start a demand-driven store/service project that must gather evidence, catalog information and review before opening.",
        inputSchema: { type: "object", properties: { template: { type: "string", enum: TEMPLATES.map((template) => template.key) }, triggerNeed: { type: "string" } }, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const template = TEMPLATES.find((candidate) => candidate.key === input.template);
          const project = startProject(template, typeof input.triggerNeed === "string" ? input.triggerNeed : undefined);
          return JSON.stringify(project ? { ok: true, project } : { ok: false, error: "No project slot is currently available." });
        },
      },
      {
        name: "community_capture_store_screenshot",
        title: "Attach screenshot evidence to a store project",
        description: "Attach a real browser screenshot data URL/reference when available, or generate a local research snapshot.",
        inputSchema: { type: "object", properties: { projectId: { type: "string" }, screenshot: { type: "string", maxLength: 1200000 } }, required: ["projectId"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const current = stateRef.current;
          const project = current.projects.find((candidate) => candidate.id === String(input.projectId));
          if (!project) return JSON.stringify({ ok: false, error: "Project not found." });
          const screenshot = typeof input.screenshot === "string" && input.screenshot.length > 20 ? input.screenshot : captureReferenceScreenshot(project);
          const now = Date.now();
          const updated = { ...project, screenshot, phase: "catalog" as const, phaseStartedAt: now, updatedAt: now };
          commit({ ...current, projects: current.projects.map((candidate) => candidate.id === project.id ? updated : candidate) });
          return JSON.stringify({ ok: true, hasScreenshot: Boolean(screenshot), project: updated });
        },
      },
      {
        name: "community_set_store_catalog",
        title: "Input a proposed store product/service catalog",
        description: "Write products and services extracted from research or screenshots into a founding project before review.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            items: { type: "array", maxItems: 12, items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["product", "service"] }, price: { type: "number", minimum: 0 }, capacity: { type: "number", minimum: 1 }, tags: { type: "array", items: { type: "string" } } }, required: ["id", "name", "type", "price", "capacity"], additionalProperties: false } },
          },
          required: ["projectId", "items"], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const current = stateRef.current;
          const project = current.projects.find((candidate) => candidate.id === String(input.projectId));
          if (!project || !Array.isArray(input.items)) return JSON.stringify({ ok: false, error: "Project or catalog not found." });
          const catalog = (input.items as Array<Record<string, unknown>>).map((item, index) => {
            const capacity = Math.max(1, Math.floor(Number(item.capacity) || 1));
            return {
              id: String(item.id || "item-" + String(index + 1)),
              name: String(item.name || "Item"),
              type: item.type === "product" ? "product" as const : "service" as const,
              price: Math.max(0, Number(item.price) || 0),
              capacity,
              available: capacity,
              tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 8) : [],
            };
          });
          const now = Date.now();
          const updated = { ...project, catalog, phase: "review" as const, phaseStartedAt: now, updatedAt: now };
          commit({ ...current, projects: current.projects.map((candidate) => candidate.id === project.id ? updated : candidate) });
          return JSON.stringify({ ok: true, project: updated });
        },
      },
      {
        name: "community_publish_store_project",
        title: "Publish an approved community store",
        description: "Publish a reviewed store/service as a persistent map place and trigger its opening celebration glow.",
        inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input) => {
          const project = stateRef.current.projects.find((candidate) => candidate.id === String(input.projectId));
          if (!project) return JSON.stringify({ ok: false, error: "Project not found." });
          if (!project.screenshot || project.catalog.length === 0) return JSON.stringify({ ok: false, error: "Screenshot evidence and catalog are required before publishing." });
          publishProject({ ...project, phase: "build" }, Date.now());
          return JSON.stringify({ ok: true, place: stateRef.current.places.find((candidate) => candidate.name === project.name) });
        },
      },
      {
        name: "community_search_founded_stores",
        title: "Search community-founded stores and services",
        description: "Search stores created by the community founding workflow.",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) => {
          const query = String(input.query ?? "").toLowerCase().trim();
          const places = stateRef.current.places.filter((place) => !query || [place.name, place.summary, ...place.catalog.flatMap((item) => [item.name, ...item.tags])].join(" ").toLowerCase().includes(query));
          return JSON.stringify({ ok: true, places });
        },
      },
      {
        name: "community_execute_founded_store_action",
        title: "Use a community-founded store or service",
        description: "Inspect, buy from, book or inquire at a store created by the community founding workflow.",
        inputSchema: { type: "object", properties: { placeId: { type: "string" }, action: { type: "string", enum: ["inspect", "buy_product", "book_service", "inquire"] }, itemId: { type: "string" } }, required: ["placeId", "action"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const place = stateRef.current.places.find((candidate) => candidate.id === String(input.placeId));
          if (!place) return JSON.stringify({ ok: false, error: "Founded place not found." });
          const rawAction = String(input.action);
          const action: "inspect" | "buy_product" | "book_service" | "inquire" = rawAction === "buy_product" || rawAction === "book_service" || rawAction === "inquire" ? rawAction : "inspect";
          return JSON.stringify(executeFoundedAction(place, action, typeof input.itemId === "string" ? input.itemId : undefined));
        },
      },
    ];

    const fallback = window as unknown as { __ASYMPTA_FOUNDING_WEBMCP__?: { tools: RegistryTool[]; invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown> } };
    fallback.__ASYMPTA_FOUNDING_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown founding WebMCP tool: " + name);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };
    const modelContext = (document as unknown as { modelContext?: { registerTool: (tool: RegistryTool, options?: { signal?: AbortSignal }) => Promise<void> | void } }).modelContext;
    if (modelContext?.registerTool) tools.forEach((tool) => { void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => undefined); });
    return () => { controller.abort(); delete fallback.__ASYMPTA_FOUNDING_WEBMCP__; };
  }, [commit, executeFoundedAction, publishProject, startProject]);

  const selected = useMemo(() => state?.places.find((place) => place.id === selectedId), [selectedId, state]);
  if (!state || !worldPlane || !viewport) return null;
  const active = state.projects.find((project) => project.phase !== "open");

  return (
    <>
      <style>{`
        .founded-community-place{color:#6c8075}.founded-community-place::before{content:"";position:absolute;inset:4px 18px 19px;border-radius:50%;pointer-events:none;opacity:0}.founded-community-place.is-celebrating{opacity:1!important}.founded-community-place.is-celebrating::before{opacity:1;box-shadow:0 0 14px rgba(174,151,88,.32),0 0 34px rgba(113,149,121,.26),0 0 58px rgba(118,139,181,.18);animation:community-opening-glow 1.45s ease-in-out 6}.founded-celebration{position:absolute;left:50%;top:26px;width:4px;height:4px;border-radius:50%;background:#d3b76b;box-shadow:-22px -13px #91ad9a,20px -16px #9aa9c7,-28px 8px #c69b77,27px 9px #b39bbd,0 -27px #d6c783;pointer-events:none;animation:community-opening-spark 1.4s ease-out 6}@keyframes community-opening-glow{0%,100%{transform:scale(.88);opacity:.34}50%{transform:scale(1.28);opacity:1}}@keyframes community-opening-spark{0%{transform:translate(-50%,-50%) scale(.55);opacity:0}32%{opacity:1}100%{transform:translate(-50%,-50%) scale(1.45);opacity:0}}.founding-status-chip{position:absolute;z-index:91;left:50%;top:max(15px,env(safe-area-inset-top));max-width:280px;padding:6px 8px;transform:translateX(-50%);border:1px solid rgba(111,124,115,.15);border-radius:10px;background:rgba(248,247,241,.84);color:#727c75;font-family:var(--pixel-font);font-size:.3rem;pointer-events:none;backdrop-filter:blur(10px);opacity:.8}.founded-evidence{width:100%;aspect-ratio:12/7;margin-top:8px;border:1px solid rgba(112,121,114,.12);border-radius:9px;background-size:cover;background-position:center;opacity:.78}@media(prefers-reduced-motion:reduce){.founded-community-place.is-celebrating::before,.founded-celebration{animation:none!important}}
      `}</style>
      {createPortal(<>{state.places.map((place) => {
        const celebrating = place.celebratingUntil > clock;
        return <button type="button" className={"community-place founded-community-place" + (celebrating ? " is-celebrating" : "")} key={place.id} style={{ left: place.x, top: place.y }} aria-label={place.name + ", community-founded store"} onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelectedId(place.id)}><svg viewBox="0 0 50 36" aria-hidden="true">{linePaths(place.seed).map((path, index) => <path d={path} key={index} />)}</svg><span className="community-place-name">{place.name}</span>{celebrating ? <span className="founded-celebration" aria-hidden="true" /> : null}</button>;
      })}</>, worldPlane, "community-founded-places")}
      {active ? createPortal(<span className="founding-status-chip">{phaseLabel(active.phase)} · {active.name}</span>, viewport, "community-founding-status") : null}
      {selected ? createPortal(<section className="community-inspector" style={{ left: 14, top: 62 }} aria-label={selected.name + " founded store information"}><header><span><small>community founded</small><strong>{selected.name}</strong></span><button type="button" className="community-close" aria-label="Close founded store" onClick={() => setSelectedId(null)}><X aria-hidden="true" /></button></header><div className="community-stats"><span className="community-stat"><Store aria-hidden="true" />rep {selected.reputation}</span><span className="community-stat"><PackageSearch aria-hidden="true" />{selected.catalog.reduce((sum, item) => sum + item.available, 0)} available</span><span className="community-stat"><Camera aria-hidden="true" />evidence</span></div><span className="community-inspector-label">{selected.summary}</span>{selected.screenshot ? <div className="founded-evidence" role="img" aria-label={selected.name + " research screenshot evidence"} style={{ backgroundImage: `url(${selected.screenshot})` }} /> : null}<div className="community-offerings">{selected.catalog.map((item) => <div className="community-offering" key={item.id}><span>{item.name}</span><small>{item.available}/{item.capacity} · ₡{item.price}</small></div>)}</div><div className="community-actions"><button type="button" className="community-action" onClick={() => executeFoundedAction(selected, "inspect")}>Inspect</button><button type="button" className="community-action" onClick={() => executeFoundedAction(selected, "buy_product")}>Buy</button><button type="button" className="community-action" onClick={() => executeFoundedAction(selected, "book_service")}>Book</button><button type="button" className="community-action" onClick={() => executeFoundedAction(selected, "inquire")}>Inquire</button></div></section>, viewport, "founded-store-inspector") : null}
    </>
  );
}

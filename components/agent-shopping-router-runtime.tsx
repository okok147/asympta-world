"use client";

import { Check, MapPin, Star, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Registry = {
  invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  __rawInvoke?: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
};

type SpatialRouter = {
  visitDestination: (destination: {
    kind: "city" | "community" | "route";
    id: string;
    name: string;
    x: number;
    y: number;
  }) => Promise<boolean>;
  userPosition: () => { x: number; y: number } | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  maxStock: number;
  tags: string[];
  freshness?: number;
};

type CityBusiness = {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  seed: number;
  reputation: number;
  products: Product[];
};

type CitySnapshot = {
  businesses?: CityBusiness[];
  transactions?: Array<{ businessId: string; agentId: string; action: string; at: number }>;
};

type Review = { rating: number; comment: string; at: number };
type StoreProfile = {
  storeId: string;
  routeVisits: number;
  routeSelections: number;
  successfulPurchases: number;
  repeatSelections: number;
  lastSelectedAt?: number;
  reviews: Review[];
};

type RouteStore = {
  id: string;
  name: string;
  x: number;
  y: number;
  seed: number;
  reputation: number;
  products: Product[];
};

type RouteTransaction = {
  id: string;
  at: number;
  storeId: string;
  productId: string;
  productName: string;
  price: number;
  actorDelta: string;
  storeDelta: string;
};

type RouteState = {
  version: 1;
  profiles: Record<string, StoreProfile>;
  extraStores: RouteStore[];
  userInventory: Record<string, number>;
  transactions: RouteTransaction[];
  previousSelectedStoreId?: string;
};

type Candidate = {
  id: string;
  name: string;
  kind: "city" | "route";
  x: number;
  y: number;
  reputation: number;
  product: Product;
  point: number;
  distance: number;
  score: number;
  reason: string;
};

type ShoppingTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

type ShoppingWindow = Window & {
  __ASYMPTA_CITY_WEBMCP__?: Registry;
  __ASYMPTA_SPATIAL_ROUTER__?: SpatialRouter;
  __ASYMPTA_ROUTE_WEBMCP__?: {
    tools: ShoppingTool[];
    invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  };
};

const CITY_KEY = "asympta-latent-city-v1";
const ROUTE_KEY = "asympta-shopping-route-v1";

const EXTRA_BAKERIES: RouteStore[] = [
  {
    id: "morning-crumb",
    name: "Morning Crumb",
    x: 590,
    y: 255,
    seed: 211,
    reputation: 84,
    products: [
      { id: "morning-sourdough", name: "Daily sourdough", price: 9, stock: 18, maxStock: 18, tags: ["bread", "fresh", "value"], freshness: 91 },
      { id: "morning-wholegrain", name: "Wholegrain loaf", price: 11, stock: 13, maxStock: 13, tags: ["bread", "healthy", "wholegrain"], freshness: 87 },
      { id: "morning-roll", name: "Soft milk roll", price: 5, stock: 22, maxStock: 22, tags: ["bread", "soft", "value"], freshness: 89 },
    ],
  },
  {
    id: "grain-glow",
    name: "Grain & Glow",
    x: 925,
    y: 285,
    seed: 263,
    reputation: 93,
    products: [
      { id: "glow-seed-loaf", name: "Seeded country loaf", price: 14, stock: 14, maxStock: 14, tags: ["bread", "artisan", "healthy", "wholegrain"], freshness: 96 },
      { id: "glow-brioche", name: "Butter brioche", price: 13, stock: 11, maxStock: 11, tags: ["bread", "rich", "artisan"], freshness: 95 },
      { id: "glow-baguette", name: "Morning baguette", price: 12, stock: 17, maxStock: 17, tags: ["bread", "fresh", "artisan"], freshness: 98 },
    ],
  },
];

function defaultProfile(storeId: string): StoreProfile {
  return {
    storeId,
    routeVisits: 0,
    routeSelections: 0,
    successfulPurchases: 0,
    repeatSelections: 0,
    reviews: [],
  };
}

function defaultState(): RouteState {
  return {
    version: 1,
    profiles: {},
    extraStores: EXTRA_BAKERIES.map((store) => ({
      ...store,
      products: store.products.map((product) => ({ ...product, tags: [...product.tags] })),
    })),
    userInventory: {},
    transactions: [],
  };
}

function readCity(): CitySnapshot {
  try {
    const raw = localStorage.getItem(CITY_KEY);
    return raw ? (JSON.parse(raw) as CitySnapshot) : {};
  } catch {
    return {};
  }
}

function loadRouteState() {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as RouteState;
    if (parsed.version !== 1 || !Array.isArray(parsed.extraStores)) return defaultState();
    return {
      ...parsed,
      profiles: parsed.profiles ?? {},
      userInventory: parsed.userInventory ?? {},
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      extraStores: EXTRA_BAKERIES.map((seed) => {
        const saved = parsed.extraStores.find((store) => store.id === seed.id);
        return saved
          ? { ...saved, products: saved.products.map((product) => ({ ...product, tags: [...product.tags] })) }
          : { ...seed, products: seed.products.map((product) => ({ ...product, tags: [...product.tags] })) };
      }),
    };
  } catch {
    return defaultState();
  }
}

function saveRouteState(state: RouteState) {
  try {
    localStorage.setItem(ROUTE_KEY, JSON.stringify(state));
  } catch {
    // Memory-only mode still demonstrates the route planner.
  }
}

function cloneRouteState(state: RouteState): RouteState {
  return {
    ...state,
    profiles: Object.fromEntries(
      Object.entries(state.profiles).map(([id, profile]) => [
        id,
        { ...profile, reviews: profile.reviews.map((review) => ({ ...review })) },
      ]),
    ),
    extraStores: state.extraStores.map((store) => ({
      ...store,
      products: store.products.map((product) => ({ ...product, tags: [...product.tags] })),
    })),
    userInventory: { ...state.userInventory },
    transactions: state.transactions.map((transaction) => ({ ...transaction })),
  };
}

function profileFor(state: RouteState, storeId: string) {
  if (!state.profiles[storeId]) state.profiles[storeId] = defaultProfile(storeId);
  return state.profiles[storeId];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function reliability(products: Product[]) {
  if (!products.length) return 60;
  const ratios = products.map((product) => product.maxStock > 0 ? product.stock / product.maxStock : 0);
  return clamp((ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 100, 0, 100);
}

function cityRouteSignal(city: CitySnapshot, storeId: string, kind = "bakery") {
  const stores = city.businesses?.filter((business) => business.kind === kind) ?? [];
  const counts = stores.map((store) =>
    (city.transactions ?? []).filter((transaction) => transaction.businessId === store.id).length,
  );
  const own = (city.transactions ?? []).filter((transaction) => transaction.businessId === storeId).length;
  const max = Math.max(1, ...counts);
  return clamp(60 + (own / max) * 40, 0, 100);
}

function asymptaPoint(
  state: RouteState,
  storeId: string,
  baseReputation: number,
  products: Product[],
  city: CitySnapshot,
  kind = "bakery",
) {
  const profile = profileFor(state, storeId);
  const reviews = profile.reviews.length
    ? (profile.reviews.reduce((sum, review) => sum + review.rating, 0) / profile.reviews.length) * 20
    : baseReputation;
  const routeSignal = profile.routeVisits > 0
    ? clamp(60 + (profile.routeSelections / profile.routeVisits) * 40, 0, 100)
    : cityRouteSignal(city, storeId, kind);
  const success = profile.routeSelections > 0
    ? clamp(65 + (profile.successfulPurchases / profile.routeSelections) * 35, 0, 100)
    : 78;
  const repeat = profile.routeSelections > 0
    ? clamp(60 + (profile.repeatSelections / profile.routeSelections) * 40, 0, 100)
    : 72;
  const stockReliability = reliability(products);
  return Math.round(
    baseReputation * 0.26 +
    routeSignal * 0.24 +
    success * 0.16 +
    repeat * 0.08 +
    stockReliability * 0.10 +
    reviews * 0.16,
  );
}

function emitProcess(label: string, detail: string, progress: number, tone: string) {
  window.dispatchEvent(
    new CustomEvent("asympta:user-task-process", {
      detail: { label, detail, progress, tone },
    }),
  );
}

function lineValue(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function linePaths(seed: number) {
  const roof = 10 + lineValue(seed, 1) * 8;
  const left = 8 + lineValue(seed, 2) * 5;
  const right = 42 - lineValue(seed, 3) * 5;
  const middle = 22 + lineValue(seed, 4) * 6;
  return [
    `M ${left} 34 L ${left + 2} ${roof + 7} L ${middle} ${roof} L ${right} ${roof + 7} L ${right} 34`,
    `M ${left + 5} 25 L ${right - 5} 25`,
    `M ${middle - 4} 34 L ${middle - 4} 26 L ${middle + 4} 26 L ${middle + 4} 34`,
  ];
}

function requirements(request: string) {
  const lower = request.toLowerCase();
  return {
    budget: /(cheap|budget|lowest|低價|便宜|平價|最平|抵)/.test(lower),
    quality: /(best|quality|premium|好食|品質|最好|高質)/.test(lower),
    nearby: /(near|nearby|fast|quick|附近|最近|快)/.test(lower),
    healthy: /(healthy|wholegrain|whole grain|健康|全麥|低糖)/.test(lower),
    fresh: /(fresh|freshest|新鮮|即日)/.test(lower),
  };
}

function weights(request: string) {
  const need = requirements(request);
  if (need.budget) return { price: .37, point: .19, distance: .15, stock: .12, match: .17 };
  if (need.quality) return { price: .11, point: .37, distance: .10, stock: .15, match: .27 };
  if (need.nearby) return { price: .14, point: .20, distance: .38, stock: .14, match: .14 };
  if (need.healthy || need.fresh) return { price: .13, point: .24, distance: .12, stock: .13, match: .38 };
  return { price: .18, point: .28, distance: .18, stock: .16, match: .20 };
}

function productMatch(product: Product, request: string) {
  const need = requirements(request);
  let score = 72;
  if (need.healthy) score += product.tags.some((tag) => tag === "healthy" || tag === "wholegrain") ? 25 : -22;
  if (need.fresh) score += ((product.freshness ?? 80) - 80) * .9;
  if (/(soft|軟)/.test(request.toLowerCase()) && product.tags.includes("soft")) score += 18;
  if (/(artisan|手工)/.test(request.toLowerCase()) && product.tags.includes("artisan")) score += 18;
  return clamp(score, 0, 100);
}

function selectBread(products: Product[], request: string, maxPrice?: number) {
  const available = products.filter((product) => product.stock > 0);
  const breads = available.filter((product) =>
    product.tags.includes("bread") || /bread|loaf|bun|roll|baguette|brioche/i.test(product.name),
  );
  const pool = breads.length ? breads : available;
  return [...pool]
    .filter((product) => !maxPrice || product.price <= maxPrice || pool.every((item) => item.price > maxPrice))
    .sort((left, right) => {
      const need = requirements(request);
      if (need.healthy || need.fresh || need.quality) {
        return productMatch(right, request) - productMatch(left, request) || left.price - right.price;
      }
      return left.price - right.price;
    })[0];
}

function candidateReason(candidate: Candidate, request: string) {
  const need = requirements(request);
  const reasons: string[] = [];
  if (need.budget) reasons.push("價格");
  if (need.nearby) reasons.push("距離");
  if (need.healthy) reasons.push("健康匹配");
  if (need.fresh) reasons.push("新鮮度");
  if (need.quality) reasons.push("品質");
  reasons.push(String(candidate.point) + " AP");
  return reasons.slice(0, 3).join("＋");
}

export function AgentShoppingRouterRuntime() {
  const routeRef = useRef<RouteState>(defaultState());
  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [visitCard, setVisitCard] = useState<Candidate | null>(null);
  const [ranking, setRanking] = useState<Candidate[]>([]);
  const [running, setRunning] = useState(false);

  const commit = useCallback((next: RouteState) => {
    routeRef.current = next;
    saveRouteState(next);
    setRouteState(cloneRouteState(next));
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const loaded = loadRouteState();
      routeRef.current = loaded;
      setRouteState(cloneRouteState(loaded));
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane"));
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      setMenuHost(document.querySelector<HTMLElement>(".agent-task-panel"));
    }, 0);
    const timer = window.setInterval(() => {
      setMenuHost(document.querySelector<HTMLElement>(".agent-task-panel"));
    }, 900);
    return () => {
      window.clearTimeout(initialize);
      window.clearInterval(timer);
    };
  }, []);

  const buildCandidates = useCallback((request: string, maxPrice?: number) => {
    const state = routeRef.current;
    const city = readCity();
    const spatial = (window as ShoppingWindow).__ASYMPTA_SPATIAL_ROUTER__;
    const position = spatial?.userPosition() ?? { x: 600, y: 380 };
    const cityBakeries = (city.businesses ?? []).filter((business) => business.kind === "bakery");
    const stores = [
      ...cityBakeries.map((store) => ({ ...store, kind: "city" as const })),
      ...state.extraStores.map((store) => ({ ...store, kind: "route" as const })),
    ];
    const base = stores.flatMap((store) => {
      const product = selectBread(store.products, request, maxPrice);
      if (!product) return [];
      const point = asymptaPoint(state, store.id, store.reputation, store.products, city, "bakery");
      return [{
        id: store.id,
        name: store.name,
        kind: store.kind,
        x: store.x,
        y: store.y,
        reputation: store.reputation,
        product,
        point,
        distance: Math.hypot(store.x - position.x, store.y - position.y),
        score: 0,
        reason: "",
      } satisfies Candidate];
    });
    if (!base.length) return [];
    const minPrice = Math.min(...base.map((candidate) => candidate.product.price));
    const maxCandidatePrice = Math.max(...base.map((candidate) => candidate.product.price));
    const preference = weights(request);
    return base.map((candidate) => {
      const priceRange = Math.max(1, maxCandidatePrice - minPrice);
      const priceScore = clamp(100 - ((candidate.product.price - minPrice) / priceRange) * 48, 0, 100);
      const distanceScore = clamp(100 - candidate.distance / 8.2, 0, 100);
      const stockScore = clamp((candidate.product.stock / Math.max(1, candidate.product.maxStock)) * 100, 0, 100);
      const matchScore = productMatch(candidate.product, request);
      const score =
        priceScore * preference.price +
        candidate.point * preference.point +
        distanceScore * preference.distance +
        stockScore * preference.stock +
        matchScore * preference.match;
      const next = { ...candidate, score: Math.round(score * 10) / 10 };
      next.reason = candidateReason(next, request);
      return next;
    });
  }, []);

  const compareBakeries = useCallback(async (request: string, maxPrice?: number) => {
    if (running) return ranking;
    const spatial = (window as ShoppingWindow).__ASYMPTA_SPATIAL_ROUTER__;
    if (!spatial) throw new Error("Spatial router is not ready.");
    const candidates = buildCandidates(request, maxPrice);
    if (candidates.length < 2) throw new Error("Not enough bakery options are available to compare.");
    setRunning(true);
    setRanking([]);
    emitProcess("建立比較路線", "找到 " + String(candidates.length) + " 間 bakery · 逐間實地查看", 8, "planning");

    try {
      const remaining = [...candidates];
      const route: Candidate[] = [];
      let cursor = spatial.userPosition() ?? { x: 600, y: 380 };
      while (remaining.length) {
        remaining.sort((a, b) => Math.hypot(a.x - cursor.x, a.y - cursor.y) - Math.hypot(b.x - cursor.x, b.y - cursor.y));
        const next = remaining.shift() as Candidate;
        route.push(next);
        cursor = { x: next.x, y: next.y };
      }

      for (let index = 0; index < route.length; index += 1) {
        const candidate = route[index];
        setVisitCard(candidate);
        emitProcess(
          "前往比較 " + String(index + 1) + "/" + String(route.length),
          candidate.name + " · 到店後才讀取產品 overview",
          14 + Math.round((index / route.length) * 48),
          "moving",
        );
        const arrived = await spatial.visitDestination({
          kind: candidate.kind,
          id: candidate.id,
          name: candidate.name,
          x: candidate.x,
          y: candidate.y,
        });
        if (!arrived) continue;
        const state = cloneRouteState(routeRef.current);
        profileFor(state, candidate.id).routeVisits += 1;
        commit(state);
        emitProcess(
          "查看產品",
          candidate.name + " · " + candidate.product.name + " ₡" + String(candidate.product.price) + " · stock " + String(candidate.product.stock) + " · " + String(candidate.point) + " AP",
          25 + Math.round(((index + 1) / route.length) * 48),
          "talking",
        );
        await new Promise<void>((resolve) => window.setTimeout(resolve, 2200));
      }

      const ranked = buildCandidates(request, maxPrice).sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (best) {
        const state = cloneRouteState(routeRef.current);
        const profile = profileFor(state, best.id);
        profile.routeSelections += 1;
        if (state.previousSelectedStoreId === best.id) profile.repeatSelections += 1;
        profile.lastSelectedAt = Date.now();
        state.previousSelectedStoreId = best.id;
        commit(state);
        const rescored = buildCandidates(request, maxPrice).sort((a, b) => b.score - a.score);
        setRanking(rescored);
        setVisitCard(rescored[0] ?? best);
        emitProcess(
          "完成比較",
          best.name + " · " + best.product.name + " · " + best.reason,
          78,
          "done",
        );
        return rescored;
      }
      return ranked;
    } finally {
      setRunning(false);
    }
  }, [buildCandidates, commit, ranking, running]);

  const purchaseRouteProduct = useCallback(async (candidate: Candidate) => {
    const spatial = (window as ShoppingWindow).__ASYMPTA_SPATIAL_ROUTER__;
    if (!spatial) throw new Error("Spatial router is not ready.");
    const arrived = await spatial.visitDestination({
      kind: candidate.kind,
      id: candidate.id,
      name: candidate.name,
      x: candidate.x,
      y: candidate.y,
    });
    if (!arrived) throw new Error("Your Agent could not reach the selected bakery.");

    emitProcess("確認最佳選擇", candidate.name + " · " + candidate.product.name, 88, "talking");
    if (candidate.kind === "city") {
      const registry = (window as ShoppingWindow).__ASYMPTA_CITY_WEBMCP__;
      if (!registry) throw new Error("City WebMCP is not ready.");
      const invoke = registry.__rawInvoke ?? registry.invoke;
      const result = await invoke("city_execute_action", {
        businessId: candidate.id,
        action: "buy_product",
        agentId: "your-agent",
        itemId: candidate.product.id,
        quantity: 1,
      });
      const state = cloneRouteState(routeRef.current);
      profileFor(state, candidate.id).successfulPurchases += 1;
      commit(state);
      emitProcess("完成購買", candidate.product.name + " · 已加入 city inventory", 100, "done");
      return result;
    }

    const state = cloneRouteState(routeRef.current);
    const store = state.extraStores.find((item) => item.id === candidate.id);
    const product = store?.products.find((item) => item.id === candidate.product.id);
    if (!store || !product || product.stock <= 0) throw new Error("Selected product is no longer in stock.");
    product.stock -= 1;
    state.userInventory[product.id] = (state.userInventory[product.id] ?? 0) + 1;
    const profile = profileFor(state, store.id);
    profile.successfulPurchases += 1;
    state.transactions = [{
      id: "route-tx-" + Date.now().toString(36),
      at: Date.now(),
      storeId: store.id,
      productId: product.id,
      productName: product.name,
      price: product.price,
      actorDelta: "−₡" + String(product.price) + " +" + product.name,
      storeDelta: "+₡" + String(product.price) + " −" + product.name,
    }, ...state.transactions].slice(0, 80);
    commit(state);
    setVisitCard({ ...candidate, product: { ...product } });
    emitProcess("完成購買", product.name + " · 已加入 route inventory", 100, "done");
    return {
      ok: true,
      summary: "Bought " + product.name + " from " + store.name + ".",
      actorDelta: "−₡" + String(product.price) + " +" + product.name,
      storeDelta: "+₡" + String(product.price) + " −" + product.name,
    };
  }, [commit]);

  const buyBestBread = useCallback(async (request: string, maxPrice?: number) => {
    const ranked = await compareBakeries(request, maxPrice);
    const best = ranked[0];
    if (!best) throw new Error("No bakery candidate was selected.");
    return purchaseRouteProduct(best);
  }, [compareBakeries, purchaseRouteProduct]);

  const submitReview = useCallback((storeId: string, rating: number, comment = "") => {
    const state = cloneRouteState(routeRef.current);
    const profile = profileFor(state, storeId);
    profile.reviews = [{ rating: clamp(Math.round(rating), 1, 5), comment: comment.slice(0, 180), at: Date.now() }, ...profile.reviews].slice(0, 40);
    commit(state);
    const updated = buildCandidates("best bread").find((candidate) => candidate.id === storeId);
    if (updated) setVisitCard(updated);
    return updated;
  }, [buildCandidates, commit]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: ShoppingTool[] = [
      {
        name: "market_compare_bakeries",
        title: "Physically compare multiple bakeries",
        description: "Use this for bread or bakery shopping. Your Agent physically visits multiple bakeries, waits to arrive at each building, reads product overview, price, stock and Asympta Point, then ranks the options against the user's requirements.",
        inputSchema: {
          type: "object",
          properties: {
            request: { type: "string", minLength: 3, maxLength: 240 },
            maxPrice: { type: "number", minimum: 1, maximum: 500 },
          },
          required: ["request"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => JSON.stringify({
          ok: true,
          ranking: await compareBakeries(
            String(input.request),
            typeof input.maxPrice === "number" ? input.maxPrice : undefined,
          ),
        }),
      },
      {
        name: "market_buy_best_bread",
        title: "Compare bakeries and buy the best bread",
        description: "Preferred action when the user asks to buy bread. The agent visits multiple bakeries first, compares product overviews and Asympta Points using the user's price, quality, distance, freshness or health requirements, then travels to the winner and only buys after physically arriving.",
        inputSchema: {
          type: "object",
          properties: {
            request: { type: "string", minLength: 3, maxLength: 240 },
            maxPrice: { type: "number", minimum: 1, maximum: 500 },
          },
          required: ["request"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => JSON.stringify(await buyBestBread(
          String(input.request),
          typeof input.maxPrice === "number" ? input.maxPrice : undefined,
        )),
      },
      {
        name: "market_review_store",
        title: "Review a store and update its Asympta Point",
        description: "Add a 1–5 user review. Reviews are one independent signal in Asympta Point alongside real agent routing, selection, repeat-choice, purchase success and stock reliability.",
        inputSchema: {
          type: "object",
          properties: {
            storeId: { type: "string" },
            rating: { type: "number", minimum: 1, maximum: 5 },
            comment: { type: "string", maxLength: 180 },
          },
          required: ["storeId", "rating"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => JSON.stringify({
          ok: true,
          store: submitReview(String(input.storeId), Number(input.rating), typeof input.comment === "string" ? input.comment : ""),
        }),
      },
      {
        name: "market_inspect_asympta_point",
        title: "Inspect a store's Asympta Point",
        description: "Explain a store's current Asympta Point and the routing/review signals that contribute to it.",
        inputSchema: {
          type: "object",
          properties: { storeId: { type: "string" } },
          required: ["storeId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const storeId = String(input.storeId);
          const state = routeRef.current;
          const city = readCity();
          const cityStore = city.businesses?.find((store) => store.id === storeId);
          const routeStore = state.extraStores.find((store) => store.id === storeId);
          const store = cityStore ?? routeStore;
          if (!store) return JSON.stringify({ ok: false, error: "Store not found." });
          const profile = profileFor(state, storeId);
          return JSON.stringify({
            ok: true,
            storeId,
            name: store.name,
            asymptaPoint: asymptaPoint(state, storeId, store.reputation, store.products, city, "bakery"),
            routeVisits: profile.routeVisits,
            routeSelections: profile.routeSelections,
            successfulPurchases: profile.successfulPurchases,
            repeatSelections: profile.repeatSelections,
            userReviews: profile.reviews,
            stockReliability: Math.round(reliability(store.products)),
          });
        },
      },
    ];

    const target = window as ShoppingWindow;
    target.__ASYMPTA_ROUTE_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown route WebMCP tool: " + name);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };

    const modelContext = (document as unknown as {
      modelContext?: { registerTool: (tool: ShoppingTool, options?: { signal?: AbortSignal }) => Promise<void> | void };
    }).modelContext;
    if (modelContext?.registerTool) {
      tools.forEach((tool) => {
        void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => undefined);
      });
    }
    return () => {
      controller.abort();
      delete target.__ASYMPTA_ROUTE_WEBMCP__;
    };
  }, [buyBestBread, compareBakeries, submitReview]);

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form?.classList.contains("need-composer")) return;
      const input = form.querySelector<HTMLInputElement>('input[aria-label="What do you need?"]');
      const text = input?.value.trim() ?? "";
      if (!/(bread|bakery|loaf|麵包|麵包店|方包)/i.test(text)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void buyBestBread(text).catch((error: unknown) => {
        emitProcess("購買流程暫停", error instanceof Error ? error.message : "Unable to complete bakery comparison.", 35, "blocked");
      });
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [buyBestBread]);

  const city = readCity();
  const pointBadges = useMemo(() => {
    if (!routeState) return [];
    const cityBakeries = (city.businesses ?? []).filter((business) => business.kind === "bakery");
    return [
      ...cityBakeries.map((store) => ({
        id: store.id,
        name: store.name,
        x: store.x,
        y: store.y,
        point: asymptaPoint(routeState, store.id, store.reputation, store.products, city, "bakery"),
      })),
      ...routeState.extraStores.map((store) => ({
        id: store.id,
        name: store.name,
        x: store.x,
        y: store.y,
        point: asymptaPoint(routeState, store.id, store.reputation, store.products, city, "bakery"),
      })),
    ];
  }, [city, routeState]);

  if (!routeState || !worldPlane) return null;

  const inventoryNames = new Map(routeState.extraStores.flatMap((store) => store.products.map((product) => [product.id, product.name] as const)));

  return (
    <>
      <style>{`
        .route-market-store { color:#776f65 !important; }
        .route-market-store .route-market-name { position:absolute; left:0; right:0; bottom:5px; overflow:hidden; color:#686158; font-family:var(--pixel-font); font-size:.36rem; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
        .route-market-store svg { position:absolute; left:23px; top:2px; width:48px; height:39px; overflow:visible; }
        .route-market-store svg path { fill:none; stroke:currentColor; stroke-width:.85; stroke-linecap:round; stroke-linejoin:round; opacity:.72; }
        .asympta-point-badge { position:absolute; z-index:35; min-width:36px; padding:3px 4px; transform:translate(-50%,-50%); border:1px solid rgba(118,139,181,.18); border-radius:7px; background:rgba(248,247,241,.9); color:#5d719d; font-family:var(--pixel-font); font-size:.27rem; font-weight:700; text-align:center; pointer-events:none; backdrop-filter:blur(7px); }
        .route-visit-card { position:absolute; z-index:112; left:50%; top:max(76px,calc(env(safe-area-inset-top) + 66px)); display:grid; gap:4px; width:min(330px,calc(100vw - 30px)); padding:9px 10px; transform:translateX(-50%); border:1px solid rgba(114,126,117,.18); border-radius:14px; background:rgba(248,247,241,.95); box-shadow:0 10px 30px rgba(54,63,58,.08); color:#505a54; backdrop-filter:blur(16px); pointer-events:auto; }
        .route-visit-card header { display:flex; align-items:center; gap:6px; }
        .route-visit-card header svg { width:12px; height:12px; color:#6e82aa; }
        .route-visit-card header strong { font-size:.55rem; }
        .route-visit-card small { color:#7b847e; font-size:.4rem; }
        .route-rank { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:6px; min-height:25px; padding:4px 5px; border-radius:8px; background:rgba(103,119,107,.045); font-size:.4rem; }
        .route-rank b { font-family:var(--pixel-font); font-size:.3rem; color:#6176a2; }
        .route-review { display:flex; align-items:center; gap:4px; padding-top:4px; border-top:1px solid rgba(112,120,114,.1); }
        .route-review span { margin-right:auto; color:#838a85; font-family:var(--pixel-font); font-size:.3rem; }
        .route-review button { display:grid; place-items:center; width:24px; height:24px; padding:0; border:1px solid rgba(112,121,114,.12); border-radius:50%; background:rgba(255,255,255,.25); color:#8a826f; cursor:pointer; }
        .route-review button svg { width:10px; height:10px; }
        .route-market-menu { display:grid; gap:5px; margin-top:9px; padding-top:8px; border-top:1px solid rgba(112,120,114,.1); }
        .route-market-menu > span { color:#858b86; font-family:var(--pixel-font); font-size:.34rem; letter-spacing:.05em; text-transform:uppercase; }
        .route-market-pills { display:flex; flex-wrap:wrap; gap:5px; }
        .route-market-pill { padding:5px 6px; border-radius:8px; background:rgba(104,119,108,.055); color:#606a63; font-size:.38rem; }
        @media(max-width:620px){.route-visit-card{top:max(64px,calc(env(safe-area-inset-top) + 56px));}}
      `}</style>

      {createPortal(
        <>
          {routeState.extraStores.map((store) => (
            <button
              type="button"
              className="latent-business route-market-store"
              key={store.id}
              style={{ left: store.x, top: store.y }}
              aria-label={store.name + ", Bakery"}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <svg viewBox="0 0 50 40" aria-hidden="true">
                {linePaths(store.seed).map((path, index) => <path key={index} d={path} />)}
              </svg>
              <span className="route-market-name latent-business-name">{store.name}</span>
            </button>
          ))}
          {pointBadges.map((store) => (
            <span
              className="asympta-point-badge"
              key={"ap:" + store.id}
              style={{ left: store.x + 31, top: store.y - 31 }}
              title={store.name + " Asympta Point"}
            >
              AP {store.point}
            </span>
          ))}
        </>,
        worldPlane,
        "route-market-layer",
      )}

      {viewport && visitCard ? createPortal(
        <section className="route-visit-card" aria-label="Bakery comparison overview">
          <header>
            {ranking.length ? <Check aria-hidden="true" /> : <MapPin aria-hidden="true" />}
            <strong>{ranking.length ? "比較結果 · " + ranking[0]?.name : "查看 · " + visitCard.name}</strong>
            <small style={{ marginLeft: "auto" }}>{visitCard.point} AP</small>
          </header>
          <small>{visitCard.product.name} · ₡{visitCard.product.price} · stock {visitCard.product.stock} · freshness {visitCard.product.freshness ?? 80}</small>
          {ranking.slice(0, 3).map((candidate, index) => (
            <div className="route-rank" key={candidate.id}>
              <b>#{index + 1}</b>
              <span>{candidate.name} · {candidate.product.name}</span>
              <b>{candidate.score}</b>
            </div>
          ))}
          {ranking[0] ? (
            <div className="route-review">
              <span>Review {ranking[0].name}</span>
              {[1,2,3,4,5].map((rating) => (
                <button type="button" key={rating} aria-label={String(rating) + " star review"} onClick={() => submitReview(ranking[0].id, rating)}>
                  <Star aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
        </section>,
        viewport,
        "route-comparison-card",
      ) : null}

      {menuHost ? createPortal(
        <section className="route-market-menu" aria-label="Route market inventory">
          <span><Store aria-hidden="true" /> Bakery route</span>
          <div className="route-market-pills">
            {Object.entries(routeState.userInventory).filter(([, quantity]) => quantity > 0).slice(0, 6).map(([id, quantity]) => (
              <span className="route-market-pill" key={id}>{inventoryNames.get(id) ?? id} ×{quantity}</span>
            ))}
            {Object.values(routeState.userInventory).every((quantity) => quantity <= 0) ? <span className="route-market-pill">No routed purchases yet</span> : null}
          </div>
        </section>,
        menuHost,
        "route-market-menu",
      ) : null}
    </>
  );
}

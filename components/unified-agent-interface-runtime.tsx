"use client";

import {
  Activity,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  MapPin,
  Navigation,
  Search,
  Star,
  Store,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Tone = "planning" | "moving" | "talking" | "working" | "done" | "transaction" | "blocked" | "idle";
type LiveStatus = {
  label: string;
  detail: string;
  progress: number;
  tone: Tone;
  updatedAt: number;
};

type Mission = {
  id: string;
  title: string;
  status: string;
  progress: number;
  currentEncounterId?: string;
  subtasks?: Array<{ title: string; status: string }>;
};

type Encounter = {
  id: string;
  phase: string;
  participants: string[];
  completed: boolean;
};

type CityProduct = { id: string; name: string; price: number; stock: number; maxStock?: number };
type CityService = { id: string; name: string; price: number; slots: number; maxSlots?: number };
type CityBusiness = {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  reputation: number;
  products?: CityProduct[];
  services?: CityService[];
};
type CityState = {
  businesses?: CityBusiness[];
  transactions?: Array<{ businessId: string; agentId: string; action: string; at: number }>;
};

type CommunityOffering = { id: string; name: string; type: string; price: number; available: number; capacity: number };
type CommunityPlace = {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  reputation: number;
  resources?: number;
  offerings?: CommunityOffering[];
};
type CommunityState = { places?: CommunityPlace[] };

type FoundedCatalog = { id: string; name: string; type: "product" | "service"; price: number; available: number; capacity: number };
type FoundedPlace = {
  id: string;
  name: string;
  summary: string;
  x: number;
  y: number;
  reputation: number;
  catalog: FoundedCatalog[];
};
type FounderState = { places?: FoundedPlace[] };

type Review = { rating: number; comment: string; at: number };
type StoreProfile = {
  storeId: string;
  routeVisits: number;
  routeSelections: number;
  successfulPurchases: number;
  repeatSelections: number;
  reviews: Review[];
};
type RouteProduct = { id: string; name: string; price: number; stock: number; maxStock: number };
type RouteStore = { id: string; name: string; x: number; y: number; reputation: number; products: RouteProduct[] };
type RouteState = { profiles?: Record<string, StoreProfile>; extraStores?: RouteStore[] };

type DirectorySource = "city" | "community" | "founded" | "route";
type DirectoryPlace = {
  id: string;
  name: string;
  source: DirectorySource;
  kind: string;
  className: "store" | "service" | "community" | "facility";
  x: number;
  y: number;
  point: number;
  availability: number;
  maxAvailability: number;
  minPrice: number | null;
  info: Array<{ id: string; name: string; type: string; price: number; available: number }>;
  summary?: string;
};

type SortMode = "distance" | "point" | "availability" | "name" | "type";
type TypeFilter = "all" | DirectoryPlace["className"];

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

type RuntimeWindow = Window & { __ASYMPTA_SPATIAL_ROUTER__?: SpatialRouter };

const CITY_KEY = "asympta-latent-city-v1";
const COMMUNITY_KEY = "asympta-community-v2";
const FOUNDER_KEY = "asympta-community-store-founder-v1";
const ROUTE_KEY = "asympta-shopping-route-v1";
const MISSIONS_KEY = "asympta-user-missions-v1";
const ENCOUNTERS_KEY = "asympta-encounters-v1";
const STATUS_KEY = "asympta-user-live-status-v1";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStatus(status: LiveStatus) {
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(status)); } catch { /* memory fallback */ }
}

function statusFromMission(): LiveStatus {
  const missions = readJson<Mission[]>(MISSIONS_KEY, []);
  const encounters = readJson<Encounter[]>(ENCOUNTERS_KEY, []);
  const active = missions.find((mission) => mission.status !== "completed") ?? null;
  if (!active) {
    const agent = document.querySelector<HTMLElement>(".mission-user-agent");
    if (agent?.classList.contains("is-world-walking")) {
      return { label: "前往地點", detail: "Your Agent 正在移動", progress: 0, tone: "moving", updatedAt: Date.now() };
    }
    if (agent?.classList.contains("is-world-encountering")) {
      return { label: "進行互動", detail: "正在和附近 agent 溝通", progress: 0, tone: "talking", updatedAt: Date.now() };
    }
    return { label: "Ready", detail: "等待下一個任務", progress: 0, tone: "idle", updatedAt: Date.now() };
  }
  const encounter = active.currentEncounterId
    ? encounters.find((candidate) => candidate.id === active.currentEncounterId && !candidate.completed)
    : undefined;
  const subtask = active.subtasks?.find((item) => item.status !== "completed")?.title;
  if (encounter) {
    const phaseMap: Record<string, string> = {
      approach: "前往協作",
      greet: "開始對話",
      discuss: "討論方案",
      deal: "確認合作",
      close: "完成合作",
      depart: "返回任務",
    };
    return {
      label: phaseMap[encounter.phase] ?? "進行互動",
      detail: encounter.participants[1] ?? subtask ?? active.title,
      progress: active.progress,
      tone: encounter.phase === "approach" || encounter.phase === "depart" ? "moving" : "talking",
      updatedAt: Date.now(),
    };
  }
  const labels: Record<string, { label: string; tone: Tone }> = {
    new: { label: "任務排隊", tone: "planning" },
    planning: { label: "規劃任務", tone: "planning" },
    hiring: { label: "尋找協作者", tone: "talking" },
    working: { label: "執行任務", tone: "working" },
    blocked: { label: "重新評估", tone: "blocked" },
  };
  const mapped = labels[active.status] ?? { label: "處理任務", tone: "working" as Tone };
  return {
    label: mapped.label,
    detail: subtask ?? active.title,
    progress: active.progress,
    tone: mapped.tone,
    updatedAt: Date.now(),
  };
}

function userPosition() {
  const router = (window as RuntimeWindow).__ASYMPTA_SPATIAL_ROUTER__;
  const routed = router?.userPosition();
  if (routed) return routed;
  const node = document.querySelector<HTMLElement>(".mission-user-agent");
  return {
    x: Number.parseFloat(node?.style.left ?? "") || node?.offsetLeft || 600,
    y: Number.parseFloat(node?.style.top ?? "") || node?.offsetTop || 380,
  };
}

function reliability(products: Array<{ stock: number; maxStock?: number }>, services: Array<{ slots: number; maxSlots?: number }>) {
  const values = [
    ...products.map((item) => item.maxStock && item.maxStock > 0 ? item.stock / item.maxStock : item.stock > 0 ? 1 : 0),
    ...services.map((item) => item.maxSlots && item.maxSlots > 0 ? item.slots / item.maxSlots : item.slots > 0 ? 1 : 0),
  ];
  if (!values.length) return 75;
  return clamp((values.reduce((sum, value) => sum + value, 0) / values.length) * 100, 0, 100);
}

function routePoint(
  route: RouteState,
  city: CityState,
  storeId: string,
  baseReputation: number,
  products: RouteProduct[] | CityProduct[],
) {
  const profile = route.profiles?.[storeId];
  const reviews = profile?.reviews?.length
    ? (profile.reviews.reduce((sum, review) => sum + review.rating, 0) / profile.reviews.length) * 20
    : baseReputation;
  const bakeryIds = [
    ...(city.businesses ?? []).filter((business) => business.kind === "bakery").map((business) => business.id),
    ...(route.extraStores ?? []).map((store) => store.id),
  ];
  const transactionCounts = bakeryIds.map((id) =>
    (city.transactions ?? []).filter((transaction) => transaction.businessId === id).length,
  );
  const ownCount = (city.transactions ?? []).filter((transaction) => transaction.businessId === storeId).length;
  const maxCount = Math.max(1, ...transactionCounts);
  const routeSignal = profile?.routeVisits
    ? clamp(60 + (profile.routeSelections / profile.routeVisits) * 40, 0, 100)
    : clamp(60 + (ownCount / maxCount) * 40, 0, 100);
  const success = profile?.routeSelections
    ? clamp(65 + (profile.successfulPurchases / profile.routeSelections) * 35, 0, 100)
    : 78;
  const repeat = profile?.routeSelections
    ? clamp(60 + (profile.repeatSelections / profile.routeSelections) * 40, 0, 100)
    : 72;
  const stock = reliability(products.map((item) => ({ stock: item.stock, maxStock: item.maxStock })), []);
  return Math.round(
    baseReputation * .26 + routeSignal * .24 + success * .16 + repeat * .08 + stock * .10 + reviews * .16,
  );
}

function classifyCity(business: CityBusiness): DirectoryPlace["className"] {
  const products = business.products?.length ?? 0;
  const services = business.services?.length ?? 0;
  if (services > 0 && products === 0) return "service";
  if (["learning", "coworking", "automation", "repair", "courier", "design"].includes(business.kind) && services >= products) return "service";
  return "store";
}

function collectPlaces(): DirectoryPlace[] {
  const city = readJson<CityState>(CITY_KEY, {});
  const community = readJson<CommunityState>(COMMUNITY_KEY, {});
  const founder = readJson<FounderState>(FOUNDER_KEY, {});
  const route = readJson<RouteState>(ROUTE_KEY, {});

  const result: DirectoryPlace[] = [];
  for (const business of city.businesses ?? []) {
    const products = business.products ?? [];
    const services = business.services ?? [];
    const info = [
      ...products.map((item) => ({ id: item.id, name: item.name, type: "product", price: item.price, available: item.stock })),
      ...services.map((item) => ({ id: item.id, name: item.name, type: "service", price: item.price, available: item.slots })),
    ];
    const isBakery = business.kind === "bakery";
    result.push({
      id: business.id,
      name: business.name,
      source: "city",
      kind: business.kind,
      className: classifyCity(business),
      x: business.x,
      y: business.y,
      point: isBakery ? routePoint(route, city, business.id, business.reputation, products) : Math.round(business.reputation),
      availability: info.reduce((sum, item) => sum + item.available, 0),
      maxAvailability: products.reduce((sum, item) => sum + (item.maxStock ?? item.stock), 0) + services.reduce((sum, item) => sum + (item.maxSlots ?? item.slots), 0),
      minPrice: info.length ? Math.min(...info.map((item) => item.price)) : null,
      info,
    });
  }

  for (const place of community.places ?? []) {
    const offerings = place.offerings ?? [];
    result.push({
      id: place.id,
      name: place.name,
      source: "community",
      kind: place.kind,
      className: "community",
      x: place.x,
      y: place.y,
      point: Math.round(place.reputation),
      availability: offerings.reduce((sum, item) => sum + item.available, 0),
      maxAvailability: offerings.reduce((sum, item) => sum + item.capacity, 0),
      minPrice: offerings.length ? Math.min(...offerings.map((item) => item.price)) : null,
      info: offerings.map((item) => ({ id: item.id, name: item.name, type: item.type, price: item.price, available: item.available })),
    });
  }

  for (const place of founder.places ?? []) {
    const catalog = place.catalog ?? [];
    result.push({
      id: place.id,
      name: place.name,
      source: "founded",
      kind: "community-born",
      className: catalog.some((item) => item.type === "product") ? "store" : "service",
      x: place.x,
      y: place.y,
      point: Math.round(place.reputation),
      availability: catalog.reduce((sum, item) => sum + item.available, 0),
      maxAvailability: catalog.reduce((sum, item) => sum + item.capacity, 0),
      minPrice: catalog.length ? Math.min(...catalog.map((item) => item.price)) : null,
      info: catalog.map((item) => ({ id: item.id, name: item.name, type: item.type, price: item.price, available: item.available })),
      summary: place.summary,
    });
  }

  const knownIds = new Set(result.map((place) => place.id));
  for (const store of route.extraStores ?? []) {
    if (knownIds.has(store.id)) continue;
    result.push({
      id: store.id,
      name: store.name,
      source: "route",
      kind: "bakery",
      className: "store",
      x: store.x,
      y: store.y,
      point: routePoint(route, city, store.id, store.reputation, store.products),
      availability: store.products.reduce((sum, item) => sum + item.stock, 0),
      maxAvailability: store.products.reduce((sum, item) => sum + item.maxStock, 0),
      minPrice: store.products.length ? Math.min(...store.products.map((item) => item.price)) : null,
      info: store.products.map((item) => ({ id: item.id, name: item.name, type: "product", price: item.price, available: item.stock })),
    });
  }

  return result;
}

function sourceLabel(source: DirectorySource) {
  if (source === "city") return "Business";
  if (source === "community") return "Community";
  if (source === "founded") return "Community-born";
  return "Route store";
}

function placeIcon(place: DirectoryPlace) {
  if (place.className === "community") return HeartHandshake;
  if (place.className === "facility") return Building2;
  if (place.className === "service") return Activity;
  return Store;
}

export function UnifiedAgentInterfaceRuntime() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [taskControl, setTaskControl] = useState<HTMLElement | null>(null);
  const [portraitHosts, setPortraitHosts] = useState<HTMLElement[]>([]);
  const [status, setStatus] = useState<LiveStatus>(() => ({ label: "Ready", detail: "等待下一個任務", progress: 0, tone: "idle", updatedAt: 0 }));
  const [places, setPlaces] = useState<DirectoryPlace[]>([]);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goingId, setGoingId] = useState<string | null>(null);
  const [positionVersion, setPositionVersion] = useState(0);

  useEffect(() => {
    const syncHosts = () => {
      const nextViewport = document.querySelector<HTMLElement>(".world-viewport");
      const nextControl = document.querySelector<HTMLElement>(".agent-task-control");
      const nextPortraits = [...document.querySelectorAll<HTMLElement>(".mission-user-agent .agent-portrait")];
      setViewport((current) => current === nextViewport ? current : nextViewport);
      setTaskControl((current) => current === nextControl ? current : nextControl);
      setPortraitHosts((current) => {
        if (current.length === nextPortraits.length && current.every((host, index) => host === nextPortraits[index])) return current;
        return nextPortraits;
      });
    };
    const initial = window.setTimeout(syncHosts, 0);
    const timer = window.setInterval(syncHosts, 420);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onProcess = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; detail?: string; progress?: number; tone?: Tone }>).detail;
      if (!detail?.label) return;
      const next: LiveStatus = {
        label: detail.label,
        detail: detail.detail ?? "",
        progress: clamp(Number(detail.progress ?? 0), 0, 100),
        tone: detail.tone ?? "working",
        updatedAt: Date.now(),
      };
      setStatus(next);
      writeStatus(next);
    };
    const onBehavior = (event: Event) => {
      const detail = (event as CustomEvent<{ actorName?: string; message?: string; partnerName?: string; kind?: string }>).detail;
      if (detail?.actorName !== "Your Agent" || !detail.message) return;
      const next: LiveStatus = {
        label: detail.message,
        detail: detail.partnerName ? "with " + detail.partnerName : "Agent activity",
        progress: status.progress,
        tone: detail.kind === "deal" ? "transaction" : detail.kind === "workflow" ? "working" : "talking",
        updatedAt: Date.now(),
      };
      setStatus(next);
      writeStatus(next);
    };
    const onMotion = (event: Event) => {
      const detail = (event as CustomEvent<{ agentName?: string }>).detail;
      if (detail?.agentName !== "Your Agent") return;
      const next: LiveStatus = {
        label: "前往地點",
        detail: "Your Agent 正在移動",
        progress: status.progress,
        tone: "moving",
        updatedAt: Date.now(),
      };
      setStatus(next);
      writeStatus(next);
    };
    window.addEventListener("asympta:user-task-process", onProcess);
    window.addEventListener("asympta:agent-behavior", onBehavior);
    window.addEventListener("asympta:agent-motion-target", onMotion);
    return () => {
      window.removeEventListener("asympta:user-task-process", onProcess);
      window.removeEventListener("asympta:agent-behavior", onBehavior);
      window.removeEventListener("asympta:agent-motion-target", onMotion);
    };
  }, [status.progress]);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const saved = readJson<LiveStatus | null>(STATUS_KEY, null);
      setStatus(saved ?? statusFromMission());
      setPlaces(collectPlaces());
    }, 0);
    const timer = window.setInterval(() => {
      setPlaces(collectPlaces());
      setPositionVersion((value) => value + 1);
      setStatus((current) => {
        if (Date.now() - current.updatedAt < 4200) return current;
        const next = statusFromMission();
        writeStatus(next);
        return next;
      });
    }, 760);
    return () => {
      window.clearTimeout(initialize);
      window.clearInterval(timer);
    };
  }, []);

  const user = useMemo(() => userPosition(), [positionVersion]);
  const visiblePlaces = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return places
      .filter((place) => typeFilter === "all" || place.className === typeFilter)
      .filter((place) => {
        if (!clean) return true;
        return [place.name, place.kind, sourceLabel(place.source), ...place.info.map((item) => item.name)]
          .join(" ")
          .toLowerCase()
          .includes(clean);
      })
      .map((place) => ({ ...place, distance: Math.hypot(place.x - user.x, place.y - user.y) }))
      .sort((left, right) => {
        if (sortMode === "distance") return left.distance - right.distance;
        if (sortMode === "point") return right.point - left.point || left.distance - right.distance;
        if (sortMode === "availability") return right.availability - left.availability || right.point - left.point;
        if (sortMode === "type") return left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name);
        return left.name.localeCompare(right.name);
      });
  }, [places, positionVersion, query, sortMode, typeFilter, user.x, user.y]);

  const selected = visiblePlaces.find((place) => place.id === selectedId) ?? places.find((place) => place.id === selectedId);

  const goTo = async (place: DirectoryPlace) => {
    const router = (window as RuntimeWindow).__ASYMPTA_SPATIAL_ROUTER__;
    if (!router || goingId) return;
    setGoingId(place.id);
    setStatus({ label: "前往地點", detail: place.name, progress: 40, tone: "moving", updatedAt: Date.now() });
    const kind = place.source === "community" ? "community" : place.source === "route" ? "route" : "city";
    try {
      await router.visitDestination({ kind, id: place.id, name: place.name, x: place.x, y: place.y });
    } finally {
      setGoingId(null);
    }
  };

  if (!viewport) return null;

  return (
    <>
      <style>{`
        /* Your Agent now uses the exact same tiny animal-body language as other agents. */
        .mission-user-agent .mission-pixel-person { display:none!important; }
        .world-agent.mission-user-agent .agent-portrait.mission-agent-portrait {
          position:relative!important;
          display:grid!important;
          place-items:center!important;
          width:14px!important;
          height:14px!important;
          overflow:visible!important;
          border:0!important;
          border-radius:50%!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        .shared-agent-animal-body {
          position:relative;
          display:block;
          width:9px;
          height:9px;
          border:1px solid var(--animal-dark,#59645c);
          border-radius:50%;
          background:var(--animal-body,#87958a);
          box-shadow:0 0 0 2px rgba(88,104,94,.045);
        }
        .shared-agent-animal-body::before {
          content:"";
          position:absolute;
          left:0;
          top:-3px;
          width:3px;
          height:3px;
          border-radius:1px 1px 0 0;
          background:var(--animal-dark,#59645c);
          box-shadow:5px 0 var(--animal-dark,#59645c);
        }
        .shared-agent-animal-body::after {
          content:"";
          position:absolute;
          left:3px;
          top:3px;
          width:2px;
          height:2px;
          border-radius:50%;
          background:var(--animal-accent,#d9dfd7);
        }
        .mission-user-agent[data-animal-family="round"] .shared-agent-animal-body::before { top:-1px; opacity:.42; }
        .mission-user-agent[data-animal-family="long-ear"] .shared-agent-animal-body::before { width:2px; height:5px; top:-5px; box-shadow:6px 0 var(--animal-dark); }
        .mission-user-agent[data-animal-family="horned"] .shared-agent-animal-body::before { width:2px; height:4px; top:-4px; transform:rotate(-12deg); box-shadow:6px 1px var(--animal-dark); }
        .mission-user-agent[data-animal-family="bird"] .shared-agent-animal-body::before { left:7px; top:3px; width:3px; height:2px; box-shadow:none; background:var(--animal-accent); }
        .mission-user-agent[data-animal-family="aquatic"] .shared-agent-animal-body::before { left:-3px; top:3px; width:3px; height:3px; border-radius:50%; box-shadow:11px 0 var(--animal-accent); background:var(--animal-accent); }
        .mission-user-agent[data-animal-family="tiny"] .shared-agent-animal-body { transform:scale(.84); }
        .mission-user-agent[data-animal-family="fantasy"] .shared-agent-animal-body::before { left:4px; top:-5px; width:2px; height:6px; transform:rotate(18deg); box-shadow:none; background:var(--animal-accent); }

        .agent-live-status {
          pointer-events:none;
          width:184px;
          padding:7px 9px;
          border:1px solid rgba(115,126,118,.14);
          border-radius:12px;
          background:rgba(248,247,241,.82);
          box-shadow:0 7px 22px rgba(54,63,58,.06);
          color:#5d6760;
          backdrop-filter:blur(12px);
        }
        .agent-live-status header { display:flex; align-items:center; gap:6px; }
        .agent-live-status header svg { width:11px; height:11px; flex:0 0 auto; }
        .agent-live-status strong { overflow:hidden; flex:1; font-size:.46rem; text-overflow:ellipsis; white-space:nowrap; }
        .agent-live-status b { color:#768bb5; font-family:var(--pixel-font); font-size:.3rem; }
        .agent-live-status small { display:block; margin-top:2px; overflow:hidden; color:#7d857f; font-size:.37rem; text-overflow:ellipsis; white-space:nowrap; }
        .agent-live-status i { display:block; height:2px; margin-top:5px; overflow:hidden; border-radius:99px; background:rgba(110,120,113,.1); }
        .agent-live-status i::after { content:""; display:block; width:var(--live-progress); height:100%; background:#788db5; }
        .agent-live-status[data-tone="moving"] { border-color:rgba(108,137,157,.22); }
        .agent-live-status[data-tone="talking"] { border-color:rgba(137,119,153,.22); }
        .agent-live-status[data-tone="working"] { border-color:rgba(148,128,96,.22); }
        .agent-live-status[data-tone="done"],.agent-live-status[data-tone="transaction"] { border-color:rgba(103,143,117,.22); }
        .agent-live-status[data-tone="blocked"] { border-color:rgba(161,108,91,.25); }

        .places-directory-control {
          position:absolute;
          z-index:93;
          left:max(12px,env(safe-area-inset-left));
          top:max(58px,calc(env(safe-area-inset-top) + 58px));
          display:grid;
          gap:6px;
          justify-items:start;
          pointer-events:none;
        }
        .places-directory-button,.places-directory-panel { pointer-events:auto; }
        .places-directory-button {
          display:flex;
          align-items:center;
          gap:6px;
          min-height:32px;
          padding:0 9px;
          border:1px solid rgba(117,126,119,.12);
          border-radius:999px;
          background:rgba(248,247,241,.64);
          color:#68726b;
          box-shadow:0 6px 20px rgba(54,63,58,.05);
          backdrop-filter:blur(12px);
          opacity:.55;
          cursor:pointer;
        }
        .places-directory-button:hover,.places-directory-button:focus-visible { opacity:1; outline:none; }
        .places-directory-button svg { width:12px; height:12px; }
        .places-directory-button span { font-family:var(--pixel-font); font-size:.31rem; letter-spacing:.035em; }
        .places-directory-panel {
          width:min(338px,calc(100vw - 24px));
          max-height:min(560px,calc(100svh - 108px));
          overflow:hidden;
          padding:10px;
          border:1px solid rgba(113,124,116,.17);
          border-radius:16px;
          background:rgba(248,247,241,.95);
          box-shadow:0 16px 44px rgba(48,58,52,.11);
          backdrop-filter:blur(18px);
          color:#46504a;
        }
        .places-directory-tools { display:grid; grid-template-columns:1fr auto auto; gap:5px; }
        .places-search { display:flex; align-items:center; gap:5px; min-height:31px; padding:0 7px; border:1px solid rgba(112,121,114,.13); border-radius:9px; background:rgba(255,255,255,.23); }
        .places-search svg { width:11px; height:11px; color:#89918b; }
        .places-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:#5e6861; font-size:.42rem; }
        .places-select { min-height:31px; max-width:94px; border:1px solid rgba(112,121,114,.13); border-radius:9px; background:rgba(255,255,255,.23); color:#69736d; font-size:.38rem; outline:0; }
        .places-summary { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:8px 2px 5px; color:#858d87; font-family:var(--pixel-font); font-size:.3rem; }
        .places-list { display:grid; gap:4px; max-height:310px; overflow:auto; padding-right:2px; }
        .place-row { display:grid; grid-template-columns:23px minmax(0,1fr) auto; align-items:center; gap:7px; min-height:43px; padding:5px 6px; border:1px solid transparent; border-radius:10px; background:rgba(255,255,255,.15); cursor:pointer; }
        .place-row:hover,.place-row.is-selected { border-color:rgba(118,139,181,.18); background:rgba(118,139,181,.055); }
        .place-row-icon { display:grid; place-items:center; width:23px; height:23px; border-radius:50%; background:rgba(105,121,109,.06); color:#718078; }
        .place-row-icon svg { width:11px; height:11px; }
        .place-row-copy { display:grid; gap:2px; min-width:0; }
        .place-row-copy strong { overflow:hidden; font-size:.47rem; text-overflow:ellipsis; white-space:nowrap; }
        .place-row-copy small { overflow:hidden; color:#858d87; font-size:.34rem; text-overflow:ellipsis; white-space:nowrap; }
        .place-row-meta { display:grid; justify-items:end; gap:2px; font-family:var(--pixel-font); font-size:.27rem; color:#737d76; }
        .place-row-meta b { color:#697da7; }
        .place-detail { display:grid; gap:6px; margin-top:7px; padding:8px; border-top:1px solid rgba(112,120,114,.11); }
        .place-detail-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .place-detail-head span { display:grid; gap:2px; min-width:0; }
        .place-detail-head strong { font-size:.53rem; }
        .place-detail-head small { color:#858d87; font-size:.35rem; }
        .place-go { display:inline-flex; align-items:center; gap:4px; min-height:30px; padding:0 9px; border:1px solid rgba(118,139,181,.2); border-radius:9px; background:rgba(118,139,181,.07); color:#5c729e; font-family:var(--pixel-font); font-size:.3rem; cursor:pointer; }
        .place-go:disabled { opacity:.45; cursor:default; }
        .place-go svg { width:11px; height:11px; }
        .place-info-list { display:grid; gap:3px; max-height:128px; overflow:auto; }
        .place-info-line { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center; min-height:24px; padding:3px 5px; border-radius:7px; background:rgba(105,119,108,.045); font-size:.38rem; }
        .place-info-line span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .place-info-line span:last-child { color:#7b847e; font-family:var(--pixel-font); font-size:.28rem; }
        @media(max-width:620px){
          .places-directory-control { left:max(9px,env(safe-area-inset-left)); top:max(54px,calc(env(safe-area-inset-top) + 54px)); }
          .agent-live-status { width:156px; }
          .places-directory-panel { width:min(310px,calc(100vw - 18px)); max-height:58svh; }
          .places-directory-tools { grid-template-columns:1fr auto; }
          .places-directory-tools .places-select:last-child { grid-column:1 / -1; max-width:none; }
        }
        @media(prefers-reduced-motion:reduce){.places-directory-button{transition:none!important}}
      `}</style>

      {portraitHosts.map((host, index) => createPortal(
        <span className="shared-agent-animal-body" aria-hidden="true" />,
        host,
        "shared-user-animal-" + String(index),
      ))}

      {taskControl ? createPortal(
        <section
          className="agent-live-status"
          data-tone={status.tone}
          aria-live="polite"
          aria-label={status.label + ". " + status.detail}
          style={{ "--live-progress": String(status.progress) + "%" } as React.CSSProperties}
        >
          <header><Activity aria-hidden="true" /><strong>{status.label}</strong><b>{status.progress ? String(Math.round(status.progress)) + "%" : "LIVE"}</b></header>
          <small>{status.detail}</small>
          <i aria-hidden="true" />
        </section>,
        taskControl,
        "agent-live-status",
      ) : null}

      {createPortal(
        <div className="places-directory-control" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
          <button type="button" className="places-directory-button" aria-expanded={directoryOpen} onClick={() => setDirectoryOpen((value) => !value)}>
            <MapPin aria-hidden="true" />
            <span>Places · {places.length}</span>
            {directoryOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
          {directoryOpen ? (
            <section className="places-directory-panel" aria-label="All stores, facilities and community services">
              <div className="places-directory-tools">
                <label className="places-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places / services" aria-label="Search all places" /></label>
                <select className="places-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} aria-label="Filter place type">
                  <option value="all">All</option><option value="store">Stores</option><option value="service">Services</option><option value="community">Community</option><option value="facility">Facilities</option>
                </select>
                <select className="places-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sort places">
                  <option value="distance">Nearest</option><option value="point">Asympta Point</option><option value="availability">Availability</option><option value="name">Name</option><option value="type">Type</option>
                </select>
              </div>
              <div className="places-summary"><span>{visiblePlaces.length} visible</span><span><ArrowUpDown aria-hidden="true" style={{ width: 9, height: 9, verticalAlign: "middle" }} /> {sortMode}</span></div>
              <div className="places-list">
                {visiblePlaces.map((place) => {
                  const Icon = placeIcon(place);
                  const distance = Math.hypot(place.x - user.x, place.y - user.y);
                  const ratio = place.maxAvailability > 0 ? Math.round((place.availability / place.maxAvailability) * 100) : 100;
                  return (
                    <button type="button" className={"place-row" + (selectedId === place.id ? " is-selected" : "")} key={place.source + ":" + place.id} onClick={() => setSelectedId((current) => current === place.id ? null : place.id)}>
                      <i className="place-row-icon"><Icon aria-hidden="true" /></i>
                      <span className="place-row-copy"><strong>{place.name}</strong><small>{place.kind} · {sourceLabel(place.source)} · {Math.round(distance)}u</small></span>
                      <span className="place-row-meta"><b><Star aria-hidden="true" style={{ width: 8, height: 8, verticalAlign: "middle" }} /> {place.point} AP</b><span>{ratio}% avail{place.minPrice !== null ? " · ₡" + String(place.minPrice) : ""}</span></span>
                    </button>
                  );
                })}
              </div>
              {selected ? (
                <section className="place-detail">
                  <div className="place-detail-head">
                    <span><strong>{selected.name}</strong><small>{selected.summary ?? selected.kind + " · " + selected.point + " AP · " + selected.availability + " available"}</small></span>
                    <button type="button" className="place-go" disabled={Boolean(goingId)} onClick={() => void goTo(selected)}><Navigation aria-hidden="true" />{goingId === selected.id ? "GOING" : "GO"}</button>
                  </div>
                  <div className="place-info-list">
                    {selected.info.length ? selected.info.slice(0, 12).map((item) => (
                      <div className="place-info-line" key={item.type + ":" + item.id}><span>{item.name}</span><span>{item.type} · {item.available}{item.price ? " · ₡" + String(item.price) : " · free"}</span></div>
                    )) : <div className="place-info-line"><span>No detailed catalog yet</span><span>—</span></div>}
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}
        </div>,
        viewport,
        "places-directory-control",
      )}
    </>
  );
}

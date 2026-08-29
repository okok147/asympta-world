"use client";

import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Globe2,
  HeartPulse,
  LocateFixed,
  Menu,
  Minus,
  Package,
  PlayCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnimalPortrait, animalSvgMarkup } from "@/components/asympta-animal-art";
import {
  ATLAS_AGENTS,
  ATLAS_LOCATIONS,
  ATLAS_WORKFLOWS,
  advanceAtlasWorld,
  atlasSnapshot,
  requestWebMcpAction,
  requestWebMcpWorkflow,
  workflowFor,
  type AtlasWorldState,
  type ExternalAction,
  type StakeholderSide,
  type WorkflowId,
} from "@/lib/atlas-simulation";
import {
  CITY_LIFE_COUNT,
  cityLifeSnapshot,
  createAtlasDemoWorld,
  demoDisclosure,
  resolveAtlasDemoApproval,
  startAtlasDemoWorkflow,
  type CityLifeActor,
} from "@/lib/atlas-demo";

type Locale = "en" | "zh-Hant" | "ja";
type GeoJsonFeatureCollection = { type: "FeatureCollection"; features: Array<Record<string, unknown>> };
type GeoJsonSource = { setData(data: GeoJsonFeatureCollection): void };

type MapLibreMap = {
  on(event: string, handler: () => void): void;
  addSource(id: string, source: { type: "geojson"; data: GeoJsonFeatureCollection }): void;
  addLayer(layer: Record<string, unknown>): void;
  getSource(id: string): GeoJsonSource | undefined;
  flyTo(options: Record<string, unknown>): void;
  easeTo(options: Record<string, unknown>): void;
  zoomIn(options?: Record<string, unknown>): void;
  zoomOut(options?: Record<string, unknown>): void;
  remove(): void;
  touchZoomRotate: { enable(): void; disableRotation(): void };
  dragRotate: { disable(): void };
  touchPitch?: { disable(): void };
};

type MapLibreMarker = {
  setLngLat(coordinates: [number, number]): MapLibreMarker;
  addTo(map: MapLibreMap): MapLibreMarker;
  getElement(): HTMLElement;
  remove(): void;
};

type MapLibreNamespace = {
  Map: new (options: Record<string, unknown>) => MapLibreMap;
  Marker: new (options: { element: HTMLElement; anchor?: "center" }) => MapLibreMarker;
};

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

declare global {
  interface Window {
    maplibregl?: MapLibreNamespace;
    __ASYMPTA_DEMO__?: {
      snapshot: () => unknown;
      startWorkflow: (workflowId: WorkflowId) => unknown;
      advance: (milliseconds: number) => unknown;
      approve: (approvalId: string, approved: boolean) => unknown;
    };
  }
}

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css";
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const TOKYO_CENTER: [number, number] = [139.7544, 35.6762];
const TOKYO_ZOOM = 12.2;

// Keep simulation, map-source work, ambient movement and React UI on different clocks.
const SIMULATION_STEP_MS = 70;
const AMBIENT_REFRESH_MS = 110;
const MAP_SOURCE_REFRESH_MS = 210;
const UI_REFRESH_MS = 260;
const CAMERA_REFRESH_MS = 150;

const ACTIONS: ExternalAction[] = ["reserve_capacity", "authorize_payment", "release_shipment", "send_customer_update"];

const SIDE_COLORS: Record<StakeholderSide, string> = {
  user: "#4B7FA6",
  customer: "#6D8EB6",
  business: "#C56F4A",
  supplier: "#698B5D",
  operations: "#9B7A45",
  finance: "#806B9C",
  logistics: "#B05E72",
  support: "#4E8E89",
  quality: "#8B7559",
  market: "#A06D93",
};

const SIDE_LABELS: Record<StakeholderSide, string> = {
  user: "User",
  customer: "Customer",
  business: "Business",
  supplier: "Supplier",
  operations: "Operations",
  finance: "Finance",
  logistics: "Logistics",
  support: "Support",
  quality: "Quality",
  market: "Market",
};

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    livingCity: "Living city",
    ready: "Ready",
    coordinating: "Coordinating",
    waiting: "Waiting for you",
    completed: "Completed",
    blocked: "Blocked",
    webmcpReady: "WebMCP ready",
    webmcpChecking: "Checking WebMCP",
    webmcpUnavailable: "WebMCP browser API unavailable",
    demoCity: "Demo city",
    actorsMoving: "actors moving",
    workflowAgents: "workflow agents moving",
    webmcpActions: "WebMCP actions",
    cameraFollow: "Camera follow",
    following: "Following",
    followAgent: "Follow active agent",
    restart: "Restart",
    restartDemo: "Restart demo",
    language: "Language",
    humanCheckpoint: "HUMAN CHECKPOINT",
    webmcpRequest: "WEBMCP REQUEST",
    decline: "Decline",
    allow: "Allow simulated action",
    reserve: "Reserve capacity",
    payment: "Authorise payment",
    shipment: "Release shipment",
    customerUpdate: "Customer update",
    selectedAgent: "Selected agent",
    standingBy: "Standing by",
    drawing: "Drawing the living street atlas…",
    menu: "Open coordination menu",
    closeMenu: "Collapse coordination menu",
  },
  "zh-Hant": {
    livingCity: "協作城市",
    ready: "就緒",
    coordinating: "協作中",
    waiting: "等候確認",
    completed: "已完成",
    blocked: "已暫停",
    webmcpReady: "WebMCP 已就緒",
    webmcpChecking: "正在檢查 WebMCP",
    webmcpUnavailable: "此瀏覽器未提供 WebMCP API",
    demoCity: "示範城市",
    actorsMoving: "個角色移動中",
    workflowAgents: "個工作流角色移動中",
    webmcpActions: "WebMCP 動作",
    cameraFollow: "鏡頭跟隨",
    following: "正在跟隨",
    followAgent: "跟隨活動角色",
    restart: "重新開始",
    restartDemo: "重新開始示範",
    language: "語言",
    humanCheckpoint: "人工確認",
    webmcpRequest: "WEBMCP 請求",
    decline: "拒絕",
    allow: "允許模擬動作",
    reserve: "預留產能",
    payment: "授權付款",
    shipment: "放行出貨",
    customerUpdate: "客戶更新",
    selectedAgent: "已選角色",
    standingBy: "待命中",
    drawing: "正在繪製城市地圖…",
    menu: "開啟協作選單",
    closeMenu: "收起協作選單",
  },
  ja: {
    livingCity: "協調都市",
    ready: "準備完了",
    coordinating: "連携中",
    waiting: "確認待ち",
    completed: "完了",
    blocked: "停止中",
    webmcpReady: "WebMCP 準備完了",
    webmcpChecking: "WebMCP を確認中",
    webmcpUnavailable: "このブラウザでは WebMCP API を利用できません",
    demoCity: "デモ都市",
    actorsMoving: "アクター移動中",
    workflowAgents: "ワークフローエージェント移動中",
    webmcpActions: "WebMCP アクション",
    cameraFollow: "カメラ追従",
    following: "追従中",
    followAgent: "活動中のエージェントを追従",
    restart: "再開",
    restartDemo: "デモを再開",
    language: "言語",
    humanCheckpoint: "人による確認",
    webmcpRequest: "WEBMCP リクエスト",
    decline: "拒否",
    allow: "シミュレーションを許可",
    reserve: "容量を予約",
    payment: "支払いを承認",
    shipment: "出荷を解放",
    customerUpdate: "顧客更新",
    selectedAgent: "選択中のエージェント",
    standingBy: "待機中",
    drawing: "都市マップを描画中…",
    menu: "協調メニューを開く",
    closeMenu: "協調メニューを閉じる",
  },
};

const WORKFLOW_COPY: Record<Locale, Record<WorkflowId, { label: string; subtitle: string; name: string }>> = {
  en: {
    "custom-order": { label: "Order", subtitle: "Intent", name: "Custom Order Network" },
    "dinner-network": { label: "Dinner", subtitle: "Request", name: "Dinner Coordination" },
    "launch-stock": { label: "Launch", subtitle: "Plan", name: "Launch Stock Orchestration" },
    "service-recovery": { label: "Recovery", subtitle: "Service", name: "Service Recovery Network" },
  },
  "zh-Hant": {
    "custom-order": { label: "訂單", subtitle: "需求", name: "客製訂單協作" },
    "dinner-network": { label: "晚餐", subtitle: "請求", name: "晚餐協作" },
    "launch-stock": { label: "上架", subtitle: "規劃", name: "上架庫存協作" },
    "service-recovery": { label: "復原", subtitle: "服務", name: "服務復原協作" },
  },
  ja: {
    "custom-order": { label: "注文", subtitle: "要望", name: "カスタム注文連携" },
    "dinner-network": { label: "夕食", subtitle: "依頼", name: "夕食コーディネーション" },
    "launch-stock": { label: "発売", subtitle: "計画", name: "在庫ローンチ連携" },
    "service-recovery": { label: "復旧", subtitle: "対応", name: "サービス復旧連携" },
  },
};

const ACTION_OWNER: Record<ExternalAction, string> = {
  reserve_capacity: "agent-supplier",
  authorize_payment: "agent-finance",
  release_shipment: "agent-logistics",
  send_customer_update: "agent-support",
};

let mapLibrePromise: Promise<MapLibreNamespace> | null = null;

function ensureMapLibreCss() {
  if (document.querySelector("link[data-asympta-maplibre='true']")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = MAPLIBRE_CSS;
  link.dataset.asymptaMaplibre = "true";
  document.head.appendChild(link);
}

function loadMapLibre(): Promise<MapLibreNamespace> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mapLibrePromise) return mapLibrePromise;
  ensureMapLibreCss();
  mapLibrePromise = new Promise<MapLibreNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-asympta-maplibre='true']");
    const finish = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("MapLibre loaded without a map object."));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Map engine failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.dataset.asymptaMaplibre = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Map engine failed to load.")), { once: true });
    document.head.appendChild(script);
  });
  return mapLibrePromise;
}

function workflowIcon(id: WorkflowId) {
  if (id === "custom-order") return <ShoppingCart size={17} strokeWidth={1.7} />;
  if (id === "dinner-network") return <Utensils size={17} strokeWidth={1.7} />;
  if (id === "launch-stock") return <Package size={17} strokeWidth={1.7} />;
  return <HeartPulse size={17} strokeWidth={1.7} />;
}

function phaseCopy(locale: Locale, world: AtlasWorldState) {
  const copy = COPY[locale];
  if (world.phase === "running") return copy.coordinating;
  if (world.phase === "waiting_approval") return copy.waiting;
  if (world.phase === "completed") return copy.completed;
  if (world.phase === "blocked") return copy.blocked;
  return copy.ready;
}

function statusCopy(locale: Locale, status: string) {
  const zh: Record<string, string> = { idle: "待命", moving: "移動中", working: "工作中", sharing: "交接中", waiting: "等候中", returning: "返回中" };
  const ja: Record<string, string> = { idle: "待機", moving: "移動中", working: "作業中", sharing: "共有中", waiting: "待機中", returning: "帰還中" };
  if (locale === "zh-Hant") return zh[status] ?? status;
  if (locale === "ja") return ja[status] ?? status;
  return status.replaceAll("_", " ");
}

function sideColorExpression() {
  return ["match", ["get", "side"], ...Object.entries(SIDE_COLORS).flatMap(([side, color]) => [side, color]), "#5F5C55"];
}

function activeAgentGeoJson(world: AtlasWorldState): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: world.agents.map((agent) => ({
      type: "Feature",
      properties: { id: agent.id, name: agent.name, role: agent.role, side: agent.side, status: agent.status },
      geometry: { type: "Point", coordinates: [agent.position.lon, agent.position.lat] },
    })),
  };
}

function activeRouteGeoJson(world: AtlasWorldState): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: world.tasks.filter((task) => task.status === "moving").flatMap((task) => {
      const agent = world.agents.find((candidate) => candidate.id === task.agentId);
      const destination = ATLAS_LOCATIONS[task.locationId];
      if (!agent || !destination) return [];
      return [{
        type: "Feature",
        properties: { agentId: agent.id, side: agent.side, taskId: task.id },
        geometry: { type: "LineString", coordinates: [[agent.position.lon, agent.position.lat], [destination.point.lon, destination.point.lat]] },
      }];
    }),
  };
}

function messageGeoJson(world: AtlasWorldState): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: world.messages.flatMap((message) => {
      const from = world.agents.find((agent) => agent.id === message.fromAgentId);
      const to = world.agents.find((agent) => agent.id === message.toAgentId);
      if (!from || !to) return [];
      return [{
        type: "Feature",
        properties: { side: from.side, messageId: message.id },
        geometry: { type: "LineString", coordinates: [[from.position.lon, from.position.lat], [to.position.lon, to.position.lat]] },
      }];
    }),
  };
}

function cityAgentGeoJson(actors: CityLifeActor[]): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: actors.map((actor) => ({
      type: "Feature",
      properties: { id: actor.id, name: actor.name, side: actor.side, status: actor.status, task: actor.task, demo: 1 },
      geometry: { type: "Point", coordinates: [actor.position.lon, actor.position.lat] },
    })),
  };
}

function cityRouteGeoJson(actors: CityLifeActor[]): GeoJsonFeatureCollection {
  const routeSides = new Set<StakeholderSide>(["business", "supplier", "logistics", "operations"]);
  return {
    type: "FeatureCollection",
    features: actors.filter((actor) => actor.status === "moving" && routeSides.has(actor.side)).map((actor) => ({
      type: "Feature",
      properties: { id: actor.id, side: actor.side },
      geometry: { type: "LineString", coordinates: [[actor.position.lon, actor.position.lat], [actor.next.lon, actor.next.lat]] },
    })),
  };
}

function addMapLayers(map: MapLibreMap, world: AtlasWorldState) {
  const city = cityLifeSnapshot(world.now);
  map.addSource("city-life-routes", { type: "geojson", data: cityRouteGeoJson(city) });
  map.addSource("city-life-agents", { type: "geojson", data: cityAgentGeoJson(city) });
  map.addSource("atlas-routes", { type: "geojson", data: activeRouteGeoJson(world) });
  map.addSource("atlas-messages", { type: "geojson", data: messageGeoJson(world) });
  map.addSource("atlas-agents", { type: "geojson", data: activeAgentGeoJson(world) });

  map.addLayer({ id: "city-life-routes", type: "line", source: "city-life-routes", paint: { "line-color": sideColorExpression(), "line-width": 1, "line-opacity": 0.17, "line-dasharray": [1.1, 2.8] } });
  map.addLayer({
    id: "city-life-labels",
    type: "symbol",
    source: "city-life-agents",
    minzoom: 14.2,
    layout: { "text-field": ["get", "name"], "text-size": 8.5, "text-offset": [0, 2.15], "text-anchor": "top", "text-allow-overlap": false },
    paint: { "text-color": "rgba(55,52,47,0.52)", "text-halo-color": "rgba(247,243,233,0.9)", "text-halo-width": 1.6 },
  });
  map.addLayer({ id: "atlas-route-shadow", type: "line", source: "atlas-routes", paint: { "line-color": "rgba(247,243,233,0.94)", "line-width": 5, "line-opacity": 0.72 } });
  map.addLayer({ id: "atlas-routes", type: "line", source: "atlas-routes", paint: { "line-color": sideColorExpression(), "line-width": 2.05, "line-opacity": 0.74, "line-dasharray": [1.6, 2.2] } });
  map.addLayer({ id: "atlas-messages", type: "line", source: "atlas-messages", paint: { "line-color": sideColorExpression(), "line-width": 1.2, "line-opacity": 0.4, "line-dasharray": [0.7, 1.8] } });
  map.addLayer({
    id: "atlas-agent-labels",
    type: "symbol",
    source: "atlas-agents",
    minzoom: 13.1,
    layout: { "text-field": ["get", "name"], "text-size": 10, "text-offset": [0, 2.35], "text-anchor": "top", "text-allow-overlap": false },
    paint: { "text-color": "#33312D", "text-halo-color": "rgba(247,243,233,0.96)", "text-halo-width": 1.8 },
  });
}

function syncMapSources(map: MapLibreMap, world: AtlasWorldState) {
  const city = cityLifeSnapshot(world.now);
  map.getSource("city-life-agents")?.setData(cityAgentGeoJson(city));
  map.getSource("city-life-routes")?.setData(cityRouteGeoJson(city));
  map.getSource("atlas-agents")?.setData(activeAgentGeoJson(world));
  map.getSource("atlas-routes")?.setData(activeRouteGeoJson(world));
  map.getSource("atlas-messages")?.setData(messageGeoJson(world));
}

function createAnimalMarkerElement(id: string, side: StakeholderSide, label: string, ambient: boolean, onSelect?: () => void) {
  const element = onSelect ? document.createElement("button") : document.createElement("div");
  if (element instanceof HTMLButtonElement) element.type = "button";
  element.className = `animal-map-marker ${ambient ? "animal-map-marker--ambient" : "animal-map-marker--foreground"}`;
  element.dataset.agentId = id;
  element.dataset.side = side;
  element.style.setProperty("--agent-color", SIDE_COLORS[side]);
  element.title = label;
  if (ambient) element.setAttribute("aria-hidden", "true");
  else element.setAttribute("aria-label", label);

  const face = document.createElement("span");
  face.className = "animal-map-marker__face";
  face.innerHTML = animalSvgMarkup(id, side);
  element.appendChild(face);

  const status = document.createElement("span");
  status.className = "animal-map-marker__status";
  element.appendChild(status);

  if (onSelect) element.addEventListener("click", (event) => { event.stopPropagation(); onSelect(); });
  return element;
}

export function AsymptaWorldLiveDemo() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const foregroundMarkersRef = useRef(new Map<string, MapLibreMarker>());
  const cityMarkersRef = useRef(new Map<string, MapLibreMarker>());
  const [world, setWorld] = useState<AtlasWorldState>(() => createAtlasDemoWorld());
  const worldRef = useRef(world);
  const selectedAgentIdRef = useRef<string | null>(null);
  const cameraFollowRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [webMcpState, setWebMcpState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [cameraFollow, setCameraFollow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [webMcpMenuOpen, setWebMcpMenuOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");

  const copy = COPY[locale];

  useEffect(() => { selectedAgentIdRef.current = selectedAgentId; }, [selectedAgentId]);
  useEffect(() => { cameraFollowRef.current = cameraFollow; }, [cameraFollow]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setSelectedAndFollow = useCallback((agentId: string | null, follow: boolean) => {
    selectedAgentIdRef.current = agentId;
    cameraFollowRef.current = follow;
    setSelectedAgentId(agentId);
    setCameraFollow(follow);
  }, []);

  const syncForegroundMarkers = useCallback((current: AtlasWorldState, selectedId: string | null, force = false) => {
    for (const agent of current.agents) {
      const marker = foregroundMarkersRef.current.get(agent.id);
      if (!marker) continue;
      if (force || agent.status === "moving" || agent.status === "returning") marker.setLngLat([agent.position.lon, agent.position.lat]);
      const element = marker.getElement();
      if (element.dataset.status !== agent.status) {
        element.dataset.status = agent.status;
        element.classList.toggle("is-moving", agent.status === "moving" || agent.status === "returning");
        element.classList.toggle("is-working", agent.status === "working" || agent.status === "sharing");
      }
      const selected = agent.id === selectedId;
      if (element.dataset.selected !== String(selected)) {
        element.dataset.selected = String(selected);
        element.classList.toggle("is-selected", selected);
      }
      const task = current.tasks.find((candidate) => candidate.agentId === agent.id && ["moving", "working", "waiting_approval"].includes(candidate.status));
      const taskTitle = task?.title ?? "";
      if (element.dataset.task !== taskTitle) {
        element.dataset.task = taskTitle;
        element.title = `${agent.name} · ${agent.role}${taskTitle ? ` · ${taskTitle}` : ""}`;
      }
    }
  }, []);

  const syncCityMarkers = useCallback((now: number, force = false) => {
    for (const actor of cityLifeSnapshot(now)) {
      const marker = cityMarkersRef.current.get(actor.id);
      if (!marker) continue;
      if (force || actor.status === "moving") marker.setLngLat([actor.position.lon, actor.position.lat]);
      const element = marker.getElement();
      if (element.dataset.status !== actor.status) {
        element.dataset.status = actor.status;
        element.classList.toggle("is-moving", actor.status === "moving");
        element.classList.toggle("is-working", actor.status === "working");
      }
      if (element.dataset.task !== actor.task) {
        element.dataset.task = actor.task;
        element.title = `${actor.name} · ${actor.role} · ${actor.task} · synthetic demo actor`;
      }
    }
  }, []);

  const applyImmediate = useCallback((change: (current: AtlasWorldState) => AtlasWorldState) => {
    const next = change(worldRef.current);
    worldRef.current = next;
    setWorld(next);
    syncForegroundMarkers(next, selectedAgentIdRef.current, true);
    syncCityMarkers(next.now, true);
    if (mapRef.current) syncMapSources(mapRef.current, next);
    return next;
  }, [syncCityMarkers, syncForegroundMarkers]);

  const startWorkflow = useCallback((workflowId: WorkflowId) => {
    const next = applyImmediate((current) => startAtlasDemoWorkflow(current, workflowId));
    const firstMoving = next.agents.find((agent) => agent.status === "moving") ?? null;
    setSelectedAndFollow(firstMoving?.id ?? null, false);
    setWebMcpMenuOpen(false);
    return next;
  }, [applyImmediate, setSelectedAndFollow]);

  const resolveApproval = useCallback((approvalId: string, approved: boolean) => {
    const next = applyImmediate((current) => resolveAtlasDemoApproval(current, approvalId, approved));
    if (approved) {
      const moving = next.agents.find((agent) => agent.status === "moving");
      if (moving) setSelectedAndFollow(moving.id, true);
    }
    return next;
  }, [applyImmediate, setSelectedAndFollow]);

  const queueWebMcpDemoAction = useCallback((action: ExternalAction) => {
    const agentId = ACTION_OWNER[action];
    const next = applyImmediate((current) => requestWebMcpAction(current, action, agentId, "Requested from the Asympta World WebMCP demonstration menu."));
    setSelectedAndFollow(agentId, true);
    setWebMcpMenuOpen(false);
    return next;
  }, [applyImmediate, setSelectedAndFollow]);

  const toggleCameraFollow = useCallback(() => {
    if (cameraFollowRef.current) {
      setSelectedAndFollow(selectedAgentIdRef.current, false);
      return;
    }
    const candidate = worldRef.current.agents.find((agent) => agent.id === selectedAgentIdRef.current)
      ?? worldRef.current.agents.find((agent) => agent.status === "moving")
      ?? worldRef.current.agents.find((agent) => agent.status !== "idle")
      ?? worldRef.current.agents[0];
    if (candidate) setSelectedAndFollow(candidate.id, true);
  }, [setSelectedAndFollow]);

  const mountAnimalMarkers = useCallback((maplibre: MapLibreNamespace, map: MapLibreMap, current: AtlasWorldState) => {
    for (const agent of current.agents) {
      const element = createAnimalMarkerElement(agent.id, agent.side, `${agent.name} · ${SIDE_LABELS[agent.side]} · ${agent.role}`, false, () => setSelectedAndFollow(agent.id, true));
      const marker = new maplibre.Marker({ element, anchor: "center" }).setLngLat([agent.position.lon, agent.position.lat]).addTo(map);
      foregroundMarkersRef.current.set(agent.id, marker);
    }
    for (const actor of cityLifeSnapshot(current.now)) {
      const element = createAnimalMarkerElement(actor.id, actor.side, `${actor.name} · ${actor.role} · ${actor.task} · synthetic demo actor`, true);
      const marker = new maplibre.Marker({ element, anchor: "center" }).setLngLat([actor.position.lon, actor.position.lat]).addTo(map);
      cityMarkersRef.current.set(actor.id, marker);
    }
  }, [setSelectedAndFollow]);

  useEffect(() => {
    let disposed = false;
    loadMapLibre()
      .then((maplibre) => {
        if (disposed || !mapContainerRef.current) return;
        const map = new maplibre.Map({
          container: mapContainerRef.current,
          style: OPENFREEMAP_STYLE,
          center: TOKYO_CENTER,
          zoom: TOKYO_ZOOM,
          minZoom: 3,
          maxZoom: 20,
          attributionControl: true,
          pitchWithRotate: false,
          dragRotate: false,
          touchPitch: false,
          cooperativeGestures: false,
          fadeDuration: 0,
        });
        mapRef.current = map;
        map.dragRotate.disable();
        map.touchPitch?.disable();
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
        const stopFollow = () => {
          if (!cameraFollowRef.current) return;
          cameraFollowRef.current = false;
          setCameraFollow(false);
        };
        map.on("dragstart", stopFollow);
        map.on("zoomstart", stopFollow);
        map.on("load", () => {
          if (disposed) return;
          addMapLayers(map, worldRef.current);
          mountAnimalMarkers(maplibre, map, worldRef.current);
          syncMapSources(map, worldRef.current);
          syncForegroundMarkers(worldRef.current, selectedAgentIdRef.current, true);
          syncCityMarkers(worldRef.current.now, true);
          setMapReady(true);
        });
      })
      .catch((reason: unknown) => { if (!disposed) setMapError(reason instanceof Error ? reason.message : "The map could not be loaded."); });
    return () => {
      disposed = true;
      for (const marker of foregroundMarkersRef.current.values()) marker.remove();
      for (const marker of cityMarkersRef.current.values()) marker.remove();
      foregroundMarkersRef.current.clear();
      cityMarkersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mountAnimalMarkers, syncCityMarkers, syncForegroundMarkers]);

  // High-frequency visual work stays imperative. React is refreshed only a few times per second.
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let simulationAccumulator = 0;
    let ambientAccumulator = 0;
    let sourceAccumulator = 0;
    let uiAccumulator = 0;
    let cameraAccumulator = 0;

    const animate = (now: number) => {
      const elapsed = Math.min(140, Math.max(0, now - previous));
      previous = now;
      if (document.hidden) {
        frame = window.requestAnimationFrame(animate);
        return;
      }

      simulationAccumulator += elapsed;
      ambientAccumulator += elapsed;
      sourceAccumulator += elapsed;
      uiAccumulator += elapsed;
      cameraAccumulator += elapsed;

      if (simulationAccumulator >= SIMULATION_STEP_MS) {
        worldRef.current = advanceAtlasWorld(worldRef.current, simulationAccumulator);
        simulationAccumulator = 0;
        syncForegroundMarkers(worldRef.current, selectedAgentIdRef.current);
      }

      if (ambientAccumulator >= AMBIENT_REFRESH_MS) {
        ambientAccumulator = 0;
        syncCityMarkers(worldRef.current.now);
      }

      if (sourceAccumulator >= MAP_SOURCE_REFRESH_MS && mapRef.current) {
        sourceAccumulator = 0;
        syncMapSources(mapRef.current, worldRef.current);
      }

      if (cameraAccumulator >= CAMERA_REFRESH_MS && cameraFollowRef.current && selectedAgentIdRef.current && mapRef.current) {
        cameraAccumulator = 0;
        const agent = worldRef.current.agents.find((candidate) => candidate.id === selectedAgentIdRef.current);
        if (agent) mapRef.current.easeTo({ center: [agent.position.lon, agent.position.lat], duration: 170, essential: true });
      }

      if (uiAccumulator >= UI_REFRESH_MS) {
        uiAccumulator = 0;
        setWorld(worldRef.current);
      }

      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [syncCityMarkers, syncForegroundMarkers]);

  useEffect(() => {
    const controller = new AbortController();
    const modelContext = document.modelContext;
    if (!modelContext) {
      queueMicrotask(() => { if (!controller.signal.aborted) setWebMcpState("unavailable"); });
      return () => controller.abort();
    }

    const workflowIds = ATLAS_WORKFLOWS.map((workflow) => workflow.id);
    const agentIds = ATLAS_AGENTS.map((agent) => agent.id);
    const readOnly = { readOnlyHint: true, untrustedContentHint: false };
    const mutating = { readOnlyHint: false, untrustedContentHint: true };
    const tools: WebMcpTool[] = [
      {
        name: "asympta_observe_living_city",
        title: "Observe Asympta living city",
        description: "Read the foreground workflow plus synthetic background user, business, supplier and logistics agents moving around the demonstration city.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => JSON.stringify({ ok: true, foreground: atlasSnapshot(worldRef.current), ambient: cityLifeSnapshot(worldRef.current.now).slice(0, 16), disclosure: demoDisclosure() }),
      },
      {
        name: "asympta_list_workflows",
        title: "List coordination workflows",
        description: "List the available multi-stakeholder demonstration workflows.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => JSON.stringify({ ok: true, workflows: ATLAS_WORKFLOWS.map((workflow) => ({ id: workflow.id, name: workflow.name, summary: workflow.summary })) }),
      },
      {
        name: "asympta_request_workflow",
        title: "Request a coordination workflow",
        description: "Request a workflow. WebMCP cannot start it directly: the user must approve the visible request first.",
        inputSchema: { type: "object", properties: { workflowId: { type: "string", enum: workflowIds } }, required: ["workflowId"], additionalProperties: false },
        annotations: mutating,
        execute: async (input) => {
          const workflowId = String(input.workflowId ?? "") as WorkflowId;
          if (!workflowIds.includes(workflowId)) return JSON.stringify({ ok: false, error: "Unknown workflow." });
          const next = applyImmediate((current) => requestWebMcpWorkflow(current, workflowId));
          const approval = [...next.approvals].reverse().find((item) => item.kind === "webmcp-start" && item.workflowId === workflowId && item.status === "pending");
          return JSON.stringify({ ok: true, queuedForHumanApproval: true, approvalId: approval?.id ?? null });
        },
      },
      {
        name: "asympta_request_external_action",
        title: "Request a consequential action",
        description: "Request capacity, payment, shipment or customer-update simulation. It always waits for explicit user approval before the demo advances.",
        inputSchema: { type: "object", properties: { action: { type: "string", enum: ACTIONS }, agentId: { type: "string", enum: agentIds }, reason: { type: "string", minLength: 3, maxLength: 220 } }, required: ["action", "agentId", "reason"], additionalProperties: false },
        annotations: mutating,
        execute: async (input) => {
          const action = String(input.action ?? "") as ExternalAction;
          const agentId = String(input.agentId ?? "");
          const reason = String(input.reason ?? "").trim();
          if (!ACTIONS.includes(action) || !agentIds.includes(agentId) || reason.length < 3) return JSON.stringify({ ok: false, error: "Invalid action request." });
          const next = applyImmediate((current) => requestWebMcpAction(current, action, agentId, reason));
          const approval = [...next.approvals].reverse().find((item) => item.status === "pending" && item.actionType === action);
          return JSON.stringify({ ok: true, queuedForHumanApproval: true, approvalId: approval?.id ?? null });
        },
      },
      {
        name: "asympta_follow_agent",
        title: "Follow an active agent",
        description: "Track a foreground workflow agent with the map camera. This changes only the local visual camera.",
        inputSchema: { type: "object", properties: { agentId: { type: "string", enum: agentIds } }, required: ["agentId"], additionalProperties: false },
        annotations: readOnly,
        execute: async (input) => {
          const agentId = String(input.agentId ?? "");
          if (!agentIds.includes(agentId)) return JSON.stringify({ ok: false, error: "Unknown agent." });
          setSelectedAndFollow(agentId, true);
          return JSON.stringify({ ok: true, following: agentId });
        },
      },
    ];

    Promise.all(tools.map((tool) => Promise.resolve().then(() => modelContext.registerTool(tool, { signal: controller.signal }))))
      .then(() => setWebMcpState("ready"))
      .catch(() => setWebMcpState("unavailable"));
    return () => controller.abort();
  }, [applyImmediate, setSelectedAndFollow]);

  useEffect(() => {
    window.__ASYMPTA_DEMO__ = {
      snapshot: () => ({ foreground: atlasSnapshot(worldRef.current), ambient: cityLifeSnapshot(worldRef.current.now), disclosure: demoDisclosure() }),
      startWorkflow: (workflowId) => atlasSnapshot(startWorkflow(workflowId)),
      advance: (milliseconds) => {
        const next = applyImmediate((current) => advanceAtlasWorld(current, milliseconds));
        return atlasSnapshot(next);
      },
      approve: (approvalId, approved) => atlasSnapshot(resolveApproval(approvalId, approved)),
    };
    return () => { delete window.__ASYMPTA_DEMO__; };
  }, [applyImmediate, resolveApproval, startWorkflow]);

  const pendingApproval = world.approvals.find((approval) => approval.status === "pending") ?? null;
  const selectedAgent = world.agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const selectedTask = selectedAgent ? world.tasks.find((task) => task.agentId === selectedAgent.id && ["moving", "working", "waiting_approval"].includes(task.status)) : undefined;
  const approvalAgent = pendingApproval?.agentId ? world.agents.find((agent) => agent.id === pendingApproval.agentId) : null;
  const completedTasks = world.tasks.filter((task) => task.status === "done").length;
  const progress = world.tasks.length ? completedTasks / world.tasks.length : 0;
  const activeWorkflow = world.workflowId ? workflowFor(world.workflowId) : null;
  const movingForeground = world.agents.filter((agent) => agent.status === "moving").length;
  const ambient = cityLifeSnapshot(world.now);
  const movingAmbient = ambient.filter((actor) => actor.status === "moving").length;
  const activeWorkflowCopy = world.workflowId ? WORKFLOW_COPY[locale][world.workflowId] : null;
  const phaseAgent = selectedAgent ?? world.agents.find((agent) => agent.status === "moving") ?? world.agents[0];

  const recenter = () => {
    setSelectedAndFollow(selectedAgentIdRef.current, false);
    mapRef.current?.flyTo({ center: TOKYO_CENTER, zoom: TOKYO_ZOOM, bearing: 0, pitch: 0, duration: 520, essential: true });
  };

  return (
    <main className="map-app" data-map-app="true" data-map-style="paper-illustrated-animal-living-city-demo" data-render-mode="imperative-map-loop">
      <div ref={mapContainerRef} className="map-canvas" role="application" aria-label="Interactive paper map with illustrated animal stakeholder agents and simulated city activity" />
      <div className="map-paper-wash" aria-hidden="true" />
      <div className="map-paper-grain" aria-hidden="true" />

      <section className={`atlas-console ${menuOpen ? "is-open" : "is-collapsed"}`} aria-label="Coordination menu">
        <div className="atlas-menu-bar">
          <button type="button" className="atlas-menu-identity" aria-expanded={menuOpen} aria-label={menuOpen ? copy.closeMenu : copy.menu} onClick={() => { setMenuOpen((value) => !value); setWebMcpMenuOpen(false); }}>
            <span className="atlas-menu-icon"><Menu size={17} strokeWidth={1.7} /></span>
            <span className="atlas-menu-copy">
              <small>ASYMPTA WORLD</small>
              <strong>{activeWorkflowCopy?.name ?? copy.livingCity}</strong>
            </span>
            <span className={`atlas-mini-phase atlas-mini-phase--${world.phase}`}><i />{phaseCopy(locale, world)}</span>
          </button>

          <button type="button" className={`atlas-quick-icon${languageOpen ? " is-active" : ""}`} aria-label={copy.language} aria-expanded={languageOpen} onClick={() => { setLanguageOpen((value) => !value); setWebMcpMenuOpen(false); }}>
            <Globe2 size={17} strokeWidth={1.7} />
          </button>
          <button type="button" className="atlas-quick-icon" aria-label={menuOpen ? copy.closeMenu : copy.menu} onClick={() => { setMenuOpen((value) => !value); setWebMcpMenuOpen(false); }}>
            {menuOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        </div>

        <div className={`atlas-language-menu${languageOpen ? " is-open" : ""}`} aria-hidden={!languageOpen}>
          {(["en", "zh-Hant", "ja"] as Locale[]).map((language) => (
            <button key={language} type="button" className={locale === language ? "is-active" : ""} onClick={() => { setLocale(language); setLanguageOpen(false); }}>
              <span>{language === "en" ? "English" : language === "zh-Hant" ? "繁體中文" : "日本語"}</span>
              {locale === language ? <i /> : null}
            </button>
          ))}
        </div>

        <div className="atlas-menu-panel" aria-hidden={!menuOpen}>
          <div className="atlas-status-stack">
            <div className="atlas-tool-state"><span className={`atlas-tool-dot atlas-tool-dot--${webMcpState}`} />{webMcpState === "ready" ? copy.webmcpReady : webMcpState === "checking" ? copy.webmcpChecking : copy.webmcpUnavailable}</div>
            <div className="atlas-tool-state"><span className="atlas-tool-dot atlas-tool-dot--ready" />{copy.demoCity} · {movingAmbient}/{CITY_LIFE_COUNT} {copy.actorsMoving} · {movingForeground} {copy.workflowAgents}</div>
          </div>

          <div className="atlas-tool-actions">
            <button type="button" className={webMcpMenuOpen ? "is-active" : ""} aria-expanded={webMcpMenuOpen} onClick={() => setWebMcpMenuOpen((value) => !value)}>
              <PlayCircle size={15} /> <span>{copy.webmcpActions}</span>
            </button>
            <button type="button" className={cameraFollow ? "is-active" : ""} onClick={toggleCameraFollow}>
              {cameraFollow ? <Eye size={15} /> : <EyeOff size={15} />} <span>{cameraFollow && selectedAgent ? `${copy.following} ${selectedAgent.name}` : copy.cameraFollow}</span>
            </button>
            <button type="button" onClick={() => startWorkflow("custom-order")}><RotateCcw size={14} /> <span>{copy.restart}</span></button>
          </div>

          <div className={`atlas-webmcp-menu${webMcpMenuOpen ? " is-open" : ""}`} aria-hidden={!webMcpMenuOpen}>
            <button type="button" onClick={() => queueWebMcpDemoAction("reserve_capacity")}><span className="atlas-action-dot atlas-action-dot--supplier" />{copy.reserve}</button>
            <button type="button" onClick={() => queueWebMcpDemoAction("authorize_payment")}><span className="atlas-action-dot atlas-action-dot--finance" />{copy.payment}</button>
            <button type="button" onClick={() => queueWebMcpDemoAction("release_shipment")}><span className="atlas-action-dot atlas-action-dot--logistics" />{copy.shipment}</button>
            <button type="button" onClick={() => queueWebMcpDemoAction("send_customer_update")}><span className="atlas-action-dot atlas-action-dot--support" />{copy.customerUpdate}</button>
          </div>

          <div className="atlas-workflows">
            {ATLAS_WORKFLOWS.map((workflow) => {
              const translated = WORKFLOW_COPY[locale][workflow.id];
              return (
                <button key={workflow.id} type="button" className={`atlas-workflow${world.workflowId === workflow.id ? " is-active" : ""}`} onClick={() => startWorkflow(workflow.id)}>
                  <span className="atlas-workflow__icon">{workflowIcon(workflow.id)}</span>
                  <strong>{translated.label}</strong>
                  <span>{translated.subtitle}</span>
                </button>
              );
            })}
          </div>

          {activeWorkflow ? (
            <div className="atlas-progress-block">
              <div className="atlas-progress-copy"><span>{activeWorkflowCopy?.name ?? activeWorkflow.name}</span><span>{completedTasks} / {world.tasks.length}</span></div>
              <div className="atlas-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </div>
          ) : null}
        </div>
      </section>

      {selectedAgent && !pendingApproval ? (
        <aside className="atlas-agent-card" aria-live="polite">
          <div className="atlas-agent-card__top">
            <AnimalPortrait id={selectedAgent.id} side={selectedAgent.side} className="atlas-agent-avatar" />
            <div><strong>{selectedAgent.name}</strong><small>{selectedAgent.role} · {selectedAgent.organisation}</small></div>
            <button type="button" className="atlas-card-close" aria-label="Close agent" onClick={() => setSelectedAndFollow(null, false)}>×</button>
          </div>
          <div className="atlas-agent-status"><span>{statusCopy(locale, selectedAgent.status)}</span><span>{selectedTask?.title ?? copy.standingBy}</span></div>
          <button type="button" className={`atlas-follow${cameraFollow ? " is-active" : ""}`} onClick={toggleCameraFollow}>
            {cameraFollow ? <Eye size={14} /> : <EyeOff size={14} />}{cameraFollow ? copy.following : copy.followAgent}
          </button>
        </aside>
      ) : null}

      {pendingApproval ? (
        <aside className={`atlas-approval${pendingApproval.source === "webmcp" ? " atlas-approval--webmcp" : ""}`} aria-live="assertive">
          <div className="atlas-sheet-handle" aria-hidden="true" />
          <div className="atlas-approval__body">
            {approvalAgent ? <AnimalPortrait id={approvalAgent.id} side={approvalAgent.side} className="atlas-approval__avatar" /> : <AnimalPortrait id="approval-supplier" side="supplier" className="atlas-approval__avatar" />}
            <div className="atlas-approval__copy">
              <div className="atlas-approval__eyebrow">{pendingApproval.source === "webmcp" ? copy.webmcpRequest : copy.humanCheckpoint}</div>
              <strong>{pendingApproval.title}</strong>
              <p>{pendingApproval.detail}</p>
              <small>{pendingApproval.consequence}</small>
            </div>
          </div>
          <div className="atlas-approval__actions">
            <button type="button" className="atlas-decline" onClick={() => resolveApproval(pendingApproval.id, false)}>{copy.decline}</button>
            <button type="button" className="atlas-allow" onClick={() => resolveApproval(pendingApproval.id, true)}><ShieldCheck size={16} /> {copy.allow}</button>
          </div>
        </aside>
      ) : null}

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 160 })}><Plus size={17} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 160 })}><Minus size={17} /></button>
      </div>
      <button type="button" className="map-control map-control--locate" aria-label="Recenter map" onClick={recenter}><LocateFixed size={17} strokeWidth={1.8} /></button>

      {!mapReady && !mapError ? <div className="map-status">{copy.drawing}</div> : null}
      {mapError ? <div className="map-status map-status--error">{mapError}</div> : null}

      <div className="atlas-screen-reader-summary" aria-hidden="true">
        <span>Living Coordination Atlas</span>
        <span>WebMCP actions</span>
        <span>Camera follow</span>
        <span>English</span><span>繁體中文</span><span>日本語</span>
        <span>{phaseAgent?.name}</span>
      </div>
    </main>
  );
}

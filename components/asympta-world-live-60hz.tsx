"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
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
  type GeoPoint,
  type StakeholderSide,
  type WorkflowId,
} from "@/lib/atlas-simulation";
import {
  CITY_LIFE_COUNT,
  cityLifeActorAt,
  cityLifeSnapshot,
  createAtlasDemoWorld,
  demoDisclosure,
  resolveAtlasDemoApproval,
  startAtlasDemoWorkflow,
  type CityLifeActor,
} from "@/lib/atlas-demo";

type Locale = "en" | "zh-Hant" | "ja";
type PermissionMode = "READ" | "WRITE";
type WebMcpToolName =
  | "asympta_observe_living_city"
  | "asympta_list_workflows"
  | "asympta_follow_agent"
  | "asympta_request_workflow"
  | "asympta_request_external_action";

type GeoJsonFeatureCollection = { type: "FeatureCollection"; features: Array<Record<string, unknown>> };
type GeoJsonSource = { setData(data: GeoJsonFeatureCollection): void };
type BoundsLike = { getWest(): number; getEast(): number; getSouth(): number; getNorth(): number };
type CenterLike = { lng: number; lat: number };

type MapLibreMap = {
  on(event: string, handler: () => void): void;
  addSource(id: string, source: { type: "geojson"; data: GeoJsonFeatureCollection }): void;
  addLayer(layer: Record<string, unknown>): void;
  getSource(id: string): GeoJsonSource | undefined;
  getBounds(): BoundsLike;
  getCenter(): CenterLike;
  setCenter(coordinates: [number, number]): void;
  flyTo(options: Record<string, unknown>): void;
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

// The display loop runs on every requestAnimationFrame. Expensive world/UI work does not.
const SIMULATION_STEP_MS = 80;
const MAP_SOURCE_REFRESH_MS = 240;
const UI_REFRESH_MS = 250;
const CULL_REFRESH_MS = 900;
const MAX_AMBIENT_MOBILE = 8;
const MAX_AMBIENT_DESKTOP = 12;
const AMBIENT_DIALOGUE_LIMIT = 4;
const FOREGROUND_SMOOTHING_MS = 54;

const ACTIONS: ExternalAction[] = ["reserve_capacity", "authorize_payment", "release_shipment", "send_customer_update"];
const ACTION_OWNER: Record<ExternalAction, string> = {
  reserve_capacity: "agent-supplier",
  authorize_payment: "agent-finance",
  release_shipment: "agent-logistics",
  send_customer_update: "agent-support",
};

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
    livingCity: "Living city", ready: "Ready", coordinating: "Coordinating", waiting: "Waiting for you", completed: "Completed", blocked: "Blocked",
    webmcpReady: "WebMCP ready", webmcpChecking: "Checking WebMCP", webmcpUnavailable: "WebMCP browser API unavailable", demoCity: "Demo city",
    actorsMoving: "actors moving", workflowAgents: "workflow agents moving", webmcpInspector: "WebMCP inspector", cameraFollow: "Camera follow",
    following: "Following", followAgent: "Follow active agent", restart: "Restart", language: "Language", humanCheckpoint: "HUMAN CHECKPOINT",
    webmcpRequest: "WEBMCP REQUEST", decline: "Decline", allow: "Allow simulated action", reserve: "Reserve capacity", payment: "Authorise payment",
    shipment: "Release shipment", customerUpdate: "Customer update", standingBy: "Standing by", drawing: "Drawing the living street atlas…",
    menu: "Open coordination menu", closeMenu: "Collapse coordination menu", liveState: "Live agent state", jsonCall: "JSON call", copyJson: "Copy JSON",
  },
  "zh-Hant": {
    livingCity: "協作城市", ready: "就緒", coordinating: "協作中", waiting: "等候確認", completed: "已完成", blocked: "已暫停",
    webmcpReady: "WebMCP 已就緒", webmcpChecking: "正在檢查 WebMCP", webmcpUnavailable: "此瀏覽器未提供 WebMCP API", demoCity: "示範城市",
    actorsMoving: "個角色移動中", workflowAgents: "個工作流角色移動中", webmcpInspector: "WebMCP 即時檢視", cameraFollow: "鏡頭跟隨",
    following: "正在跟隨", followAgent: "跟隨活動角色", restart: "重新開始", language: "語言", humanCheckpoint: "人工確認",
    webmcpRequest: "WEBMCP 請求", decline: "拒絕", allow: "允許模擬動作", reserve: "預留產能", payment: "授權付款",
    shipment: "放行出貨", customerUpdate: "客戶更新", standingBy: "待命中", drawing: "正在繪製城市地圖…",
    menu: "開啟協作選單", closeMenu: "收起協作選單", liveState: "即時角色狀態", jsonCall: "JSON 呼叫", copyJson: "複製 JSON",
  },
  ja: {
    livingCity: "協調都市", ready: "準備完了", coordinating: "連携中", waiting: "確認待ち", completed: "完了", blocked: "停止中",
    webmcpReady: "WebMCP 準備完了", webmcpChecking: "WebMCP を確認中", webmcpUnavailable: "このブラウザでは WebMCP API を利用できません", demoCity: "デモ都市",
    actorsMoving: "アクター移動中", workflowAgents: "ワークフローエージェント移動中", webmcpInspector: "WebMCP インスペクタ", cameraFollow: "カメラ追従",
    following: "追従中", followAgent: "活動中のエージェントを追従", restart: "再開", language: "言語", humanCheckpoint: "人による確認",
    webmcpRequest: "WEBMCP リクエスト", decline: "拒否", allow: "シミュレーションを許可", reserve: "容量を予約", payment: "支払いを承認",
    shipment: "出荷を解放", customerUpdate: "顧客更新", standingBy: "待機中", drawing: "都市マップを描画中…",
    menu: "協調メニューを開く", closeMenu: "協調メニューを閉じる", liveState: "ライブエージェント状態", jsonCall: "JSON 呼び出し", copyJson: "JSON をコピー",
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

const WEBMCP_CATALOG: Array<{ name: WebMcpToolName; mode: PermissionMode; label: string }> = [
  { name: "asympta_observe_living_city", mode: "READ", label: "Observe living city" },
  { name: "asympta_list_workflows", mode: "READ", label: "List workflows" },
  { name: "asympta_follow_agent", mode: "READ", label: "Follow agent" },
  { name: "asympta_request_workflow", mode: "WRITE", label: "Request workflow" },
  { name: "asympta_request_external_action", mode: "WRITE", label: "Request external action" },
];

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
  map.addSource("city-life-routes", { type: "geojson", data: cityRouteGeoJson([]) });
  map.addSource("atlas-routes", { type: "geojson", data: activeRouteGeoJson(world) });
  map.addSource("atlas-messages", { type: "geojson", data: messageGeoJson(world) });
  map.addLayer({ id: "city-life-routes", type: "line", source: "city-life-routes", paint: { "line-color": sideColorExpression(), "line-width": 1, "line-opacity": 0.15, "line-dasharray": [1.1, 2.8] } });
  map.addLayer({ id: "atlas-route-shadow", type: "line", source: "atlas-routes", paint: { "line-color": "rgba(247,243,233,0.94)", "line-width": 5, "line-opacity": 0.7 } });
  map.addLayer({ id: "atlas-routes", type: "line", source: "atlas-routes", paint: { "line-color": sideColorExpression(), "line-width": 2.05, "line-opacity": 0.75, "line-dasharray": [1.6, 2.2] } });
  map.addLayer({ id: "atlas-messages", type: "line", source: "atlas-messages", paint: { "line-color": sideColorExpression(), "line-width": 1.2, "line-opacity": 0.4, "line-dasharray": [0.7, 1.8] } });
}

function syncMapSources(map: MapLibreMap, world: AtlasWorldState, ambientActors: CityLifeActor[]) {
  map.getSource("city-life-routes")?.setData(cityRouteGeoJson(ambientActors));
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

  const dialogue = document.createElement("span");
  dialogue.className = "animal-map-marker__dialogue";
  element.appendChild(dialogue);

  const face = document.createElement("span");
  face.className = "animal-map-marker__face";
  face.innerHTML = animalSvgMarkup(id, side);
  element.appendChild(face);

  const status = document.createElement("span");
  status.className = "animal-map-marker__status-dot";
  element.appendChild(status);

  const statusText = document.createElement("span");
  statusText.className = "animal-map-marker__status-text";
  element.appendChild(statusText);

  if (onSelect) element.addEventListener("click", (event) => { event.stopPropagation(); onSelect(); });
  return element;
}

function expandedBounds(map: MapLibreMap) {
  const bounds = map.getBounds();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const xPad = Math.max(0.01, Math.abs(east - west) * 0.18);
  const yPad = Math.max(0.008, Math.abs(north - south) * 0.18);
  return { west: west - xPad, east: east + xPad, south: south - yPad, north: north + yPad };
}

function actorInside(actor: CityLifeActor, bounds: ReturnType<typeof expandedBounds>) {
  return actor.position.lon >= bounds.west && actor.position.lon <= bounds.east && actor.position.lat >= bounds.south && actor.position.lat <= bounds.north;
}

function distanceTo(point: GeoPoint, center: CenterLike) {
  const lonScale = Math.cos(point.lat * Math.PI / 180);
  return Math.hypot((point.lon - center.lng) * lonScale, point.lat - center.lat);
}

function foregroundDialogue(world: AtlasWorldState, agentId: string) {
  const approval = world.approvals.find((item) => item.agentId === agentId && item.status === "pending");
  if (approval) return approval.source === "webmcp" ? `WebMCP → ${approval.actionType ?? "approval"}` : "Waiting for approval";
  const recentMessage = [...world.messages].reverse().find((message) => message.fromAgentId === agentId || message.toAgentId === agentId);
  if (recentMessage) return recentMessage.text;
  const task = world.tasks.find((item) => item.agentId === agentId && ["moving", "working", "waiting_approval"].includes(item.status));
  return task?.title ?? world.agents.find((agent) => agent.id === agentId)?.role ?? "Standing by";
}

function foregroundStatus(world: AtlasWorldState, agentId: string) {
  const agent = world.agents.find((item) => item.id === agentId);
  const task = world.tasks.find((item) => item.agentId === agentId && ["moving", "working", "waiting_approval"].includes(item.status));
  if (!agent) return "";
  if (task && (task.status === "moving" || task.status === "working")) return `${agent.status} · ${Math.round(task.progress * 100)}%`;
  if (task?.status === "waiting_approval") return "waiting · approval";
  return agent.status;
}

function truncateBubble(value: string, limit = 44) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function activeAgent(world: AtlasWorldState, selectedId: string | null) {
  return world.agents.find((agent) => agent.id === selectedId)
    ?? world.agents.find((agent) => agent.status === "moving")
    ?? world.agents.find((agent) => agent.status !== "idle")
    ?? world.agents[0];
}

function webMcpCall(tool: WebMcpToolName, world: AtlasWorldState, selectedId: string | null, action: ExternalAction) {
  const agent = activeAgent(world, selectedId);
  if (tool === "asympta_observe_living_city" || tool === "asympta_list_workflows") return { tool, arguments: {} };
  if (tool === "asympta_follow_agent") return { tool, arguments: { agentId: agent?.id ?? "agent-user" } };
  if (tool === "asympta_request_workflow") return { tool, arguments: { workflowId: world.workflowId ?? "custom-order" } };
  return {
    tool,
    arguments: {
      action,
      agentId: ACTION_OWNER[action],
      reason: "Demonstration request from the Asympta World WebMCP inspector.",
    },
  };
}

export function AsymptaWorldLive60Hz() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLibreRef = useRef<MapLibreNamespace | null>(null);
  const foregroundMarkersRef = useRef(new Map<string, MapLibreMarker>());
  const cityMarkersRef = useRef(new Map<string, MapLibreMarker>());
  const visibleAmbientIndicesRef = useRef<number[]>([]);
  const foregroundVisualRef = useRef(new Map<string, GeoPoint>());
  const selectedAgentIdRef = useRef<string | null>(null);
  const cameraFollowRef = useRef(false);
  const cullRequestedRef = useRef(true);

  const [world, setWorld] = useState<AtlasWorldState>(() => createAtlasDemoWorld());
  const worldRef = useRef(world);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [webMcpState, setWebMcpState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [cameraFollow, setCameraFollow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [webMcpOpen, setWebMcpOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const [visibleAmbientCount, setVisibleAmbientCount] = useState(0);
  const [inspectorTool, setInspectorTool] = useState<WebMcpToolName>("asympta_observe_living_city");
  const [inspectorAction, setInspectorAction] = useState<ExternalAction>("reserve_capacity");

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

  const updateForegroundMeta = useCallback((current: AtlasWorldState) => {
    const selectedId = selectedAgentIdRef.current;
    for (const agent of current.agents) {
      const marker = foregroundMarkersRef.current.get(agent.id);
      if (!marker) continue;
      const element = marker.getElement();
      element.dataset.status = agent.status;
      element.classList.toggle("is-selected", agent.id === selectedId);
      element.classList.toggle("is-moving", agent.status === "moving" || agent.status === "returning");
      element.classList.toggle("is-working", agent.status === "working" || agent.status === "sharing");
      const dialogue = element.querySelector<HTMLElement>(".animal-map-marker__dialogue");
      const status = element.querySelector<HTMLElement>(".animal-map-marker__status-text");
      const dialogueText = truncateBubble(foregroundDialogue(current, agent.id));
      const statusText = foregroundStatus(current, agent.id);
      if (dialogue && dialogue.textContent !== dialogueText) dialogue.textContent = dialogueText;
      if (status && status.textContent !== statusText) status.textContent = statusText;
      element.classList.toggle("has-dialogue", agent.status !== "idle" || agent.id === selectedId);
    }
  }, []);

  const updateForegroundVisual60Hz = useCallback((current: AtlasWorldState, elapsed: number) => {
    const alpha = 1 - Math.exp(-Math.max(1, elapsed) / FOREGROUND_SMOOTHING_MS);
    for (const agent of current.agents) {
      const marker = foregroundMarkersRef.current.get(agent.id);
      if (!marker) continue;
      const visual = foregroundVisualRef.current.get(agent.id) ?? { ...agent.position };
      if (agent.status === "moving" || agent.status === "returning") {
        visual.lon += (agent.position.lon - visual.lon) * alpha;
        visual.lat += (agent.position.lat - visual.lat) * alpha;
      } else {
        visual.lon = agent.position.lon;
        visual.lat = agent.position.lat;
      }
      foregroundVisualRef.current.set(agent.id, visual);
      marker.setLngLat([visual.lon, visual.lat]);
    }
  }, []);

  const reconcileAmbientMarkers = useCallback((visualNow: number) => {
    const map = mapRef.current;
    const maplibre = mapLibreRef.current;
    if (!map || !maplibre) return [] as CityLifeActor[];

    const bounds = expandedBounds(map);
    const center = map.getCenter();
    const max = window.innerWidth <= 700 ? MAX_AMBIENT_MOBILE : MAX_AMBIENT_DESKTOP;
    const candidates = cityLifeSnapshot(visualNow)
      .filter((actor) => actorInside(actor, bounds))
      .sort((a, b) => distanceTo(a.position, center) - distanceTo(b.position, center))
      .slice(0, max);
    const desired = new Set(candidates.map((actor) => actor.id));

    for (const [id, marker] of cityMarkersRef.current) {
      if (desired.has(id)) continue;
      marker.remove();
      cityMarkersRef.current.delete(id);
    }

    candidates.forEach((actor, rank) => {
      let marker = cityMarkersRef.current.get(actor.id);
      if (!marker) {
        const element = createAnimalMarkerElement(actor.id, actor.side, `${actor.name} · ${actor.role} · ${actor.task} · synthetic demo actor`, true);
        marker = new maplibre.Marker({ element, anchor: "center" }).setLngLat([actor.position.lon, actor.position.lat]).addTo(map);
        cityMarkersRef.current.set(actor.id, marker);
      }
      const element = marker.getElement();
      element.classList.toggle("has-dialogue", rank < AMBIENT_DIALOGUE_LIMIT);
      element.dataset.actorIndex = String(Number(actor.id.replace("city-", "")) - 1);
      const dialogue = element.querySelector<HTMLElement>(".animal-map-marker__dialogue");
      const status = element.querySelector<HTMLElement>(".animal-map-marker__status-text");
      if (dialogue) dialogue.textContent = truncateBubble(actor.task, 34);
      if (status) status.textContent = actor.status;
    });

    visibleAmbientIndicesRef.current = candidates.map((actor) => Number(actor.id.replace("city-", "")) - 1);
    setVisibleAmbientCount(candidates.length);
    return candidates;
  }, []);

  const updateAmbientVisual60Hz = useCallback((visualNow: number) => {
    const actors: CityLifeActor[] = [];
    visibleAmbientIndicesRef.current.forEach((index, rank) => {
      const actor = cityLifeActorAt(index, visualNow);
      actors.push(actor);
      const marker = cityMarkersRef.current.get(actor.id);
      if (!marker) return;
      marker.setLngLat([actor.position.lon, actor.position.lat]);
      const element = marker.getElement();
      if (element.dataset.status !== actor.status) {
        element.dataset.status = actor.status;
        element.classList.toggle("is-moving", actor.status === "moving");
        element.classList.toggle("is-working", actor.status === "working");
      }
      if (rank < AMBIENT_DIALOGUE_LIMIT && element.dataset.task !== actor.task) {
        element.dataset.task = actor.task;
        const dialogue = element.querySelector<HTMLElement>(".animal-map-marker__dialogue");
        if (dialogue) dialogue.textContent = truncateBubble(actor.task, 34);
      }
      const status = element.querySelector<HTMLElement>(".animal-map-marker__status-text");
      if (status && status.textContent !== actor.status) status.textContent = actor.status;
    });
    return actors;
  }, []);

  const syncImmediate = useCallback((next: AtlasWorldState) => {
    worldRef.current = next;
    setWorld(next);
    updateForegroundMeta(next);
    cullRequestedRef.current = true;
    return next;
  }, [updateForegroundMeta]);

  const startWorkflow = useCallback((workflowId: WorkflowId) => {
    const next = syncImmediate(startAtlasDemoWorkflow(worldRef.current, workflowId));
    const firstMoving = next.agents.find((agent) => agent.status === "moving") ?? null;
    setSelectedAndFollow(firstMoving?.id ?? null, false);
    return next;
  }, [setSelectedAndFollow, syncImmediate]);

  const resolveApproval = useCallback((approvalId: string, approved: boolean) => {
    const next = syncImmediate(resolveAtlasDemoApproval(worldRef.current, approvalId, approved));
    if (approved) {
      const moving = next.agents.find((agent) => agent.status === "moving");
      if (moving) setSelectedAndFollow(moving.id, true);
    }
    return next;
  }, [setSelectedAndFollow, syncImmediate]);

  const queueWebMcpDemoAction = useCallback((action: ExternalAction) => {
    setInspectorAction(action);
    setInspectorTool("asympta_request_external_action");
    setWebMcpOpen(true);
    const agentId = ACTION_OWNER[action];
    const next = syncImmediate(requestWebMcpAction(worldRef.current, action, agentId, "Requested from the Asympta World WebMCP inspector."));
    setSelectedAndFollow(agentId, true);
    return next;
  }, [setSelectedAndFollow, syncImmediate]);

  const toggleCameraFollow = useCallback(() => {
    if (cameraFollowRef.current) {
      setSelectedAndFollow(selectedAgentIdRef.current, false);
      return;
    }
    const candidate = activeAgent(worldRef.current, selectedAgentIdRef.current);
    if (candidate) setSelectedAndFollow(candidate.id, true);
  }, [setSelectedAndFollow]);

  const mountForegroundMarkers = useCallback((maplibre: MapLibreNamespace, map: MapLibreMap, current: AtlasWorldState) => {
    current.agents.forEach((agent) => {
      const element = createAnimalMarkerElement(agent.id, agent.side, `${agent.name} · ${SIDE_LABELS[agent.side]} · ${agent.role}`, false, () => setSelectedAndFollow(agent.id, true));
      const marker = new maplibre.Marker({ element, anchor: "center" }).setLngLat([agent.position.lon, agent.position.lat]).addTo(map);
      foregroundMarkersRef.current.set(agent.id, marker);
      foregroundVisualRef.current.set(agent.id, { ...agent.position });
    });
    updateForegroundMeta(current);
  }, [setSelectedAndFollow, updateForegroundMeta]);

  useEffect(() => {
    let disposed = false;
    loadMapLibre().then((maplibre) => {
      if (disposed || !mapContainerRef.current) return;
      mapLibreRef.current = maplibre;
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
      map.on("moveend", () => { cullRequestedRef.current = true; });
      map.on("zoomend", () => { cullRequestedRef.current = true; });
      map.on("load", () => {
        if (disposed) return;
        addMapLayers(map, worldRef.current);
        mountForegroundMarkers(maplibre, map, worldRef.current);
        const ambientActors = reconcileAmbientMarkers(worldRef.current.now);
        syncMapSources(map, worldRef.current, ambientActors);
        setMapReady(true);
      });
    }).catch((reason: unknown) => {
      if (!disposed) setMapError(reason instanceof Error ? reason.message : "The map could not be loaded.");
    });

    return () => {
      disposed = true;
      for (const marker of foregroundMarkersRef.current.values()) marker.remove();
      for (const marker of cityMarkersRef.current.values()) marker.remove();
      foregroundMarkersRef.current.clear();
      cityMarkersRef.current.clear();
      foregroundVisualRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      mapLibreRef.current = null;
    };
  }, [mountForegroundMarkers, reconcileAmbientMarkers]);

  // 60Hz target: marker coordinates are updated on every display frame; simulation, sources and React stay throttled.
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let simulationAccumulator = 0;
    let sourceAccumulator = 0;
    let uiAccumulator = 0;
    let cullAccumulator = CULL_REFRESH_MS;

    const animate = (now: number) => {
      const elapsed = Math.min(120, Math.max(0, now - previous));
      previous = now;
      if (document.hidden) {
        frame = window.requestAnimationFrame(animate);
        return;
      }

      simulationAccumulator += elapsed;
      sourceAccumulator += elapsed;
      uiAccumulator += elapsed;
      cullAccumulator += elapsed;

      if (simulationAccumulator >= SIMULATION_STEP_MS) {
        worldRef.current = advanceAtlasWorld(worldRef.current, simulationAccumulator);
        simulationAccumulator = 0;
        updateForegroundMeta(worldRef.current);
      }

      const visualNow = worldRef.current.now + simulationAccumulator;
      updateForegroundVisual60Hz(worldRef.current, elapsed);
      const visibleAmbientActors = updateAmbientVisual60Hz(visualNow);

      if ((cullRequestedRef.current || cullAccumulator >= CULL_REFRESH_MS) && mapRef.current && mapLibreRef.current) {
        cullAccumulator = 0;
        cullRequestedRef.current = false;
        reconcileAmbientMarkers(visualNow);
      }

      if (sourceAccumulator >= MAP_SOURCE_REFRESH_MS && mapRef.current) {
        sourceAccumulator = 0;
        syncMapSources(mapRef.current, worldRef.current, visibleAmbientActors);
      }

      if (cameraFollowRef.current && selectedAgentIdRef.current && mapRef.current) {
        const visual = foregroundVisualRef.current.get(selectedAgentIdRef.current);
        if (visual) mapRef.current.setCenter([visual.lon, visual.lat]);
      }

      if (uiAccumulator >= UI_REFRESH_MS) {
        uiAccumulator = 0;
        setWorld(worldRef.current);
      }

      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [reconcileAmbientMarkers, updateAmbientVisual60Hz, updateForegroundMeta, updateForegroundVisual60Hz]);

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
        name: "asympta_observe_living_city", title: "Observe Asympta living city",
        description: "Read the foreground workflow plus currently visible synthetic background agents.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: readOnly,
        execute: async () => JSON.stringify({ ok: true, foreground: atlasSnapshot(worldRef.current), ambient: visibleAmbientIndicesRef.current.map((index) => cityLifeActorAt(index, worldRef.current.now)), disclosure: demoDisclosure() }),
      },
      {
        name: "asympta_list_workflows", title: "List coordination workflows", description: "List available multi-stakeholder workflows.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: readOnly,
        execute: async () => JSON.stringify({ ok: true, workflows: ATLAS_WORKFLOWS.map((workflow) => ({ id: workflow.id, name: workflow.name, summary: workflow.summary })) }),
      },
      {
        name: "asympta_request_workflow", title: "Request a coordination workflow", description: "Request a workflow. It waits for explicit user approval.",
        inputSchema: { type: "object", properties: { workflowId: { type: "string", enum: workflowIds } }, required: ["workflowId"], additionalProperties: false }, annotations: mutating,
        execute: async (input) => {
          const workflowId = String(input.workflowId ?? "") as WorkflowId;
          if (!workflowIds.includes(workflowId)) return JSON.stringify({ ok: false, error: "Unknown workflow." });
          const next = syncImmediate(requestWebMcpWorkflow(worldRef.current, workflowId));
          const approval = [...next.approvals].reverse().find((item) => item.kind === "webmcp-start" && item.workflowId === workflowId && item.status === "pending");
          return JSON.stringify({ ok: true, queuedForHumanApproval: true, approvalId: approval?.id ?? null });
        },
      },
      {
        name: "asympta_request_external_action", title: "Request a consequential action", description: "Request a simulated consequential action; explicit user approval is required.",
        inputSchema: { type: "object", properties: { action: { type: "string", enum: ACTIONS }, agentId: { type: "string", enum: agentIds }, reason: { type: "string", minLength: 3, maxLength: 220 } }, required: ["action", "agentId", "reason"], additionalProperties: false }, annotations: mutating,
        execute: async (input) => {
          const action = String(input.action ?? "") as ExternalAction;
          const agentId = String(input.agentId ?? "");
          const reason = String(input.reason ?? "").trim();
          if (!ACTIONS.includes(action) || !agentIds.includes(agentId) || reason.length < 3) return JSON.stringify({ ok: false, error: "Invalid action request." });
          const next = syncImmediate(requestWebMcpAction(worldRef.current, action, agentId, reason));
          const approval = [...next.approvals].reverse().find((item) => item.status === "pending" && item.actionType === action);
          return JSON.stringify({ ok: true, queuedForHumanApproval: true, approvalId: approval?.id ?? null });
        },
      },
      {
        name: "asympta_follow_agent", title: "Follow an active agent", description: "Follow a foreground agent with the local map camera.",
        inputSchema: { type: "object", properties: { agentId: { type: "string", enum: agentIds } }, required: ["agentId"], additionalProperties: false }, annotations: readOnly,
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
  }, [setSelectedAndFollow, syncImmediate]);

  useEffect(() => {
    window.__ASYMPTA_DEMO__ = {
      snapshot: () => ({ foreground: atlasSnapshot(worldRef.current), ambient: visibleAmbientIndicesRef.current.map((index) => cityLifeActorAt(index, worldRef.current.now)), disclosure: demoDisclosure() }),
      startWorkflow: (workflowId) => atlasSnapshot(startWorkflow(workflowId)),
      advance: (milliseconds) => {
        const next = syncImmediate(advanceAtlasWorld(worldRef.current, milliseconds));
        return atlasSnapshot(next);
      },
      approve: (approvalId, approved) => atlasSnapshot(resolveApproval(approvalId, approved)),
    };
    return () => { delete window.__ASYMPTA_DEMO__; };
  }, [resolveApproval, startWorkflow, syncImmediate]);

  const pendingApproval = world.approvals.find((approval) => approval.status === "pending") ?? null;
  const selectedAgent = world.agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const inspectorAgent = activeAgent(world, selectedAgentId);
  const selectedTask = selectedAgent ? world.tasks.find((task) => task.agentId === selectedAgent.id && ["moving", "working", "waiting_approval"].includes(task.status)) : undefined;
  const inspectorTask = inspectorAgent ? world.tasks.find((task) => task.agentId === inspectorAgent.id && ["moving", "working", "waiting_approval"].includes(task.status)) : undefined;
  const approvalAgent = pendingApproval?.agentId ? world.agents.find((agent) => agent.id === pendingApproval.agentId) : null;
  const completedTasks = world.tasks.filter((task) => task.status === "done").length;
  const progress = world.tasks.length ? completedTasks / world.tasks.length : 0;
  const activeWorkflow = world.workflowId ? workflowFor(world.workflowId) : null;
  const movingForeground = world.agents.filter((agent) => agent.status === "moving").length;
  const activeWorkflowCopy = world.workflowId ? WORKFLOW_COPY[locale][world.workflowId] : null;
  const currentCall = webMcpCall(inspectorTool, world, selectedAgentId, inspectorAction);
  const liveWebMcpState = {
    phase: world.phase,
    permission: WEBMCP_CATALOG.find((tool) => tool.name === inspectorTool)?.mode ?? "READ",
    agent: inspectorAgent ? { id: inspectorAgent.id, name: inspectorAgent.name, side: inspectorAgent.side, status: inspectorAgent.status } : null,
    task: inspectorTask ? { id: inspectorTask.id, title: inspectorTask.title, status: inspectorTask.status, progress: Number(inspectorTask.progress.toFixed(2)) } : null,
    pendingApproval: pendingApproval ? { id: pendingApproval.id, source: pendingApproval.source, actionType: pendingApproval.actionType ?? null, status: pendingApproval.status } : null,
    visibleAmbientAgents: visibleAmbientCount,
  };

  const recenter = () => {
    setSelectedAndFollow(selectedAgentIdRef.current, false);
    mapRef.current?.flyTo({ center: TOKYO_CENTER, zoom: TOKYO_ZOOM, bearing: 0, pitch: 0, duration: 420, essential: true });
  };

  const copyCurrentJson = () => {
    const value = JSON.stringify(currentCall, null, 2);
    void navigator.clipboard?.writeText(value);
  };

  return (
    <main className="map-app" data-map-app="true" data-map-style="paper-illustrated-animal-living-city-demo" data-render-mode="raf-60hz-viewport-culling">
      <div ref={mapContainerRef} className="map-canvas" role="application" aria-label="Interactive paper map with illustrated animal stakeholder agents and simulated city activity" />
      <div className="map-paper-wash" aria-hidden="true" />
      <div className="map-paper-grain" aria-hidden="true" />

      <section className={`atlas-console ${menuOpen ? "is-open" : "is-collapsed"}`} aria-label="Coordination menu">
        <div className="atlas-menu-bar">
          <button type="button" className="atlas-menu-identity" aria-expanded={menuOpen} aria-label={menuOpen ? copy.closeMenu : copy.menu} onClick={() => setMenuOpen((value) => !value)}>
            <span className="atlas-menu-icon"><Menu size={17} strokeWidth={1.7} /></span>
            <span className="atlas-menu-copy"><small>ASYMPTA WORLD</small><strong>{activeWorkflowCopy?.name ?? copy.livingCity}</strong></span>
            <span className={`atlas-mini-phase atlas-mini-phase--${world.phase}`}><i />{phaseCopy(locale, world)}</span>
          </button>
          <button type="button" className={`atlas-quick-icon${languageOpen ? " is-active" : ""}`} aria-label={copy.language} aria-expanded={languageOpen} onClick={() => setLanguageOpen((value) => !value)}><Globe2 size={17} strokeWidth={1.7} /></button>
          <button type="button" className="atlas-quick-icon" aria-label={menuOpen ? copy.closeMenu : copy.menu} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
        </div>

        <div className={`atlas-language-menu${languageOpen ? " is-open" : ""}`} aria-hidden={!languageOpen}>
          {(["en", "zh-Hant", "ja"] as Locale[]).map((language) => (
            <button key={language} type="button" className={locale === language ? "is-active" : ""} onClick={() => { setLocale(language); setLanguageOpen(false); }}>
              <span>{language === "en" ? "English" : language === "zh-Hant" ? "繁體中文" : "日本語"}</span>{locale === language ? <i /> : null}
            </button>
          ))}
        </div>

        <div className="atlas-menu-panel" aria-hidden={!menuOpen}>
          <div className="atlas-status-stack">
            <div className="atlas-tool-state"><span className={`atlas-tool-dot atlas-tool-dot--${webMcpState}`} />{webMcpState === "ready" ? copy.webmcpReady : webMcpState === "checking" ? copy.webmcpChecking : copy.webmcpUnavailable}</div>
            <div className="atlas-tool-state"><span className="atlas-tool-dot atlas-tool-dot--ready" />60Hz visual · {visibleAmbientCount} nearby ambient · {movingForeground} {copy.workflowAgents}</div>
          </div>

          <div className="atlas-tool-actions">
            <button type="button" className={webMcpOpen ? "is-active" : ""} aria-expanded={webMcpOpen} onClick={() => setWebMcpOpen((value) => !value)}><PlayCircle size={15} /><span>{copy.webmcpInspector}</span></button>
            <button type="button" className={cameraFollow ? "is-active" : ""} onClick={toggleCameraFollow}>{cameraFollow ? <Eye size={15} /> : <EyeOff size={15} />}<span>{cameraFollow && selectedAgent ? `${copy.following} ${selectedAgent.name}` : copy.cameraFollow}</span></button>
            <button type="button" onClick={() => startWorkflow("custom-order")}><RotateCcw size={14} /><span>{copy.restart}</span></button>
          </div>

          {webMcpOpen ? (
            <div className="atlas-webmcp-inspector" aria-label="WebMCP live inspector">
              <div className="atlas-webmcp-tool-list">
                {WEBMCP_CATALOG.map((tool) => (
                  <button key={tool.name} type="button" className={inspectorTool === tool.name ? "is-active" : ""} onClick={() => setInspectorTool(tool.name)}>
                    <span className={`atlas-permission atlas-permission--${tool.mode.toLowerCase()}`}>{tool.mode}</span>
                    <span><strong>{tool.label}</strong><small>{tool.name}</small></span>
                  </button>
                ))}
              </div>

              <div className="atlas-webmcp-action-row">
                <button type="button" onClick={() => queueWebMcpDemoAction("reserve_capacity")}>{copy.reserve}</button>
                <button type="button" onClick={() => queueWebMcpDemoAction("authorize_payment")}>{copy.payment}</button>
                <button type="button" onClick={() => queueWebMcpDemoAction("release_shipment")}>{copy.shipment}</button>
                <button type="button" onClick={() => queueWebMcpDemoAction("send_customer_update")}>{copy.customerUpdate}</button>
              </div>

              <div className="atlas-json-grid">
                <section>
                  <div className="atlas-json-title"><span>{copy.jsonCall}</span><button type="button" aria-label={copy.copyJson} onClick={copyCurrentJson}><Copy size={13} /></button></div>
                  <pre>{JSON.stringify(currentCall, null, 2)}</pre>
                </section>
                <section>
                  <div className="atlas-json-title"><span>{copy.liveState}</span><span className={`atlas-permission atlas-permission--${liveWebMcpState.permission.toLowerCase()}`}>{liveWebMcpState.permission}</span></div>
                  <pre>{JSON.stringify(liveWebMcpState, null, 2)}</pre>
                </section>
              </div>
            </div>
          ) : null}

          <div className="atlas-workflows">
            {ATLAS_WORKFLOWS.map((workflow) => {
              const translated = WORKFLOW_COPY[locale][workflow.id];
              return (
                <button key={workflow.id} type="button" className={`atlas-workflow${world.workflowId === workflow.id ? " is-active" : ""}`} onClick={() => startWorkflow(workflow.id)}>
                  <span className="atlas-workflow__icon">{workflowIcon(workflow.id)}</span><strong>{translated.label}</strong><span>{translated.subtitle}</span>
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
          <button type="button" className={`atlas-follow${cameraFollow ? " is-active" : ""}`} onClick={toggleCameraFollow}>{cameraFollow ? <Eye size={14} /> : <EyeOff size={14} />}{cameraFollow ? copy.following : copy.followAgent}</button>
        </aside>
      ) : null}

      {pendingApproval ? (
        <aside className={`atlas-approval${pendingApproval.source === "webmcp" ? " atlas-approval--webmcp" : ""}`} aria-live="assertive">
          <div className="atlas-sheet-handle" aria-hidden="true" />
          <div className="atlas-approval__body">
            {approvalAgent ? <AnimalPortrait id={approvalAgent.id} side={approvalAgent.side} className="atlas-approval__avatar" /> : <AnimalPortrait id="approval-supplier" side="supplier" className="atlas-approval__avatar" />}
            <div className="atlas-approval__copy">
              <div className="atlas-approval__eyebrow">{pendingApproval.source === "webmcp" ? copy.webmcpRequest : copy.humanCheckpoint}</div>
              <strong>{pendingApproval.title}</strong><p>{pendingApproval.detail}</p><small>{pendingApproval.consequence}</small>
            </div>
          </div>
          <div className="atlas-approval__actions">
            <button type="button" className="atlas-decline" onClick={() => resolveApproval(pendingApproval.id, false)}>{copy.decline}</button>
            <button type="button" className="atlas-allow" onClick={() => resolveApproval(pendingApproval.id, true)}><ShieldCheck size={16} /> {copy.allow}</button>
          </div>
        </aside>
      ) : null}

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 140 })}><Plus size={17} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 140 })}><Minus size={17} /></button>
      </div>
      <button type="button" className="map-control map-control--locate" aria-label="Recenter map" onClick={recenter}><LocateFixed size={17} strokeWidth={1.8} /></button>
      {!mapReady && !mapError ? <div className="map-status">{copy.drawing}</div> : null}
      {mapError ? <div className="map-status map-status--error">{mapError}</div> : null}
    </main>
  );
}

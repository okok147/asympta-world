"use client";

import { Factory, Globe2, HeartPulse, MapPinned, Package, Wheat, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  GLOBAL_CORRIDORS,
  GLOBAL_CULL_REFRESH_MS,
  GLOBAL_FLOWS,
  GLOBAL_MAX_RENDERED_VEHICLES_DESKTOP,
  GLOBAL_MAX_RENDERED_VEHICLES_MOBILE,
  GLOBAL_NODES,
  GLOBAL_SIMULATION_STEP_MS,
  GLOBAL_SOURCE_REFRESH_MS,
  GLOBAL_UI_REFRESH_MS,
  advanceGlobalWorld,
  createGlobalWorld,
  flowFor,
  globalCorridorPolyline,
  globalFlowRealHours,
  globalFlowsForResource,
  globalMissionForWorkflow,
  globalVehicleSnapshot,
  globalWorldInvariantViolations,
  globalWorldSnapshot,
  selectGlobalVehicles,
  type GlobalFlow,
  type GlobalPoint,
  type GlobalResourceKind,
  type GlobalTransportMode,
  type GlobalVehicleSnapshot,
  type GlobalWorldSnapshot,
  type GlobalWorldState,
} from "@/lib/asympta-global-world";

type Locale = "en" | "zh-Hant" | "ja";
type ScaleMode = "world" | "city";
type GeoJsonFeatureCollection = { type: "FeatureCollection"; features: Array<Record<string, unknown>> };
type GeoJsonSource = { setData(data: GeoJsonFeatureCollection): void };
type MapCenter = { lng: number; lat: number };
type GlobalMap = {
  addSource(id: string, source: { type: "geojson"; data: GeoJsonFeatureCollection }): void;
  addLayer(layer: Record<string, unknown>): void;
  getSource(id: string): GeoJsonSource | undefined;
  getLayer(id: string): unknown;
  getStyle(): { layers?: Array<{ id: string }> };
  getCenter(): MapCenter;
  getZoom(): number;
  flyTo(options: Record<string, unknown>): void;
  setLayoutProperty(layerId: string, property: string, value: unknown): void;
  setMinZoom?(zoom: number): void;
  setRenderWorldCopies?(renderWorldCopies: boolean): void;
  on(event: string, handler: () => void): unknown;
  off?(event: string, handler: () => void): unknown;
  removeLayer?(id: string): void;
  removeSource?(id: string): void;
};
type GlobalMarker = {
  setLngLat(coordinates: [number, number]): GlobalMarker;
  addTo(map: GlobalMap): GlobalMarker;
  getElement(): HTMLElement;
  remove(): void;
};
type GlobalMapLibre = { Marker: new (options: { element: HTMLElement; anchor?: "center" }) => GlobalMarker };
type DemoSnapshot = { foreground?: { workflow?: string | null } };
type ModelContext = {
  registerTool(tool: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown> | unknown;
};

type UiProjection = {
  snapshot: GlobalWorldSnapshot;
  flow: GlobalFlow;
  vehicle: GlobalVehicleSnapshot | null;
};

const SCALE_KEY = "asympta-world.scale.v1";
const WORLD_CENTER: [number, number] = [24, 22];
const WORLD_ZOOM = 1.35;
const CITY_CENTER: [number, number] = [139.7544, 35.6762];
const CITY_ZOOM = 14.2;
const RESOURCE_ORDER: GlobalResourceKind[] = ["food", "material", "merchandise", "power", "medicine"];
const ROUTE_SOURCE = "asympta-global-routes-source";
const HUB_SOURCE = "asympta-global-hubs-source";
const ROUTE_LAYER = "asympta-global-routes";
const ROUTE_FOCUS_LAYER = "asympta-global-routes-focus";
const HUB_LAYER = "asympta-global-hubs";
const CITY_LAYERS = ["atlas-route-shadow", "atlas-routes", "atlas-messages"];

const RESOURCE_COLORS: Record<GlobalResourceKind, string> = {
  food: "#A88A5D",
  material: "#718494",
  merchandise: "#8C7288",
  power: "#B5944F",
  medicine: "#63877E",
};

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    world: "World", city: "City", network: "Global coordination", detail: "Tokyo detail", moving: "moving", delivered: "delivered",
    power: "power balance", reliability: "reliability", realTime: "real route", agents: "agents coordinating", choose: "Change network",
    food: "Food", material: "Materials", merchandise: "Merchandise", medicine: "Medicine", electricity: "Power",
    ship: "Ocean freight", air: "Air cargo", rail: "Rail", truck: "Freight truck", van: "Delivery van", car: "Local car", grid: "Power grid",
    handling: "Transfer and customs", rerouting: "Rerouting", waiting_supply: "Securing supply", movingStatus: "In transit",
    event: "Latest coordination", scope: "Aggregated world simulation — visible vehicles represent real supply-flow batches, not live commercial data.",
  },
  "zh-Hant": {
    world: "全球", city: "城市", network: "全球協作", detail: "東京細節", moving: "運輸中", delivered: "已交付",
    power: "電力平衡", reliability: "可靠度", realTime: "真實路線", agents: "代理協調中", choose: "切換網絡",
    food: "食品", material: "原材料", merchandise: "商品", medicine: "醫療", electricity: "電力",
    ship: "海運", air: "航空貨運", rail: "鐵路", truck: "幹線貨車", van: "配送車", car: "在地汽車", grid: "電網",
    handling: "轉運及清關", rerouting: "重新調度", waiting_supply: "補充供應", movingStatus: "運輸中",
    event: "最新協作", scope: "聚合式全球模擬；畫面中的交通工具代表真實供應批次，而非即時商業資料。",
  },
  ja: {
    world: "世界", city: "都市", network: "世界協調", detail: "東京詳細", moving: "輸送中", delivered: "配送済み",
    power: "電力収支", reliability: "信頼度", realTime: "実経路", agents: "エージェント連携", choose: "ネットワーク切替",
    food: "食品", material: "原材料", merchandise: "商品", medicine: "医療", electricity: "電力",
    ship: "海上輸送", air: "航空貨物", rail: "鉄道", truck: "幹線トラック", van: "配送バン", car: "地域車両", grid: "電力網",
    handling: "積替え・通関", rerouting: "再経路化", waiting_supply: "供給確保", movingStatus: "輸送中",
    event: "最新連携", scope: "集約型の世界シミュレーションです。表示車両は実際の供給ロットを表し、ライブ商取引データではありません。",
  },
};

const FLOW_COPY: Record<Locale, Record<string, string>> = {
  en: Object.fromEntries(GLOBAL_FLOWS.map((item) => [item.id, item.label])),
  "zh-Hant": {
    "food-grain-tokyo": "澳洲穀物 → 東京晚餐網絡",
    "food-seafood-tokyo": "挪威海產 → 東京冷鏈",
    "food-hokkaido-tokyo": "北海道農產 → 東京廚房",
    "food-rice-tokyo": "泰國稻米 → 東京食品供應商",
    "food-california-tokyo": "加州農產 → 東京高端市場",
    "material-lithium-tokyo": "皮爾巴拉鋰礦 → 深圳組裝 → 東京",
    "material-copper-europe": "阿塔卡馬銅礦 → 歐洲製造",
    "merchandise-electronics-tokyo": "深圳電子產品 → 東京顧客",
    "merchandise-pacific-retail": "深圳商品 → 新加坡 → 洛杉磯",
    "medicine-europe-tokyo": "法蘭克福醫藥 → 東京照護網絡",
    "food-brazil-europe": "巴西合作社 → 歐洲食品加工",
    "power-hokkaido-tokyo": "北海道風電 → 東京需求",
    "power-lng-tokyo": "卡塔爾 LNG 儲備 → 東京電網",
    "power-northsea-europe": "北海風電 → 鹿特丹工業",
  },
  ja: {
    "food-grain-tokyo": "豪州穀物 → 東京の夕食網",
    "food-seafood-tokyo": "ノルウェー水産物 → 東京コールドチェーン",
    "food-hokkaido-tokyo": "北海道農産物 → 東京の厨房",
    "food-rice-tokyo": "タイ米 → 東京食品供給網",
    "food-california-tokyo": "カリフォルニア青果 → 東京市場",
    "material-lithium-tokyo": "ピルバラのリチウム → 深圳組立 → 東京",
    "material-copper-europe": "アタカマ銅 → 欧州製造",
    "merchandise-electronics-tokyo": "深圳電子機器 → 東京顧客",
    "merchandise-pacific-retail": "深圳商品 → シンガポール → ロサンゼルス",
    "medicine-europe-tokyo": "フランクフルト医薬品 → 東京ケア網",
    "food-brazil-europe": "ブラジル協同組合 → 欧州食品加工",
    "power-hokkaido-tokyo": "北海道風力 → 東京需要",
    "power-lng-tokyo": "カタールLNG予備 → 東京電力網",
    "power-northsea-europe": "北海風力 → ロッテルダム産業",
  },
};

function bridge() {
  return window as unknown as {
    maplibregl?: GlobalMapLibre;
    __ASYMPTA_MAP__?: GlobalMap;
    __ASYMPTA_DEMO__?: { snapshot: () => unknown };
    __ASYMPTA_GLOBAL_WORLD__?: {
      snapshot: () => GlobalWorldSnapshot;
      setScale: (scale: ScaleMode) => void;
      focusResource: (resource: GlobalResourceKind) => void;
    };
  };
}

function modelContext() {
  return (document as Document & { modelContext?: ModelContext }).modelContext;
}

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function readScale(): ScaleMode {
  try { return window.localStorage.getItem(SCALE_KEY) === "city" ? "city" : "world"; } catch { return "world"; }
}

function writeScale(scale: ScaleMode) {
  try { window.localStorage.setItem(SCALE_KEY, scale); } catch {}
}

function money(value: number) {
  const amount = Math.max(0, value);
  if (amount >= 1_000_000_000) return `¥${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `¥${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `¥${(amount / 1_000).toFixed(1)}k`;
  return `¥${Math.round(amount)}`;
}

function resourceLabel(locale: Locale, resource: GlobalResourceKind) {
  const copy = COPY[locale];
  if (resource === "power") return copy.electricity;
  return copy[resource];
}

function modeLabel(locale: Locale, mode: GlobalTransportMode) {
  return COPY[locale][mode] ?? mode;
}

function statusLabel(locale: Locale, vehicle: GlobalVehicleSnapshot | null) {
  if (!vehicle) return COPY[locale].agents;
  if (vehicle.status === "handling") return COPY[locale].handling;
  if (vehicle.status === "rerouting") return COPY[locale].rerouting;
  if (vehicle.status === "waiting_supply") return COPY[locale].waiting_supply;
  return COPY[locale].movingStatus;
}

function coordinatorLabel(locale: Locale, mode: GlobalTransportMode) {
  if (locale === "en") return `${modeLabel(locale, mode)} agent`;
  if (locale === "zh-Hant") return `${modeLabel(locale, mode)}代理`;
  return `${modeLabel(locale, mode)}エージェント`;
}

function iconForResource(resource: GlobalResourceKind) {
  if (resource === "food") return <Wheat size={13} strokeWidth={1.6} />;
  if (resource === "material") return <Factory size={13} strokeWidth={1.6} />;
  if (resource === "merchandise") return <Package size={13} strokeWidth={1.6} />;
  if (resource === "power") return <Zap size={13} strokeWidth={1.6} />;
  return <HeartPulse size={13} strokeWidth={1.6} />;
}

function vehicleSvg(mode: GlobalTransportMode) {
  if (mode === "ship") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h16l-2 4H7z"/><path d="M8 7h8v7H8z"/><path d="M10 4h4v3h-4z"/></svg>';
  if (mode === "air") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13l8-2 4-7 2 1-2 6 5 2v2l-5-1-2 6-2-1v-6l-8 2z"/></svg>';
  if (mode === "rail") return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="14" rx="3"/><path d="M8 8h8M8 13h8M8 20l2-2M16 18l2 2"/></svg>';
  if (mode === "truck") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
  if (mode === "van") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h12l4 5v5H4z"/><path d="M16 9v4h4"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
  if (mode === "car") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l2-5h11l3 5v5H4z"/><path d="M7 10h9"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L6 13h5l-1 9 8-13h-5z"/></svg>';
}

function createVehicleElement(vehicle: GlobalVehicleSnapshot, onSelect: () => void) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "asympta-global-vehicle";
  element.dataset.shipmentId = vehicle.shipment.id;
  element.dataset.flowId = vehicle.flow.id;
  element.dataset.mode = vehicle.mode;
  element.dataset.resource = vehicle.resource;
  element.dataset.status = vehicle.status;
  element.style.setProperty("--global-resource", RESOURCE_COLORS[vehicle.resource]);
  element.style.setProperty("--global-bearing", `${vehicle.heading}deg`);
  element.title = `${vehicle.label} · ${vehicle.cargo}`;
  element.setAttribute("aria-label", element.title);
  element.innerHTML = `<span class="asympta-global-vehicle__ring"></span><span class="asympta-global-vehicle__glyph">${vehicleSvg(vehicle.mode)}</span>`;
  element.addEventListener("click", onSelect);
  return element;
}

function unwrapCoordinates(points: GlobalPoint[]) {
  if (!points.length) return [] as [number, number][];
  const result: [number, number][] = [[points[0].lon, points[0].lat]];
  let previous = points[0].lon;
  for (const point of points.slice(1)) {
    let lon = point.lon;
    while (lon - previous > 180) lon -= 360;
    while (lon - previous < -180) lon += 360;
    result.push([lon, point.lat]);
    previous = lon;
  }
  return result;
}

function routeData(resource: GlobalResourceKind, selectedFlowId: string): GeoJsonFeatureCollection {
  const features: Array<Record<string, unknown>> = [];
  for (const flow of GLOBAL_FLOWS) {
    flow.corridorIds.forEach((corridorId, legIndex) => {
      const corridor = GLOBAL_CORRIDORS.find((item) => item.id === corridorId);
      if (!corridor) return;
      const points = globalCorridorPolyline(corridorId, corridor.mode === "air" || corridor.mode === "ship" ? 30 : 12);
      features.push({
        type: "Feature",
        properties: {
          id: `${flow.id}:${corridorId}`,
          flowId: flow.id,
          resource: flow.resource,
          mode: corridor.mode,
          focus: flow.resource === resource ? 1 : 0,
          selected: flow.id === selectedFlowId ? 1 : 0,
          legIndex,
        },
        geometry: { type: "LineString", coordinates: unwrapCoordinates(points) },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

function hubData(resource: GlobalResourceKind, selectedFlowId: string): GeoJsonFeatureCollection {
  const selected = flowFor(selectedFlowId);
  const selectedNodes = new Set<string>();
  if (selected) {
    selectedNodes.add(selected.originId);
    selectedNodes.add(selected.destinationId);
    for (const corridorId of selected.corridorIds) {
      const corridor = GLOBAL_CORRIDORS.find((item) => item.id === corridorId);
      if (corridor) { selectedNodes.add(corridor.fromId); selectedNodes.add(corridor.toId); }
    }
  }
  return {
    type: "FeatureCollection",
    features: GLOBAL_NODES.map((node) => ({
      type: "Feature",
      properties: {
        id: node.id,
        name: node.name,
        kind: node.kind,
        focus: node.resources.includes(resource) ? 1 : 0,
        selected: selectedNodes.has(node.id) ? 1 : 0,
        resource: node.resources.includes(resource) ? resource : "other",
      },
      geometry: { type: "Point", coordinates: [node.lon, node.lat] },
    })),
  };
}

function safeLayout(map: GlobalMap, id: string, visibility: "visible" | "none") {
  try { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility); } catch {}
}

function ensureGlobalLayers(map: GlobalMap, resource: GlobalResourceKind, selectedFlowId: string) {
  if (!map.getStyle()?.layers?.length) return false;
  const routes = routeData(resource, selectedFlowId);
  const hubs = hubData(resource, selectedFlowId);
  try {
    if (!map.getSource(ROUTE_SOURCE)) map.addSource(ROUTE_SOURCE, { type: "geojson", data: routes });
    else map.getSource(ROUTE_SOURCE)?.setData(routes);
    if (!map.getSource(HUB_SOURCE)) map.addSource(HUB_SOURCE, { type: "geojson", data: hubs });
    else map.getSource(HUB_SOURCE)?.setData(hubs);

    if (!map.getLayer(ROUTE_LAYER)) {
      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        paint: {
          "line-color": ["match", ["get", "resource"], "food", RESOURCE_COLORS.food, "material", RESOURCE_COLORS.material, "merchandise", RESOURCE_COLORS.merchandise, "power", RESOURCE_COLORS.power, "medicine", RESOURCE_COLORS.medicine, "#77736A"],
          "line-width": ["case", ["==", ["get", "focus"], 1], 1.15, 0.55],
          "line-opacity": ["case", ["==", ["get", "focus"], 1], 0.34, 0.075],
          "line-dasharray": [1.2, 2.2],
        },
      });
    }
    if (!map.getLayer(ROUTE_FOCUS_LAYER)) {
      map.addLayer({
        id: ROUTE_FOCUS_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "line-color": ["match", ["get", "resource"], "food", RESOURCE_COLORS.food, "material", RESOURCE_COLORS.material, "merchandise", RESOURCE_COLORS.merchandise, "power", RESOURCE_COLORS.power, "medicine", RESOURCE_COLORS.medicine, "#77736A"],
          "line-width": 2.1,
          "line-opacity": 0.82,
          "line-dasharray": [1.5, 1.5],
        },
      });
    }
    if (!map.getLayer(HUB_LAYER)) {
      map.addLayer({
        id: HUB_LAYER,
        type: "circle",
        source: HUB_SOURCE,
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], 1], 4.2, ["==", ["get", "focus"], 1], 2.8, 1.7],
          "circle-color": ["case", ["==", ["get", "selected"], 1], "#F6F0E5", "#D7D0C2"],
          "circle-stroke-color": ["match", ["get", "resource"], "food", RESOURCE_COLORS.food, "material", RESOURCE_COLORS.material, "merchandise", RESOURCE_COLORS.merchandise, "power", RESOURCE_COLORS.power, "medicine", RESOURCE_COLORS.medicine, "#888176"],
          "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 1.7, 0.7],
          "circle-opacity": ["case", ["==", ["get", "focus"], 1], 0.92, 0.32],
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

function updateGlobalSources(map: GlobalMap, resource: GlobalResourceKind, selectedFlowId: string) {
  try {
    map.getSource(ROUTE_SOURCE)?.setData(routeData(resource, selectedFlowId));
    map.getSource(HUB_SOURCE)?.setData(hubData(resource, selectedFlowId));
  } catch {}
}

function setWorldLayersVisible(map: GlobalMap, visible: boolean) {
  const state = visible ? "visible" : "none";
  [ROUTE_LAYER, ROUTE_FOCUS_LAYER, HUB_LAYER].forEach((id) => safeLayout(map, id, state));
  CITY_LAYERS.forEach((id) => safeLayout(map, id, visible ? "none" : "visible"));
}

function flowProjection(world: GlobalWorldState, flow: GlobalFlow): GlobalVehicleSnapshot | null {
  const shipment = world.shipments.find((item) => item.flowId === flow.id) ?? null;
  return shipment ? globalVehicleSnapshot(world, shipment) : null;
}

export function AsymptaGlobalWorld() {
  const initialWorld = useMemo(() => createGlobalWorld(), []);
  const [scale, setScaleState] = useState<ScaleMode>("world");
  const [locale, setLocale] = useState<Locale>("en");
  const [resource, setResourceState] = useState<GlobalResourceKind>("food");
  const [, setSelectedFlowIdState] = useState(GLOBAL_FLOWS[0].id);
  const [projection, setProjection] = useState<UiProjection>(() => ({
    snapshot: globalWorldSnapshot(initialWorld),
    flow: GLOBAL_FLOWS[0],
    vehicle: flowProjection(initialWorld, GLOBAL_FLOWS[0]),
  }));

  const worldRef = useRef(initialWorld);
  const mapRef = useRef<GlobalMap | null>(null);
  const markersRef = useRef(new Map<string, GlobalMarker>());
  const scaleRef = useRef<ScaleMode>("world");
  const resourceRef = useRef<GlobalResourceKind>("food");
  const selectedFlowIdRef = useRef(GLOBAL_FLOWS[0].id);
  const manualResourceUntilRef = useRef(0);
  const simulationRemainderRef = useRef(0);
  const previousFrameRef = useRef(0);
  const sourceElapsedRef = useRef(GLOBAL_SOURCE_REFRESH_MS);
  const cullElapsedRef = useRef(GLOBAL_CULL_REFRESH_MS);
  const uiElapsedRef = useRef(GLOBAL_UI_REFRESH_MS);
  const needsCullRef = useRef(true);
  const layersReadyRef = useRef(false);
  const flowRotationRef = useRef(0);

  const copy = COPY[locale];
  const setResource = useCallback((next: GlobalResourceKind, manual = false) => {
    resourceRef.current = next;
    setResourceState(next);
    if (manual) manualResourceUntilRef.current = performance.now() + 12_000;
    const flows = globalFlowsForResource(next);
    const nextFlow = flows[0] ?? GLOBAL_FLOWS[0];
    selectedFlowIdRef.current = nextFlow.id;
    setSelectedFlowIdState(nextFlow.id);
    needsCullRef.current = true;
    const map = mapRef.current;
    if (map && layersReadyRef.current) updateGlobalSources(map, next, nextFlow.id);
  }, []);

  const setSelectedFlow = useCallback((flowId: string) => {
    const next = flowFor(flowId);
    if (!next) return;
    selectedFlowIdRef.current = next.id;
    resourceRef.current = next.resource;
    setSelectedFlowIdState(next.id);
    setResourceState(next.resource);
    manualResourceUntilRef.current = performance.now() + 12_000;
    needsCullRef.current = true;
    const map = mapRef.current;
    if (map && layersReadyRef.current) updateGlobalSources(map, next.resource, next.id);
  }, []);

  const applyScale = useCallback((next: ScaleMode, animate = true) => {
    scaleRef.current = next;
    setScaleState(next);
    writeScale(next);
    document.documentElement.dataset.asymptaScale = next;
    const map = mapRef.current;
    if (!map) return;
    if (next === "world") {
      try { map.setMinZoom?.(0.8); map.setRenderWorldCopies?.(false); } catch {}
    }
    setWorldLayersVisible(map, next === "world");
    for (const marker of markersRef.current.values()) marker.getElement().hidden = next !== "world";
    if (animate) {
      map.flyTo(next === "world"
        ? { center: WORLD_CENTER, zoom: WORLD_ZOOM, bearing: 0, pitch: 0, duration: 900, essential: true }
        : { center: CITY_CENTER, zoom: CITY_ZOOM, bearing: 0, pitch: 0, duration: 720, essential: true });
    }
    needsCullRef.current = true;
  }, []);

  useEffect(() => {
    const saved = readScale();
    scaleRef.current = saved;
    document.documentElement.dataset.asymptaScale = saved;
    const hydration = window.setTimeout(() => setScaleState(saved), 0);
    return () => {
      window.clearTimeout(hydration);
      delete document.documentElement.dataset.asymptaScale;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let attempts = 0;
    const onMapMove = () => { needsCullRef.current = true; };

    const connect = () => {
      if (disposed) return;
      attempts += 1;
      const map = bridge().__ASYMPTA_MAP__ ?? null;
      if (!map) return;
      mapRef.current = map;
      if (!ensureGlobalLayers(map, resourceRef.current, selectedFlowIdRef.current)) return;
      layersReadyRef.current = true;
      try { map.on("moveend", onMapMove); map.on("zoomend", onMapMove); } catch {}
      applyScale(scaleRef.current, true);
    };

    connect();
    const timer = window.setInterval(() => {
      if (layersReadyRef.current || attempts >= 60) { window.clearInterval(timer); return; }
      connect();
    }, 350);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      const map = mapRef.current;
      if (map?.off) {
        try { map.off("moveend", onMapMove); map.off("zoomend", onMapMove); } catch {}
      }
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
      if (map) {
        [ROUTE_FOCUS_LAYER, ROUTE_LAYER, HUB_LAYER].forEach((id) => { try { if (map.getLayer(id)) map.removeLayer?.(id); } catch {} });
        [ROUTE_SOURCE, HUB_SOURCE].forEach((id) => { try { if (map.getSource(id)) map.removeSource?.(id); } catch {} });
        CITY_LAYERS.forEach((id) => safeLayout(map, id, "visible"));
      }
      mapRef.current = null;
      layersReadyRef.current = false;
    };
  }, [applyScale]);

  const reconcileMarkers = useCallback((lookAheadMs = 0) => {
    const map = mapRef.current;
    const maplibre = bridge().maplibregl;
    if (!map || !maplibre || !layersReadyRef.current || scaleRef.current !== "world") return;
    const center = map.getCenter();
    const maximum = window.innerWidth <= 700 ? GLOBAL_MAX_RENDERED_VEHICLES_MOBILE : GLOBAL_MAX_RENDERED_VEHICLES_DESKTOP;
    const vehicles = selectGlobalVehicles(worldRef.current, { lon: center.lng, lat: center.lat }, map.getZoom(), maximum, lookAheadMs)
      .sort((a, b) => Number(b.resource === resourceRef.current) - Number(a.resource === resourceRef.current));
    const desired = new Set(vehicles.map((item) => item.shipment.id));

    for (const [id, marker] of markersRef.current) {
      if (desired.has(id)) continue;
      marker.remove();
      markersRef.current.delete(id);
    }

    for (const vehicle of vehicles) {
      let marker = markersRef.current.get(vehicle.shipment.id);
      if (!marker) {
        const element = createVehicleElement(vehicle, () => setSelectedFlow(vehicle.flow.id));
        marker = new maplibre.Marker({ element, anchor: "center" }).setLngLat([vehicle.point.lon, vehicle.point.lat]).addTo(map);
        markersRef.current.set(vehicle.shipment.id, marker);
      }
      const element = marker.getElement();
      element.hidden = false;
      element.dataset.flowId = vehicle.flow.id;
      element.dataset.mode = vehicle.mode;
      element.dataset.resource = vehicle.resource;
      element.dataset.status = vehicle.status;
      element.classList.toggle("is-focus-resource", vehicle.resource === resourceRef.current);
      element.classList.toggle("is-selected-flow", vehicle.flow.id === selectedFlowIdRef.current);
      element.style.setProperty("--global-resource", RESOURCE_COLORS[vehicle.resource]);
      element.style.setProperty("--global-bearing", `${vehicle.heading}deg`);
    }
  }, [setSelectedFlow]);

  const updateMarkerPositions = useCallback((lookAheadMs: number) => {
    if (scaleRef.current !== "world") return;
    for (const [shipmentId, marker] of markersRef.current) {
      const shipment = worldRef.current.shipments.find((item) => item.id === shipmentId);
      if (!shipment) continue;
      const vehicle = globalVehicleSnapshot(worldRef.current, shipment, lookAheadMs);
      if (!vehicle) continue;
      marker.setLngLat([vehicle.point.lon, vehicle.point.lat]);
      const element = marker.getElement();
      element.dataset.status = vehicle.status;
      element.style.setProperty("--global-bearing", `${vehicle.heading}deg`);
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    const animate = (now: number) => {
      const previous = previousFrameRef.current || now;
      const elapsed = Math.min(120, Math.max(0, now - previous));
      previousFrameRef.current = now;
      if (document.hidden) { frame = window.requestAnimationFrame(animate); return; }

      simulationRemainderRef.current += elapsed;
      sourceElapsedRef.current += elapsed;
      cullElapsedRef.current += elapsed;
      uiElapsedRef.current += elapsed;
      flowRotationRef.current += elapsed;

      if (simulationRemainderRef.current >= GLOBAL_SIMULATION_STEP_MS) {
        worldRef.current = advanceGlobalWorld(worldRef.current, simulationRemainderRef.current);
        simulationRemainderRef.current = 0;
      }

      updateMarkerPositions(simulationRemainderRef.current);

      if (layersReadyRef.current && sourceElapsedRef.current >= GLOBAL_SOURCE_REFRESH_MS) {
        sourceElapsedRef.current = 0;
        const map = mapRef.current;
        if (map) updateGlobalSources(map, resourceRef.current, selectedFlowIdRef.current);
      }

      if (needsCullRef.current || cullElapsedRef.current >= GLOBAL_CULL_REFRESH_MS) {
        needsCullRef.current = false;
        cullElapsedRef.current = 0;
        reconcileMarkers(simulationRemainderRef.current);
      }

      if (flowRotationRef.current >= 7_500 && performance.now() > manualResourceUntilRef.current) {
        flowRotationRef.current = 0;
        const flows = globalFlowsForResource(resourceRef.current);
        const index = Math.max(0, flows.findIndex((item) => item.id === selectedFlowIdRef.current));
        const next = flows[(index + 1) % Math.max(1, flows.length)] ?? GLOBAL_FLOWS[0];
        selectedFlowIdRef.current = next.id;
        setSelectedFlowIdState(next.id);
        needsCullRef.current = true;
      }

      if (uiElapsedRef.current >= GLOBAL_UI_REFRESH_MS) {
        uiElapsedRef.current = 0;
        const nextLocale = localeFromDocument();
        setLocale((value) => value === nextLocale ? value : nextLocale);
        const flow = flowFor(selectedFlowIdRef.current) ?? GLOBAL_FLOWS[0];
        setProjection({ snapshot: globalWorldSnapshot(worldRef.current), flow, vehicle: flowProjection(worldRef.current, flow) });
      }

      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [reconcileMarkers, updateMarkerPositions]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || performance.now() < manualResourceUntilRef.current) return;
      let snapshot: DemoSnapshot = {};
      try { snapshot = (bridge().__ASYMPTA_DEMO__?.snapshot() ?? {}) as DemoSnapshot; } catch { return; }
      const next = globalMissionForWorkflow(snapshot.foreground?.workflow);
      if (next !== resourceRef.current) setResource(next, false);
    }, 700);
    return () => window.clearInterval(timer);
  }, [setResource]);

  useEffect(() => {
    const api = bridge();
    api.__ASYMPTA_GLOBAL_WORLD__ = {
      snapshot: () => globalWorldSnapshot(worldRef.current),
      setScale: (next) => applyScale(next, true),
      focusResource: (next) => setResource(next, true),
    };
    return () => { delete api.__ASYMPTA_GLOBAL_WORLD__; };
  }, [applyScale, setResource]);

  useEffect(() => {
    const context = modelContext();
    if (!context) return;
    const controller = new AbortController();
    const tool = {
      name: "asympta_observe_global_supply_network",
      title: "Observe Asympta global supply network",
      description: "Read the aggregated world-scale food, material, merchandise, medicine, energy and transport simulation.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async () => JSON.stringify({
        ok: true,
        world: globalWorldSnapshot(worldRef.current),
        invariants: globalWorldInvariantViolations(worldRef.current),
        flows: GLOBAL_FLOWS.map((flow) => ({ id: flow.id, resource: flow.resource, commodity: flow.commodity, route: flow.corridorIds, realHours: globalFlowRealHours(flow) })),
        disclosure: "Deterministic aggregated simulation; not live carrier, energy-market or commercial data.",
      }),
    };
    Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const cycleResource = () => {
    const index = RESOURCE_ORDER.indexOf(resource);
    setResource(RESOURCE_ORDER[(index + 1) % RESOURCE_ORDER.length], true);
  };

  const vehicle = projection.vehicle;
  const selectedMode = vehicle?.mode ?? "ship";
  const flowName = FLOW_COPY[locale][projection.flow.id] ?? projection.flow.label;
  const routeHours = Math.round(globalFlowRealHours(projection.flow));
  const progress = vehicle ? Math.round(vehicle.legProgress * 100) : 0;
  const balance = projection.snapshot.powerBalanceMw;
  const latestEvent = projection.snapshot.recentEvents[0];

  return (
    <section className={`asympta-global-console is-${scale}`} aria-label={copy.network} data-resource={resource}>
      <div className="asympta-global-console__head">
        <button type="button" className="asympta-global-scale" onClick={() => applyScale(scale === "world" ? "city" : "world", true)} aria-label={scale === "world" ? copy.detail : copy.network}>
          {scale === "world" ? <Globe2 size={15} strokeWidth={1.6} /> : <MapPinned size={15} strokeWidth={1.6} />}
          <span><small>ASYMPTA</small><strong>{scale === "world" ? copy.world : copy.city}</strong></span>
        </button>
        <button type="button" className="asympta-global-resource" onClick={cycleResource} title={copy.choose}>
          {iconForResource(resource)}<span>{resourceLabel(locale, resource)}</span>
        </button>
      </div>

      {scale === "world" ? (
        <div className="asympta-global-console__body">
          <div className="asympta-global-flow">
            <div><small>{coordinatorLabel(locale, selectedMode)} · {statusLabel(locale, vehicle)}</small><strong>{flowName}</strong></div>
            <span>{modeLabel(locale, selectedMode)} · {progress}%</span>
          </div>
          <div className="asympta-global-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="asympta-global-metrics">
            <span><strong>{projection.snapshot.activeShipments}</strong> {copy.moving}</span>
            <span><strong>{money(projection.snapshot.deliveredValue)}</strong> {copy.delivered}</span>
            <span><strong>{balance >= 0 ? "+" : ""}{balance} MW</strong> {copy.power}</span>
            <span><strong>{projection.snapshot.reliability}%</strong> {copy.reliability}</span>
          </div>
          {latestEvent ? <div className="asympta-global-event" title={latestEvent.detail}><span>{copy.event}</span><strong>{latestEvent.actor ?? copy.agents} · {latestEvent.title}</strong></div> : null}
          <div className="asympta-global-foot"><span>{copy.realTime} · ~{routeHours}h</span><span>{copy.scope}</span></div>
        </div>
      ) : null}
    </section>
  );
}

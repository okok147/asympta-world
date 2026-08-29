"use client";

import {
  Eye,
  EyeOff,
  HeartPulse,
  LocateFixed,
  Minus,
  Package,
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

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
};

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

let mapLibrePromise: Promise<MapLibreNamespace> | null = null;

function workflowIcon(id: WorkflowId) {
  if (id === "custom-order") return <ShoppingCart size={18} strokeWidth={1.75} />;
  if (id === "dinner-network") return <Utensils size={18} strokeWidth={1.75} />;
  if (id === "launch-stock") return <Package size={18} strokeWidth={1.75} />;
  return <HeartPulse size={18} strokeWidth={1.75} />;
}

function workflowSubtitle(id: WorkflowId) {
  if (id === "custom-order") return "Intent";
  if (id === "dinner-network") return "Request";
  if (id === "launch-stock") return "Plan";
  return "Service";
}

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

  map.addLayer({
    id: "city-life-routes",
    type: "line",
    source: "city-life-routes",
    paint: { "line-color": sideColorExpression(), "line-width": 1.15, "line-opacity": 0.22, "line-dasharray": [1.1, 2.6] },
  });
  map.addLayer({
    id: "city-life-labels",
    type: "symbol",
    source: "city-life-agents",
    minzoom: 13.7,
    layout: { "text-field": ["get", "name"], "text-size": 8.5, "text-offset": [0, 2.25], "text-anchor": "top", "text-allow-overlap": false },
    paint: { "text-color": "rgba(55,52,47,0.58)", "text-halo-color": "rgba(247,243,233,0.92)", "text-halo-width": 1.7 },
  });

  map.addLayer({ id: "atlas-route-shadow", type: "line", source: "atlas-routes", paint: { "line-color": "rgba(247,243,233,0.95)", "line-width": 6, "line-opacity": 0.82 } });
  map.addLayer({ id: "atlas-routes", type: "line", source: "atlas-routes", paint: { "line-color": sideColorExpression(), "line-width": 2.25, "line-opacity": 0.78, "line-dasharray": [1.6, 2.1] } });
  map.addLayer({ id: "atlas-messages", type: "line", source: "atlas-messages", paint: { "line-color": sideColorExpression(), "line-width": 1.35, "line-opacity": 0.44, "line-dasharray": [0.65, 1.7] } });
  map.addLayer({
    id: "atlas-agent-labels",
    type: "symbol",
    source: "atlas-agents",
    minzoom: 12.7,
    layout: { "text-field": ["get", "name"], "text-size": 10.5, "text-offset": [0, 2.45], "text-anchor": "top", "text-allow-overlap": false },
    paint: { "text-color": "#33312D", "text-halo-color": "rgba(247,243,233,0.96)", "text-halo-width": 2 },
  });
}

function createAnimalMarkerElement(
  id: string,
  side: StakeholderSide,
  label: string,
  ambient: boolean,
  onSelect?: () => void,
) {
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

  if (onSelect) {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect();
    });
  }
  return element;
}

function syncMapSources(map: MapLibreMap, world: AtlasWorldState) {
  const city = cityLifeSnapshot(world.now);
  map.getSource("city-life-agents")?.setData(cityAgentGeoJson(city));
  map.getSource("city-life-routes")?.setData(cityRouteGeoJson(city));
  map.getSource("atlas-agents")?.setData(activeAgentGeoJson(world));
  map.getSource("atlas-routes")?.setData(activeRouteGeoJson(world));
  map.getSource("atlas-messages")?.setData(messageGeoJson(world));
}

function phaseLabel(world: AtlasWorldState) {
  if (world.phase === "running") return "Coordinating";
  if (world.phase === "waiting_approval") return "Waiting for you";
  if (world.phase === "completed") return "Completed";
  if (world.phase === "blocked") return "Blocked";
  return "Ready";
}

export function AsymptaWorldLiveDemo() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const foregroundMarkersRef = useRef(new Map<string, MapLibreMarker>());
  const cityMarkersRef = useRef(new Map<string, MapLibreMarker>());
  const [world, setWorld] = useState<AtlasWorldState>(() => createAtlasDemoWorld());
  const worldRef = useRef(world);
  const lastFollowRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [webMcpState, setWebMcpState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [cameraFollow, setCameraFollow] = useState(false);

  const apply = useCallback((change: (current: AtlasWorldState) => AtlasWorldState) => {
    const next = change(worldRef.current);
    worldRef.current = next;
    setWorld(next);
    return next;
  }, []);

  const startWorkflow = useCallback((workflowId: WorkflowId) => {
    const next = apply((current) => startAtlasDemoWorkflow(current, workflowId));
    setSelectedAgentId(null);
    setCameraFollow(false);
    return next;
  }, [apply]);

  const resolveApproval = useCallback((approvalId: string, approved: boolean) => {
    const next = apply((current) => resolveAtlasDemoApproval(current, approvalId, approved));
    if (approved) {
      const moving = next.agents.find((agent) => agent.status === "moving");
      if (moving) {
        setSelectedAgentId(moving.id);
        setCameraFollow(true);
      }
    }
    return next;
  }, [apply]);

  const restartDemo = useCallback(() => startWorkflow("custom-order"), [startWorkflow]);

  const mountAnimalMarkers = useCallback((maplibre: MapLibreNamespace, map: MapLibreMap, current: AtlasWorldState) => {
    for (const agent of current.agents) {
      const element = createAnimalMarkerElement(
        agent.id,
        agent.side,
        `${agent.name} · ${SIDE_LABELS[agent.side]} · ${agent.role}`,
        false,
        () => {
          setSelectedAgentId(agent.id);
          setCameraFollow(true);
        },
      );
      const marker = new maplibre.Marker({ element, anchor: "center" })
        .setLngLat([agent.position.lon, agent.position.lat])
        .addTo(map);
      foregroundMarkersRef.current.set(agent.id, marker);
    }

    for (const actor of cityLifeSnapshot(current.now)) {
      const element = createAnimalMarkerElement(
        actor.id,
        actor.side,
        `${actor.name} · ${actor.role} · ${actor.task} · synthetic demo actor`,
        true,
      );
      const marker = new maplibre.Marker({ element, anchor: "center" })
        .setLngLat([actor.position.lon, actor.position.lat])
        .addTo(map);
      cityMarkersRef.current.set(actor.id, marker);
    }
  }, []);

  const syncAnimalMarkers = useCallback((current: AtlasWorldState, selectedId: string | null) => {
    for (const agent of current.agents) {
      const marker = foregroundMarkersRef.current.get(agent.id);
      if (!marker) continue;
      marker.setLngLat([agent.position.lon, agent.position.lat]);
      const element = marker.getElement();
      element.dataset.status = agent.status;
      element.classList.toggle("is-moving", agent.status === "moving" || agent.status === "returning");
      element.classList.toggle("is-working", agent.status === "working" || agent.status === "sharing");
      element.classList.toggle("is-selected", agent.id === selectedId);
      const task = current.tasks.find((candidate) => candidate.agentId === agent.id && ["moving", "working", "waiting_approval"].includes(candidate.status));
      element.title = `${agent.name} · ${agent.role}${task ? ` · ${task.title}` : ""}`;
    }

    for (const actor of cityLifeSnapshot(current.now)) {
      const marker = cityMarkersRef.current.get(actor.id);
      if (!marker) continue;
      marker.setLngLat([actor.position.lon, actor.position.lat]);
      const element = marker.getElement();
      element.dataset.status = actor.status;
      element.classList.toggle("is-moving", actor.status === "moving");
      element.classList.toggle("is-working", actor.status === "working");
      element.title = `${actor.name} · ${actor.role} · ${actor.task} · synthetic demo actor`;
    }
  }, []);

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
          fadeDuration: 80,
        });
        mapRef.current = map;
        map.dragRotate.disable();
        map.touchPitch?.disable();
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
        map.on("load", () => {
          if (disposed) return;
          addMapLayers(map, worldRef.current);
          mountAnimalMarkers(maplibre, map, worldRef.current);
          syncMapSources(map, worldRef.current);
          syncAnimalMarkers(worldRef.current, null);
          setMapReady(true);
        });
      })
      .catch((reason: unknown) => {
        if (!disposed) setMapError(reason instanceof Error ? reason.message : "The map could not be loaded.");
      });
    return () => {
      disposed = true;
      for (const marker of foregroundMarkersRef.current.values()) marker.remove();
      for (const marker of cityMarkersRef.current.values()) marker.remove();
      foregroundMarkersRef.current.clear();
      cityMarkersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mountAnimalMarkers, syncAnimalMarkers]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    syncMapSources(mapRef.current, world);
    syncAnimalMarkers(world, selectedAgentId);
  }, [mapReady, selectedAgentId, syncAnimalMarkers, world]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    const animate = (now: number) => {
      const elapsed = Math.min(120, Math.max(0, now - previous));
      previous = now;
      accumulator += elapsed;
      if (accumulator >= 42) {
        const step = accumulator;
        accumulator = 0;
        apply((current) => advanceAtlasWorld(current, step));
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [apply]);

  useEffect(() => {
    if (!cameraFollow || !selectedAgentId || !mapReady || !mapRef.current) return;
    const agent = world.agents.find((candidate) => candidate.id === selectedAgentId);
    if (!agent) return;
    const now = performance.now();
    if (now - lastFollowRef.current < 120) return;
    lastFollowRef.current = now;
    mapRef.current.easeTo({ center: [agent.position.lon, agent.position.lat], duration: 100, essential: true });
  }, [cameraFollow, mapReady, selectedAgentId, world]);

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
          const next = apply((current) => requestWebMcpWorkflow(current, workflowId));
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
          const next = apply((current) => requestWebMcpAction(current, action, agentId, reason));
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
          setSelectedAgentId(agentId);
          setCameraFollow(true);
          return JSON.stringify({ ok: true, following: agentId });
        },
      },
    ];

    Promise.all(tools.map((tool) => Promise.resolve().then(() => modelContext.registerTool(tool, { signal: controller.signal }))))
      .then(() => setWebMcpState("ready"))
      .catch(() => setWebMcpState("unavailable"));
    return () => controller.abort();
  }, [apply]);

  useEffect(() => {
    window.__ASYMPTA_DEMO__ = {
      snapshot: () => ({ foreground: atlasSnapshot(worldRef.current), ambient: cityLifeSnapshot(worldRef.current.now), disclosure: demoDisclosure() }),
      startWorkflow: (workflowId) => atlasSnapshot(startWorkflow(workflowId)),
      advance: (milliseconds) => atlasSnapshot(apply((current) => advanceAtlasWorld(current, milliseconds))),
      approve: (approvalId, approved) => atlasSnapshot(resolveApproval(approvalId, approved)),
    };
    return () => { delete window.__ASYMPTA_DEMO__; };
  }, [apply, resolveApproval, startWorkflow]);

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
  const recenter = () => mapRef.current?.flyTo({ center: TOKYO_CENTER, zoom: TOKYO_ZOOM, bearing: 0, pitch: 0, duration: 650, essential: true });
  const phaseAgent = selectedAgent ?? world.agents.find((agent) => agent.status === "moving") ?? world.agents[0];

  return (
    <main className="map-app" data-map-app="true" data-map-style="paper-illustrated-animal-living-city-demo">
      <div ref={mapContainerRef} className="map-canvas" role="application" aria-label="Interactive paper map with illustrated animal stakeholder agents and simulated city activity" />
      <div className="map-paper-wash" aria-hidden="true" />
      <div className="map-paper-grain" aria-hidden="true" />

      <section className="atlas-console" aria-label="Coordination workflows">
        <div className="atlas-console__head">
          <div>
            <div className="atlas-eyebrow">ASYMPTA WORLD</div>
            <div className="atlas-title">Living Coordination<br />Atlas</div>
          </div>
          <div className={`atlas-phase atlas-phase--${world.phase}`}>
            <span className="atlas-phase__dot" />
            <span>{phaseLabel(world)}</span>
            {phaseAgent ? <AnimalPortrait id={phaseAgent.id} side={phaseAgent.side} className="atlas-phase__animal" /> : null}
          </div>
        </div>

        <div className="atlas-status-stack">
          <div className="atlas-tool-state"><span className={`atlas-tool-dot atlas-tool-dot--${webMcpState}`} />{webMcpState === "ready" ? "WebMCP ready" : webMcpState === "checking" ? "Checking WebMCP" : "WebMCP browser API unavailable"}</div>
          <div className="atlas-tool-state"><span className="atlas-tool-dot atlas-tool-dot--ready" />Demo city · {movingAmbient}/{CITY_LIFE_COUNT} actors moving · {movingForeground} workflow agents moving</div>
        </div>

        <div className="atlas-workflows">
          {ATLAS_WORKFLOWS.map((workflow) => (
            <button key={workflow.id} type="button" className={`atlas-workflow${world.workflowId === workflow.id ? " is-active" : ""}`} onClick={() => startWorkflow(workflow.id)}>
              <span className="atlas-workflow__icon">{workflowIcon(workflow.id)}</span>
              <strong>{workflow.shortName}</strong>
              <span>{workflowSubtitle(workflow.id)}</span>
            </button>
          ))}
        </div>

        {activeWorkflow ? (
          <div className="atlas-progress-block">
            <div className="atlas-progress-copy"><span>{activeWorkflow.name}</span><span>{completedTasks} / {world.tasks.length}</span></div>
            <div className="atlas-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <button type="button" className="atlas-reset" onClick={restartDemo}><RotateCcw size={13} /> Restart demo</button>
          </div>
        ) : null}
      </section>

      {world.events.length ? (
        <aside className="atlas-stream" aria-label="Coordination stream">
          <div className="atlas-stream__title">Live coordination</div>
          {world.events.slice(0, 3).map((event) => <div className="atlas-event" key={event.id}><strong>{event.title}</strong><span>{event.detail}</span></div>)}
        </aside>
      ) : null}

      {selectedAgent && !pendingApproval ? (
        <aside className="atlas-agent-card" aria-live="polite">
          <div className="atlas-agent-card__top">
            <AnimalPortrait id={selectedAgent.id} side={selectedAgent.side} className="atlas-agent-avatar" />
            <div><strong>{selectedAgent.name}</strong><small>{selectedAgent.role} · {selectedAgent.organisation}</small></div>
            <button type="button" className="atlas-card-close" aria-label="Close agent" onClick={() => { setSelectedAgentId(null); setCameraFollow(false); }}>×</button>
          </div>
          <div className="atlas-agent-status"><span>{selectedAgent.status}</span><span>{selectedTask?.title ?? "Standing by"}</span></div>
          <button type="button" className={`atlas-follow${cameraFollow ? " is-active" : ""}`} onClick={() => setCameraFollow((value) => !value)}>
            {cameraFollow ? <Eye size={14} /> : <EyeOff size={14} />}{cameraFollow ? "Tracking agent" : "Follow agent"}
          </button>
        </aside>
      ) : null}

      {pendingApproval ? (
        <aside className={`atlas-approval${pendingApproval.source === "webmcp" ? " atlas-approval--webmcp" : ""}`} aria-live="assertive">
          <div className="atlas-sheet-handle" aria-hidden="true" />
          <div className="atlas-approval__body">
            {approvalAgent ? (
              <AnimalPortrait id={approvalAgent.id} side={approvalAgent.side} className="atlas-approval__avatar" />
            ) : (
              <AnimalPortrait id="approval-supplier" side="supplier" className="atlas-approval__avatar" />
            )}
            <div className="atlas-approval__copy">
              <div className="atlas-approval__eyebrow">{pendingApproval.source === "webmcp" ? "WEBMCP REQUEST" : "HUMAN CHECKPOINT"}</div>
              <strong>{pendingApproval.title}</strong>
              <p>{pendingApproval.detail}</p>
              <small>{pendingApproval.consequence}</small>
            </div>
          </div>
          <div className="atlas-approval__actions">
            <button type="button" className="atlas-decline" onClick={() => resolveApproval(pendingApproval.id, false)}>Decline</button>
            <button type="button" className="atlas-allow" onClick={() => resolveApproval(pendingApproval.id, true)}><ShieldCheck size={17} /> Allow simulated action</button>
          </div>
        </aside>
      ) : null}

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 220 })}><Plus size={18} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 220 })}><Minus size={18} /></button>
      </div>
      <button type="button" className="map-control map-control--locate" aria-label="Recenter map" onClick={recenter}><LocateFixed size={18} strokeWidth={1.8} /></button>
      {!mapReady && !mapError ? <div className="map-status">Drawing the living street atlas…</div> : null}
      {mapError ? <div className="map-status map-status--error">{mapError}</div> : null}
    </main>
  );
}

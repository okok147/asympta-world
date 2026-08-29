"use client";

import { Eye, EyeOff, LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ATLAS_AGENTS,
  ATLAS_LOCATIONS,
  ATLAS_WORKFLOWS,
  advanceAtlasWorld,
  atlasSnapshot,
  createAtlasWorld,
  requestWebMcpAction,
  requestWebMcpWorkflow,
  resolveAtlasApproval,
  startAtlasWorkflow,
  workflowFor,
  type AtlasWorldState,
  type ExternalAction,
  type StakeholderSide,
  type WorkflowId,
} from "@/lib/atlas-simulation";

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
};

type MapFeature = { properties?: Record<string, unknown> };
type MapLayerEvent = { features?: MapFeature[] };
type GeoJsonSource = { setData(data: GeoJsonFeatureCollection): void };

type MapLibreMap = {
  on(event: string, handler: () => void): void;
  on(event: string, layerId: string, handler: (event: MapLayerEvent) => void): void;
  addSource(id: string, source: { type: "geojson"; data: GeoJsonFeatureCollection }): void;
  addLayer(layer: Record<string, unknown>): void;
  getSource(id: string): GeoJsonSource | undefined;
  flyTo(options: Record<string, unknown>): void;
  easeTo(options: Record<string, unknown>): void;
  zoomIn(options?: Record<string, unknown>): void;
  zoomOut(options?: Record<string, unknown>): void;
  getCanvas(): HTMLCanvasElement;
  remove(): void;
  touchZoomRotate: { enable(): void; disableRotation(): void };
  dragRotate: { disable(): void };
  touchPitch?: { disable(): void };
};

type MapLibreNamespace = { Map: new (options: Record<string, unknown>) => MapLibreMap };

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
};

declare global {
  interface Window {
    maplibregl?: MapLibreNamespace;
    __ASYMPTA_ATLAS__?: {
      snapshot: () => unknown;
      startWorkflow: (workflowId: WorkflowId) => unknown;
      advance: (milliseconds: number) => unknown;
      approve: (approvalId: string, approved: boolean) => unknown;
    };
  }

  interface Document {
    modelContext?: {
      registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void> | void;
    };
  }
}

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css";
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const TOKYO_CENTER: [number, number] = [139.7544, 35.6762];
const TOKYO_ZOOM = 12.45;

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

const ACTIONS: ExternalAction[] = ["reserve_capacity", "authorize_payment", "release_shipment", "send_customer_update"];
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
    const finish = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("MapLibre loaded without a browser map object."));
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

function agentGeoJson(world: AtlasWorldState, selectedAgentId: string | null): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: world.agents.map((agent) => ({
      type: "Feature",
      properties: { id: agent.id, name: agent.name, role: agent.role, side: agent.side, status: agent.status, selected: agent.id === selectedAgentId ? 1 : 0 },
      geometry: { type: "Point", coordinates: [agent.position.lon, agent.position.lat] },
    })),
  };
}

function routeGeoJson(world: AtlasWorldState): GeoJsonFeatureCollection {
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

function addAtlasLayers(map: MapLibreMap, world: AtlasWorldState) {
  map.addSource("atlas-routes", { type: "geojson", data: routeGeoJson(world) });
  map.addSource("atlas-messages", { type: "geojson", data: messageGeoJson(world) });
  map.addSource("atlas-agents", { type: "geojson", data: agentGeoJson(world, null) });
  map.addLayer({ id: "atlas-route-shadow", type: "line", source: "atlas-routes", paint: { "line-color": "rgba(247,243,233,0.92)", "line-width": 6, "line-opacity": 0.7 } });
  map.addLayer({ id: "atlas-routes", type: "line", source: "atlas-routes", paint: { "line-color": sideColorExpression(), "line-width": 2.2, "line-opacity": 0.72, "line-dasharray": [2, 2.2] } });
  map.addLayer({ id: "atlas-messages", type: "line", source: "atlas-messages", paint: { "line-color": sideColorExpression(), "line-width": 1.35, "line-opacity": 0.42, "line-dasharray": [0.7, 1.6] } });
  map.addLayer({
    id: "atlas-agent-halo",
    type: "circle",
    source: "atlas-agents",
    paint: {
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 19, ["==", ["get", "status"], "moving"], 14, 11],
      "circle-color": sideColorExpression(),
      "circle-opacity": ["case", ["==", ["get", "status"], "idle"], 0.08, 0.16],
      "circle-blur": 0.18,
    },
  });
  map.addLayer({
    id: "atlas-agents",
    type: "circle",
    source: "atlas-agents",
    paint: {
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 9, ["==", ["get", "status"], "idle"], 5.4, 6.8],
      "circle-color": sideColorExpression(),
      "circle-opacity": ["case", ["==", ["get", "status"], "idle"], 0.66, 0.96],
      "circle-stroke-color": "#F7F3E9",
      "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 2.2, 1.25],
    },
  });
  map.addLayer({
    id: "atlas-agent-labels",
    type: "symbol",
    source: "atlas-agents",
    minzoom: 12.25,
    layout: { "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top", "text-allow-overlap": false },
    paint: { "text-color": "#33312D", "text-halo-color": "rgba(247,243,233,0.96)", "text-halo-width": 2 },
  });
}

function syncAtlasSources(map: MapLibreMap, world: AtlasWorldState, selectedAgentId: string | null) {
  map.getSource("atlas-agents")?.setData(agentGeoJson(world, selectedAgentId));
  map.getSource("atlas-routes")?.setData(routeGeoJson(world));
  map.getSource("atlas-messages")?.setData(messageGeoJson(world));
}

function phaseLabel(world: AtlasWorldState) {
  if (world.phase === "idle") return "Ready";
  if (world.phase === "running") return "Coordinating";
  if (world.phase === "waiting_approval") return "Waiting for you";
  if (world.phase === "completed") return "Completed";
  return "Blocked";
}

export function AsymptaWorldExperience() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [world, setWorld] = useState<AtlasWorldState>(() => createAtlasWorld());
  const worldRef = useRef<AtlasWorldState>(world);
  const lastFollowRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [webMcpState, setWebMcpState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>("agent-user");
  const [cameraFollow, setCameraFollow] = useState(false);

  const apply = useCallback((change: (current: AtlasWorldState) => AtlasWorldState) => {
    const next = change(worldRef.current);
    worldRef.current = next;
    setWorld(next);
    return next;
  }, []);

  const startWorkflow = useCallback((workflowId: WorkflowId) => {
    const next = apply((current) => startAtlasWorkflow(current, workflowId));
    const firstActive = next.agents.find((agent) => agent.status !== "idle");
    if (firstActive) setSelectedAgentId(firstActive.id);
    return next;
  }, [apply]);

  const resetWorld = useCallback(() => {
    const next = apply((current) => createAtlasWorld(current.now));
    setSelectedAgentId("agent-user");
    setCameraFollow(false);
    return next;
  }, [apply]);

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
          addAtlasLayers(map, worldRef.current);
          syncAtlasSources(map, worldRef.current, null);
          setMapReady(true);
        });
        map.on("click", "atlas-agents", (event) => {
          const id = String(event.features?.[0]?.properties?.id ?? "");
          if (!id) return;
          setSelectedAgentId(id);
          setCameraFollow(true);
        });
        map.on("mouseenter", "atlas-agents", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "atlas-agents", () => { map.getCanvas().style.cursor = "grab"; });
      })
      .catch((reason: unknown) => {
        if (!disposed) setMapError(reason instanceof Error ? reason.message : "The map could not be loaded.");
      });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    syncAtlasSources(mapRef.current, world, selectedAgentId);
  }, [mapReady, selectedAgentId, world]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    const animate = (now: number) => {
      const elapsed = Math.min(120, Math.max(0, now - previous));
      previous = now;
      accumulator += elapsed;
      if (accumulator >= 50) {
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
    if (now - lastFollowRef.current < 150) return;
    lastFollowRef.current = now;
    mapRef.current.easeTo({ center: [agent.position.lon, agent.position.lat], duration: 130, essential: true });
  }, [cameraFollow, mapReady, selectedAgentId, world]);

  useEffect(() => {
    const controller = new AbortController();
    const modelContext = document.modelContext;
    if (!modelContext) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setWebMcpState("unavailable");
      });
      return () => controller.abort();
    }

    const workflowIds = ATLAS_WORKFLOWS.map((workflow) => workflow.id);
    const agentIds = ATLAS_AGENTS.map((agent) => agent.id);
    const readOnly = { readOnlyHint: true, untrustedContentHint: false };
    const mutating = { readOnlyHint: false, untrustedContentHint: true };
    const tools: WebMcpTool[] = [
      {
        name: "asympta_observe_coordination_atlas",
        description: "Read the current Asympta World coordination state, moving agents, dependency tasks, messages and pending human approvals without changing anything.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => ({ ok: true, world: atlasSnapshot(worldRef.current) }),
      },
      {
        name: "asympta_list_workflows",
        description: "List the available multi-stakeholder simulation workflows and what each one coordinates.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => ({ ok: true, workflows: ATLAS_WORKFLOWS.map((workflow) => ({ id: workflow.id, name: workflow.name, summary: workflow.summary })) }),
      },
      {
        name: "asympta_request_workflow",
        description: "Request that Asympta World start a multi-agent workflow. This never starts immediately from WebMCP: it creates a visible approval request and waits for the user to allow it.",
        inputSchema: { type: "object", properties: { workflowId: { type: "string", enum: workflowIds } }, required: ["workflowId"], additionalProperties: false },
        annotations: mutating,
        execute: async (input) => {
          const workflowId = String(input.workflowId ?? "") as WorkflowId;
          if (!workflowIds.includes(workflowId)) return { ok: false, error: "Unknown workflow." };
          const next = apply((current) => requestWebMcpWorkflow(current, workflowId));
          const approval = [...next.approvals].reverse().find((item) => item.kind === "webmcp-start" && item.workflowId === workflowId && item.status === "pending");
          return { ok: true, queuedForHumanApproval: true, approvalId: approval?.id ?? null };
        },
      },
      {
        name: "asympta_request_external_action",
        description: "Request a consequential coordination action such as reserving capacity, authorising simulated payment, releasing simulated shipment, or sending a simulated customer update. The action is always queued for explicit user approval before simulation advances.",
        inputSchema: {
          type: "object",
          properties: { action: { type: "string", enum: ACTIONS }, agentId: { type: "string", enum: agentIds }, reason: { type: "string", minLength: 3, maxLength: 220 } },
          required: ["action", "agentId", "reason"],
          additionalProperties: false,
        },
        annotations: mutating,
        execute: async (input) => {
          const action = String(input.action ?? "") as ExternalAction;
          const agentId = String(input.agentId ?? "");
          const reason = String(input.reason ?? "").trim();
          if (!ACTIONS.includes(action) || !agentIds.includes(agentId) || reason.length < 3) return { ok: false, error: "Invalid action request." };
          const next = apply((current) => requestWebMcpAction(current, action, agentId, reason));
          const approval = [...next.approvals].reverse().find((item) => item.status === "pending" && item.actionType === action);
          return { ok: true, queuedForHumanApproval: true, approvalId: approval?.id ?? null };
        },
      },
      {
        name: "asympta_follow_agent",
        description: "Focus the map camera on one simulation agent and keep tracking that agent as it moves. This changes only the local visual camera.",
        inputSchema: { type: "object", properties: { agentId: { type: "string", enum: agentIds } }, required: ["agentId"], additionalProperties: false },
        annotations: readOnly,
        execute: async (input) => {
          const agentId = String(input.agentId ?? "");
          if (!agentIds.includes(agentId)) return { ok: false, error: "Unknown agent." };
          setSelectedAgentId(agentId);
          setCameraFollow(true);
          return { ok: true, following: agentId };
        },
      },
    ];

    Promise.all(tools.map((tool) => Promise.resolve().then(() => modelContext.registerTool(tool, { signal: controller.signal }))))
      .then(() => setWebMcpState("ready"))
      .catch(() => setWebMcpState("unavailable"));
    return () => controller.abort();
  }, [apply]);

  useEffect(() => {
    window.__ASYMPTA_ATLAS__ = {
      snapshot: () => atlasSnapshot(worldRef.current),
      startWorkflow: (workflowId) => atlasSnapshot(startWorkflow(workflowId)),
      advance: (milliseconds) => atlasSnapshot(apply((current) => advanceAtlasWorld(current, milliseconds))),
      approve: (approvalId, approved) => atlasSnapshot(apply((current) => resolveAtlasApproval(current, approvalId, approved))),
    };
    return () => { delete window.__ASYMPTA_ATLAS__; };
  }, [apply, startWorkflow]);

  const pendingApproval = world.approvals.find((approval) => approval.status === "pending") ?? null;
  const selectedAgent = world.agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const selectedTask = selectedAgent ? world.tasks.find((task) => task.agentId === selectedAgent.id && ["moving", "working", "waiting_approval"].includes(task.status)) : undefined;
  const completedTasks = world.tasks.filter((task) => task.status === "done").length;
  const progress = world.tasks.length ? completedTasks / world.tasks.length : 0;
  const activeWorkflow = world.workflowId ? workflowFor(world.workflowId) : null;
  const recenter = () => mapRef.current?.flyTo({ center: TOKYO_CENTER, zoom: TOKYO_ZOOM, bearing: 0, pitch: 0, duration: 650, essential: true });

  return (
    <main className="map-app" data-map-app="true" data-map-style="paper-agent-coordination-atlas">
      <div ref={mapContainerRef} className="map-canvas" role="application" aria-label="Interactive paper map with autonomous stakeholder agent coordination" />
      <div className="map-paper-wash" aria-hidden="true" />
      <div className="map-paper-grain" aria-hidden="true" />

      <section className="atlas-console" aria-label="Coordination workflows">
        <div className="atlas-console__head">
          <div><div className="atlas-eyebrow">ASYMPTA WORLD</div><div className="atlas-title">Coordination Atlas</div></div>
          <span className={`atlas-phase atlas-phase--${world.phase}`}>{phaseLabel(world)}</span>
        </div>
        <div className="atlas-tool-state"><span className={`atlas-tool-dot atlas-tool-dot--${webMcpState}`} />{webMcpState === "ready" ? "WebMCP ready" : webMcpState === "checking" ? "Checking WebMCP" : "WebMCP browser API unavailable"}</div>
        <div className="atlas-workflows">
          {ATLAS_WORKFLOWS.map((workflow) => (
            <button key={workflow.id} type="button" className={`atlas-workflow${world.workflowId === workflow.id ? " is-active" : ""}`} onClick={() => startWorkflow(workflow.id)}>
              <strong>{workflow.shortName}</strong><span>{workflow.summary}</span>
            </button>
          ))}
        </div>
        {activeWorkflow ? (
          <div className="atlas-progress-block">
            <div className="atlas-progress-copy"><span>{activeWorkflow.name}</span><span>{completedTasks}/{world.tasks.length}</span></div>
            <div className="atlas-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <button type="button" className="atlas-reset" onClick={resetWorld}><RotateCcw size={13} /> Reset</button>
          </div>
        ) : null}
      </section>

      <section className="atlas-sides" aria-label="Stakeholder agents">
        {(Object.keys(SIDE_LABELS) as StakeholderSide[]).map((side) => <span key={side}><i style={{ background: SIDE_COLORS[side] }} />{SIDE_LABELS[side]}</span>)}
      </section>

      {world.events.length ? (
        <aside className="atlas-stream" aria-label="Coordination stream">
          <div className="atlas-stream__title">Live coordination</div>
          {world.events.slice(0, 4).map((event) => <div className="atlas-event" key={event.id}><strong>{event.title}</strong><span>{event.detail}</span></div>)}
        </aside>
      ) : null}

      {selectedAgent ? (
        <aside className="atlas-agent-card" aria-live="polite">
          <div className="atlas-agent-card__top">
            <span className="atlas-agent-dot" style={{ background: SIDE_COLORS[selectedAgent.side] }} />
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
          <div className="atlas-approval__eyebrow">{pendingApproval.source === "webmcp" ? "WEBMCP REQUEST" : "HUMAN CHECKPOINT"}</div>
          <strong>{pendingApproval.title}</strong>
          <p>{pendingApproval.detail}</p>
          <small>{pendingApproval.consequence}</small>
          <div className="atlas-approval__actions">
            <button type="button" className="atlas-decline" onClick={() => apply((current) => resolveAtlasApproval(current, pendingApproval.id, false))}>Decline</button>
            <button type="button" className="atlas-allow" onClick={() => apply((current) => resolveAtlasApproval(current, pendingApproval.id, true))}>Allow simulated action</button>
          </div>
        </aside>
      ) : null}

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 220 })}><Plus size={18} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 220 })}><Minus size={18} /></button>
      </div>
      <button type="button" className="map-control map-control--locate" aria-label="Recenter map" onClick={recenter}><LocateFixed size={18} strokeWidth={1.8} /></button>
      {!mapReady && !mapError ? <div className="map-status">Drawing the street atlas…</div> : null}
      {mapError ? <div className="map-status map-status--error">{mapError}</div> : null}
    </main>
  );
}

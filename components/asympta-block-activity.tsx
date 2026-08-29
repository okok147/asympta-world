"use client";

import { useEffect } from "react";

type Point = { x: number; y: number };
type Geometry = { type: string; coordinates: unknown };
type StyleLayer = { id: string; type?: string };
type RenderedFeature = {
  id?: string | number;
  source?: string;
  sourceLayer?: string;
  properties?: Record<string, unknown> | null;
  geometry?: Geometry;
};

type ActivityFeature = {
  type: "Feature";
  properties: { color: string; opacity: number };
  geometry: Geometry;
};

type ActivityCollection = {
  type: "FeatureCollection";
  features: ActivityFeature[];
};

type GeoJsonSource = { setData(data: ActivityCollection): void };

type ActivityMap = {
  getStyle(): { layers?: StyleLayer[] };
  getSource(id: string): GeoJsonSource | undefined;
  addSource(id: string, source: { type: "geojson"; data: ActivityCollection }): void;
  getLayer(id: string): unknown;
  addLayer(layer: Record<string, unknown>, beforeId?: string): void;
  project(lngLat: [number, number]): Point;
  queryRenderedFeatures(
    box: [[number, number], [number, number]],
    options?: { layers?: string[] },
  ): RenderedFeature[];
};

type AgentSnapshot = { id: string; status: string; lon: number; lat: number };
type AmbientAgentSnapshot = {
  id: string;
  status: string;
  position?: { lon?: number; lat?: number };
};
type DemoSnapshot = {
  foreground?: {
    agents?: AgentSnapshot[];
  };
  ambient?: AmbientAgentSnapshot[];
};

type ActivityAgent = { id: string; status: string; lon: number; lat: number };
type ActivityBlock = {
  geometry: Geometry;
  color: string;
  lastActiveAt: number;
};

const SOURCE_ID = "asympta-activity-blocks";
const LAYER_ID = "asympta-activity-blocks-fill";
const ACTIVITY_REFRESH_MS = 900;
const ACTIVITY_HOLD_MS = 1_900;
const ACTIVITY_FADE_MS = 8_500;
const QUERY_RADIUS_PX = 11;
const MAX_ACTIVE_AGENTS = 24;
const MAX_BLOCKS_PER_AGENT = 1;
const MAX_ACTIVITY_BLOCKS = 20;
const MAX_BLOCK_SPAN_DEGREES = 0.0011;
const MAX_OPACITY = 0.30;

const ACTIVITY_COLORS = [
  "#7183AA",
  "#698B5D",
  "#C56F4A",
  "#A06D93",
  "#9B7A45",
  "#4E8E89",
] as const;

const ACTIVE_AGENT_STATUSES = new Set(["moving", "working", "sharing", "waiting", "returning"]);
const ACTIVE_AMBIENT_STATUSES = new Set(["moving", "working"]);

function emptyCollection(): ActivityCollection {
  return { type: "FeatureCollection", features: [] };
}

function firstCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return [value[0], value[1]];
  }
  for (const item of value) {
    const found = firstCoordinate(item);
    if (found) return found;
  }
  return null;
}

function geometryFitsBudget(geometry: Geometry) {
  const bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      bounds.minLon = Math.min(bounds.minLon, value[0]);
      bounds.maxLon = Math.max(bounds.maxLon, value[0]);
      bounds.minLat = Math.min(bounds.minLat, value[1]);
      bounds.maxLat = Math.max(bounds.maxLat, value[1]);
      return;
    }
    for (const item of value) visit(item);
  };
  visit(geometry.coordinates);
  if (!Number.isFinite(bounds.minLon) || !Number.isFinite(bounds.minLat)) return false;
  return (bounds.maxLon - bounds.minLon) <= MAX_BLOCK_SPAN_DEGREES
    && (bounds.maxLat - bounds.minLat) <= MAX_BLOCK_SPAN_DEGREES;
}

function usableGeometry(feature: RenderedFeature): Geometry | null {
  const geometry = feature.geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return null;
  if (!geometryFitsBudget(geometry)) return null;
  return geometry;
}

function featureKey(feature: RenderedFeature) {
  const properties = feature.properties ?? {};
  const identity = feature.id ?? properties.osm_id ?? properties.id ?? properties.fid ?? properties["@id"];
  if (identity !== undefined && identity !== null) return `${feature.source ?? "source"}:${String(identity)}`;
  const anchor = firstCoordinate(feature.geometry?.coordinates);
  const anchorKey = anchor ? `${anchor[0].toFixed(5)},${anchor[1].toFixed(5)}` : "unknown";
  return `${feature.sourceLayer ?? feature.source ?? "building"}:${anchorKey}`;
}

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function blockOpacity(ageMs: number) {
  if (ageMs <= ACTIVITY_HOLD_MS) return MAX_OPACITY;
  const fadeProgress = (ageMs - ACTIVITY_HOLD_MS) / ACTIVITY_FADE_MS;
  return Math.max(0, MAX_OPACITY * (1 - fadeProgress));
}

function mapWindow() {
  return window as unknown as {
    __ASYMPTA_MAP__?: ActivityMap;
    __ASYMPTA_DEMO__?: { snapshot: () => unknown };
  };
}

function buildingLayers(map: ActivityMap) {
  return (map.getStyle()?.layers ?? [])
    .filter((layer) => (layer.type === "fill" || layer.type === "fill-extrusion") && /building|structure/i.test(layer.id))
    .map((layer) => layer.id);
}

function ensureOverlay(map: ActivityMap) {
  if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: "geojson", data: emptyCollection() });
  if (map.getLayer(LAYER_ID)) return;
  const beforeId = (map.getStyle()?.layers ?? []).find((layer) => layer.type === "symbol")?.id;
  map.addLayer({
    id: LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    minzoom: 11,
    paint: {
      "fill-color": ["coalesce", ["get", "color"], "#DDD8CC"],
      "fill-opacity": ["coalesce", ["get", "opacity"], 0],
      "fill-outline-color": "rgba(67, 63, 56, 0.07)",
    },
  }, beforeId);
}

function activeAgents(snapshot: DemoSnapshot): ActivityAgent[] {
  const foreground = (snapshot.foreground?.agents ?? [])
    .filter((agent) => ACTIVE_AGENT_STATUSES.has(agent.status))
    .filter((agent) => Number.isFinite(agent.lon) && Number.isFinite(agent.lat))
    .map((agent) => ({ id: agent.id, status: agent.status, lon: agent.lon, lat: agent.lat }));

  const ambient = (snapshot.ambient ?? [])
    .filter((agent) => ACTIVE_AMBIENT_STATUSES.has(agent.status))
    .map((agent) => ({
      id: agent.id,
      status: agent.status,
      lon: Number(agent.position?.lon),
      lat: Number(agent.position?.lat),
    }))
    .filter((agent) => Number.isFinite(agent.lon) && Number.isFinite(agent.lat));

  // Camera selection and stakeholder side never affect eligibility. Every visible active
  // foreground or ambient agent gets the same chance to colour one nearby map block.
  const seen = new Set<string>();
  const combined: ActivityAgent[] = [];
  for (const agent of [...foreground, ...ambient]) {
    if (seen.has(agent.id)) continue;
    seen.add(agent.id);
    combined.push(agent);
    if (combined.length >= MAX_ACTIVE_AGENTS) break;
  }
  return combined;
}

function trimOldest(blocks: Map<string, ActivityBlock>) {
  if (blocks.size <= MAX_ACTIVITY_BLOCKS) return;
  const oldest = [...blocks.entries()].sort((a, b) => a[1].lastActiveAt - b[1].lastActiveAt);
  for (let index = 0; index < oldest.length - MAX_ACTIVITY_BLOCKS; index += 1) blocks.delete(oldest[index][0]);
}

export function AsymptaBlockActivity() {
  useEffect(() => {
    let activeMap: ActivityMap | null = null;
    let cachedBuildingLayers: string[] = [];
    const blocks = new Map<string, ActivityBlock>();

    const tick = () => {
      if (document.hidden) return;
      const bridge = mapWindow();
      const map = bridge.__ASYMPTA_MAP__;
      if (!map) return;

      if (map !== activeMap) {
        activeMap = map;
        cachedBuildingLayers = [];
        blocks.clear();
      }

      try {
        if (!cachedBuildingLayers.length) cachedBuildingLayers = buildingLayers(map);
        if (!cachedBuildingLayers.length) return;
        ensureOverlay(map);

        let snapshot: DemoSnapshot = {};
        try {
          snapshot = (bridge.__ASYMPTA_DEMO__?.snapshot() ?? {}) as DemoSnapshot;
        } catch {}

        const now = performance.now();
        for (const agent of activeAgents(snapshot)) {
          const point = map.project([agent.lon, agent.lat]);
          const box: [[number, number], [number, number]] = [
            [point.x - QUERY_RADIUS_PX, point.y - QUERY_RADIUS_PX],
            [point.x + QUERY_RADIUS_PX, point.y + QUERY_RADIUS_PX],
          ];
          const features = map.queryRenderedFeatures(box, { layers: cachedBuildingLayers });
          let accepted = 0;
          for (const feature of features) {
            if (accepted >= MAX_BLOCKS_PER_AGENT) break;
            const geometry = usableGeometry(feature);
            if (!geometry) continue;
            const key = featureKey(feature);
            const existing = blocks.get(key);
            if (existing) {
              existing.geometry = geometry;
              existing.lastActiveAt = now;
            } else {
              blocks.set(key, {
                geometry,
                color: ACTIVITY_COLORS[hash(`${key}:${agent.id}`) % ACTIVITY_COLORS.length],
                lastActiveAt: now,
              });
            }
            accepted += 1;
          }
        }

        for (const [key, block] of blocks) {
          if (now - block.lastActiveAt > ACTIVITY_HOLD_MS + ACTIVITY_FADE_MS) blocks.delete(key);
        }
        trimOldest(blocks);

        const features: ActivityFeature[] = [...blocks.values()].map((block) => ({
          type: "Feature",
          properties: {
            color: block.color,
            opacity: Math.round(blockOpacity(now - block.lastActiveAt) * 1000) / 1000,
          },
          geometry: block.geometry,
        }));
        map.getSource(SOURCE_ID)?.setData({ type: "FeatureCollection", features });
      } catch {
        // This decorative layer must never interfere with the simulation or map controls.
      }
    };

    tick();
    const timer = window.setInterval(tick, ACTIVITY_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      try { activeMap?.getSource(SOURCE_ID)?.setData(emptyCollection()); } catch {}
    };
  }, []);

  return null;
}

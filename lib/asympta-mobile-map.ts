import land from "../public/mobile/ne-land-110m.json";
import { ATLAS_LOCATIONS } from "@/lib/atlas-simulation";

export const MOBILE_ASSET_ROOT = "/asympta-world/mobile";
const LOCAL_LAYERS = ["asympta-local-land", "asympta-local-coast", "asympta-local-connections", "asympta-local-places"];
const ONLINE_SOURCE = "asympta-mobile-pencil";
const ONLINE_LAYER = "asympta-mobile-pencil-base";
const TILEJSON = "https://papers.reearth.land/styles/paint-pencil-sketch/tilejson.json";

export type NativeMapEvent = {
  sourceId?: string;
  sourceDataType?: string;
  isSourceLoaded?: boolean;
  error?: Error;
};

export type NativeBasemapMap = {
  on(event: string, handler: (event: NativeMapEvent) => void): unknown;
  off(event: string, handler: (event: NativeMapEvent) => void): unknown;
  addSource(id: string, source: Record<string, unknown>): void;
  addLayer(layer: Record<string, unknown>, before?: string): void;
  getSource(id: string): unknown;
  getLayer(id: string): unknown;
  removeLayer(id: string): void;
  removeSource(id: string): void;
  setLayoutProperty(layer: string, property: string, value: unknown): void;
};

/** Bundled overview geography and explicitly schematic coordination paths. */
export function mobileMapStyle() {
  const places = Object.values(ATLAS_LOCATIONS);
  const connections = places.flatMap((place, index) => {
    const closest = places
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex, distance: Math.hypot(candidate.point.lon - place.point.lon, candidate.point.lat - place.point.lat) }))
      .filter((entry) => entry.candidateIndex !== index)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 2);
    return closest.filter((entry) => entry.candidateIndex > index).map(({ candidate }) => ({
      type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[place.point.lon, place.point.lat], [candidate.point.lon, candidate.point.lat]] },
    }));
  });
  return {
    version: 8,
    name: "Asympta bundled schematic world",
    sources: {
      "asympta-local-geography": { type: "geojson", data: land, attribution: '<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> · Asympta World' },
      "asympta-local-network": { type: "geojson", data: { type: "FeatureCollection", features: connections } },
      "asympta-local-nodes": { type: "geojson", data: { type: "FeatureCollection", features: places.map((place) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [place.point.lon, place.point.lat] } })) } },
    },
    layers: [
      { id: "asympta-local-paper", type: "background", paint: { "background-color": "#e8efed" } },
      { id: LOCAL_LAYERS[0], type: "fill", source: "asympta-local-geography", paint: { "fill-color": "#f1eee4", "fill-opacity": 1 } },
      { id: LOCAL_LAYERS[1], type: "line", source: "asympta-local-geography", paint: { "line-color": "#c9cbbb", "line-width": 0.9 } },
      { id: LOCAL_LAYERS[2], type: "line", source: "asympta-local-network", minzoom: 9, paint: { "line-color": "#c6bba5", "line-width": 1.7, "line-dasharray": [2, 3], "line-opacity": 0.6 } },
      { id: LOCAL_LAYERS[3], type: "circle", source: "asympta-local-nodes", minzoom: 10, paint: { "circle-radius": 5, "circle-color": "#e1ddca", "circle-stroke-color": "#c8bea8", "circle-stroke-width": 1 } },
    ],
  };
}

function publishBase(kind: "local" | "online") {
  document.documentElement.dataset.asymptaMobileMap = kind;
  window.dispatchEvent(new CustomEvent("asympta:mobile-map", { detail: { kind } }));
}

/** Local map is already usable before an optional online raster is requested. */
export function attachMobileOnlineMap(map: NativeBasemapMap) {
  let disposed = false;
  let controller: AbortController | null = null;
  let timer = 0;
  let loading = false;
  let hasRaster = false;

  const showLocalBase = () => {
    hasRaster = false;
    for (const layer of LOCAL_LAYERS) if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", "visible");
    if (map.getLayer(ONLINE_LAYER)) map.removeLayer(ONLINE_LAYER);
    if (map.getSource(ONLINE_SOURCE)) map.removeSource(ONLINE_SOURCE);
    publishBase("local");
  };
  const showOnlineBase = (event: NativeMapEvent) => {
    if (disposed || event.sourceId !== ONLINE_SOURCE || event.sourceDataType !== "content" || !event.isSourceLoaded || !map.getLayer(ONLINE_LAYER)) return;
    hasRaster = true;
    window.clearTimeout(timer);
    for (const layer of LOCAL_LAYERS) if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", "none");
    publishBase("online");
  };
  const failOnline = (event: NativeMapEvent) => {
    if (disposed || event.sourceId !== ONLINE_SOURCE) return;
    window.clearTimeout(timer);
    showLocalBase();
  };
  const tryOnline = async () => {
    if (disposed || loading || hasRaster || !navigator.onLine) return;
    loading = true;
    controller?.abort();
    controller = new AbortController();
    timer = window.setTimeout(() => { controller?.abort(); if (!disposed && !hasRaster) showLocalBase(); }, 8_000);
    try {
      const response = await fetch(TILEJSON, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error("Map unavailable");
      const tilejson = await response.json() as { tiles?: unknown; attribution?: unknown };
      const tiles = Array.isArray(tilejson.tiles) ? tilejson.tiles.filter((tile): tile is string => typeof tile === "string" && tile.startsWith("https://papers.reearth.land/")) : [];
      if (disposed || controller.signal.aborted || tiles.length === 0) return;
      // Attribution is fixed to the provider we request; remote HTML is not trusted.
      map.addSource(ONLINE_SOURCE, { type: "raster", tiles, tileSize: 512, minzoom: 0, maxzoom: 20, attribution: '<a href="https://papers.reearth.land/attribution">Re:Earth Papers</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
      map.addLayer({ id: ONLINE_LAYER, type: "raster", source: ONLINE_SOURCE, paint: { "raster-opacity": 1, "raster-fade-duration": 0 } }, LOCAL_LAYERS[0]);
    } catch {
      if (!disposed) showLocalBase();
    } finally {
      loading = false;
    }
  };
  const offline = () => { controller?.abort(); window.clearTimeout(timer); showLocalBase(); };
  map.on("sourcedata", showOnlineBase);
  map.on("error", failOnline);
  window.addEventListener("online", tryOnline);
  window.addEventListener("offline", offline);
  publishBase("local");
  void tryOnline();
  return () => {
    disposed = true;
    controller?.abort();
    window.clearTimeout(timer);
    map.off("sourcedata", showOnlineBase);
    map.off("error", failOnline);
    window.removeEventListener("online", tryOnline);
    window.removeEventListener("offline", offline);
  };
}

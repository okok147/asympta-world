"use client";

import { LocateFixed, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Category = "people" | "business" | "supply" | "infrastructure";

type Marker = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: Category;
  weight: number;
};

type MapFeature = {
  properties?: {
    id?: string;
    name?: string;
    category?: Category;
    weight?: number;
  };
};

type MapLayerEvent = {
  features?: MapFeature[];
};

type GeoJsonCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      id: string;
      name: string;
      category: Category;
      weight: number;
    };
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }>;
};

type MapLibreMap = {
  on(event: string, handler: () => void): void;
  on(event: string, layerId: string, handler: (event: MapLayerEvent) => void): void;
  addSource(id: string, source: { type: "geojson"; data: GeoJsonCollection }): void;
  addLayer(layer: Record<string, unknown>): void;
  setFilter(layerId: string, filter: unknown[] | null): void;
  flyTo(options: Record<string, unknown>): void;
  zoomIn(options?: Record<string, unknown>): void;
  zoomOut(options?: Record<string, unknown>): void;
  getCanvas(): HTMLCanvasElement;
  remove(): void;
  touchZoomRotate: {
    enable(): void;
    disableRotation(): void;
  };
  dragRotate: { disable(): void };
  touchPitch?: { disable(): void };
};

type MapLibreNamespace = {
  Map: new (options: Record<string, unknown>) => MapLibreMap;
};

declare global {
  interface Window {
    maplibregl?: MapLibreNamespace;
  }
}

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css";
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const TOKYO_CENTER: [number, number] = [139.7544, 35.6762];
const TOKYO_ZOOM = 13.25;

let mapLibrePromise: Promise<MapLibreNamespace> | null = null;

const MARKERS: Marker[] = [
  { id: "shinjuku", name: "Shinjuku", lat: 35.6938, lon: 139.7034, category: "people", weight: 28 },
  { id: "shibuya", name: "Shibuya", lat: 35.6595, lon: 139.7005, category: "people", weight: 25 },
  { id: "harajuku", name: "Harajuku", lat: 35.6702, lon: 139.7027, category: "people", weight: 18 },
  { id: "ikebukuro", name: "Ikebukuro", lat: 35.7295, lon: 139.7109, category: "people", weight: 20 },
  { id: "ueno", name: "Ueno", lat: 35.7138, lon: 139.7773, category: "people", weight: 17 },
  { id: "marunouchi", name: "Marunouchi", lat: 35.6812, lon: 139.7639, category: "business", weight: 34 },
  { id: "nihonbashi", name: "Nihonbashi", lat: 35.6837, lon: 139.7744, category: "business", weight: 19 },
  { id: "roppongi", name: "Roppongi", lat: 35.6628, lon: 139.7314, category: "business", weight: 22 },
  { id: "toranomon", name: "Toranomon", lat: 35.6671, lon: 139.7496, category: "business", weight: 24 },
  { id: "odaiba", name: "Odaiba", lat: 35.6273, lon: 139.7755, category: "business", weight: 15 },
  { id: "toyosu", name: "Toyosu", lat: 35.655, lon: 139.7967, category: "supply", weight: 18 },
  { id: "tsukiji", name: "Tsukiji", lat: 35.6655, lon: 139.7707, category: "supply", weight: 15 },
  { id: "shinagawa", name: "Shinagawa", lat: 35.6285, lon: 139.7387, category: "infrastructure", weight: 23 },
  { id: "tokyo-station", name: "Tokyo Station", lat: 35.6812, lon: 139.7671, category: "infrastructure", weight: 31 },
  { id: "hamamatsucho", name: "Hamamatsucho", lat: 35.6556, lon: 139.7568, category: "infrastructure", weight: 16 },
  { id: "haneda", name: "Haneda", lat: 35.5494, lon: 139.7798, category: "infrastructure", weight: 30 },
];

const CATEGORY_LABELS: Record<Category, string> = {
  people: "People",
  business: "Business",
  supply: "Supply",
  infrastructure: "Infrastructure",
};

const CATEGORY_COLORS: Record<Category, string> = {
  people: "#477FA8",
  business: "#C8744E",
  supply: "#6F8F62",
  infrastructure: "#796B9D",
};

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
    const finish = () => {
      if (window.maplibregl) resolve(window.maplibregl);
      else reject(new Error("Map engine loaded without a global MapLibre object."));
    };

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

function markerGeoJson(): GeoJsonCollection {
  return {
    type: "FeatureCollection",
    features: MARKERS.map((marker) => ({
      type: "Feature",
      properties: {
        id: marker.id,
        name: marker.name,
        category: marker.category,
        weight: marker.weight,
      },
      geometry: {
        type: "Point",
        coordinates: [marker.lon, marker.lat],
      },
    })),
  };
}

function categoryFilter(categories: Set<Category>) {
  return ["in", ["get", "category"], ["literal", Array.from(categories)]];
}

function applyCategoryFilter(map: MapLibreMap, categories: Set<Category>) {
  const filter = categoryFilter(categories);
  map.setFilter("activity-halo", filter);
  map.setFilter("activity-dots", filter);
  map.setFilter("activity-labels", filter);
}

function addVisualizerLayers(map: MapLibreMap) {
  map.addSource("activity", {
    type: "geojson",
    data: markerGeoJson(),
  });

  const colorExpression = [
    "match",
    ["get", "category"],
    "people", CATEGORY_COLORS.people,
    "business", CATEGORY_COLORS.business,
    "supply", CATEGORY_COLORS.supply,
    "infrastructure", CATEGORY_COLORS.infrastructure,
    "#56524A",
  ];

  map.addLayer({
    id: "activity-halo",
    type: "circle",
    source: "activity",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "weight"], 10, 12, 36, 25],
      "circle-color": colorExpression,
      "circle-opacity": 0.12,
      "circle-blur": 0.15,
    },
  });

  map.addLayer({
    id: "activity-dots",
    type: "circle",
    source: "activity",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "weight"], 10, 5.5, 36, 12],
      "circle-color": colorExpression,
      "circle-opacity": 0.93,
      "circle-stroke-color": "#F7F3E9",
      "circle-stroke-width": 1.35,
    },
  });

  map.addLayer({
    id: "activity-labels",
    type: "symbol",
    source: "activity",
    minzoom: 13.6,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, 1.25],
      "text-anchor": "top",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#3D3A35",
      "text-halo-color": "rgba(247,243,233,0.92)",
      "text-halo-width": 2,
    },
  });
}

export function AsymptaWorldExperience() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Marker | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => new Set<Category>(["people", "business", "supply", "infrastructure"]),
  );

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
          addVisualizerLayers(map);
          applyCategoryFilter(map, activeCategories);
          setReady(true);
        });

        map.on("click", "activity-dots", (event) => {
          const id = event.features?.[0]?.properties?.id;
          const marker = MARKERS.find((item) => item.id === id) ?? null;
          setSelected(marker);
        });

        map.on("mouseenter", "activity-dots", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "activity-dots", () => {
          map.getCanvas().style.cursor = "grab";
        });
      })
      .catch((reason: unknown) => {
        if (disposed) return;
        setError(reason instanceof Error ? reason.message : "The map could not be loaded.");
      });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    applyCategoryFilter(mapRef.current, activeCategories);
  }, [activeCategories, ready]);

  const toggleCategory = (category: Category) => {
    setActiveCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const recenter = () => {
    mapRef.current?.flyTo({
      center: TOKYO_CENTER,
      zoom: TOKYO_ZOOM,
      bearing: 0,
      pitch: 0,
      duration: 650,
      essential: true,
    });
  };

  return (
    <main className="map-app" data-map-app="true" data-map-style="paper-capital-atlas">
      <div
        ref={mapContainerRef}
        className="map-canvas"
        role="application"
        aria-label="Interactive paper-textured real-world street map visualizer"
      />
      <div className="map-paper-wash" aria-hidden="true" />
      <div className="map-paper-grain" aria-hidden="true" />

      <section className="map-legend" aria-label="Visualizer filters">
        <div className="map-legend__eyebrow">ASYMPTA WORLD</div>
        <div className="map-legend__title">Activity Atlas</div>
        <div className="map-legend__filters">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((category) => (
            <button
              key={category}
              type="button"
              className={`map-filter map-filter--${category}${activeCategories.has(category) ? " is-active" : ""}`}
              aria-pressed={activeCategories.has(category)}
              onClick={() => toggleCategory(category)}
            >
              <span className="map-filter__dot" />
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <aside className="map-selection" aria-live="polite">
          <button type="button" className="map-selection__close" aria-label="Close selection" onClick={() => setSelected(null)}>×</button>
          <span className={`map-selection__dot map-selection__dot--${selected.category}`} />
          <div>
            <strong>{selected.name}</strong>
            <small>{CATEGORY_LABELS[selected.category]} · activity {selected.weight}</small>
          </div>
        </aside>
      ) : null}

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 220 })}><Plus size={18} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 220 })}><Minus size={18} /></button>
      </div>

      <button type="button" className="map-control map-control--locate" aria-label="Recenter map" onClick={recenter}>
        <LocateFixed size={18} strokeWidth={1.8} />
      </button>

      {!ready && !error ? <div className="map-status">Drawing streets…</div> : null}
      {error ? <div className="map-status map-status--error">{error}</div> : null}
    </main>
  );
}

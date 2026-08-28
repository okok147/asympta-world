"use client";

import { LocateFixed, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

type Viewport = { width: number; height: number };
type Camera = { lat: number; lon: number; zoom: number };
type Drag = { pointerId: number; x: number; y: number; camera: Camera };
type Marker = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: "people" | "business" | "supply" | "infrastructure";
  weight: number;
};

const TILE_SIZE = 256;
const MIN_ZOOM = 1.5;
const MAX_ZOOM = 17;
const DEFAULT_CAMERA: Camera = { lat: 35.6762, lon: 139.6503, zoom: 10.6 };
const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 };

const MARKERS: Marker[] = [
  { id: "shinjuku", name: "Shinjuku", lat: 35.6938, lon: 139.7034, category: "people", weight: 28 },
  { id: "shibuya", name: "Shibuya", lat: 35.6595, lon: 139.7005, category: "people", weight: 25 },
  { id: "marunouchi", name: "Marunouchi", lat: 35.6812, lon: 139.7639, category: "business", weight: 34 },
  { id: "nihonbashi", name: "Nihonbashi", lat: 35.6837, lon: 139.7744, category: "business", weight: 19 },
  { id: "shinagawa", name: "Shinagawa", lat: 35.6285, lon: 139.7387, category: "infrastructure", weight: 23 },
  { id: "toyosu", name: "Toyosu", lat: 35.6550, lon: 139.7967, category: "supply", weight: 18 },
  { id: "haneda", name: "Haneda", lat: 35.5494, lon: 139.7798, category: "infrastructure", weight: 30 },
  { id: "ueno", name: "Ueno", lat: 35.7138, lon: 139.7773, category: "people", weight: 17 },
  { id: "ikebukuro", name: "Ikebukuro", lat: 35.7295, lon: 139.7109, category: "people", weight: 20 },
  { id: "odaiba", name: "Odaiba", lat: 35.6273, lon: 139.7755, category: "business", weight: 15 },
];

const CATEGORY_LABELS = {
  people: "People",
  business: "Business",
  supply: "Supply",
  infrastructure: "Infrastructure",
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lonToWorldX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToWorldY(lat: number, zoom: number) {
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const rad = (safeLat * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * TILE_SIZE * 2 ** zoom;
}

function worldXToLon(x: number, zoom: number) {
  return (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180;
}

function worldYToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function project(lat: number, lon: number, camera: Camera, viewport: Viewport) {
  const cx = lonToWorldX(camera.lon, camera.zoom);
  const cy = latToWorldY(camera.lat, camera.zoom);
  return {
    x: viewport.width / 2 + lonToWorldX(lon, camera.zoom) - cx,
    y: viewport.height / 2 + latToWorldY(lat, camera.zoom) - cy,
  };
}

function getTiles(camera: Camera, viewport: Viewport) {
  const tileZoom = Math.floor(camera.zoom);
  const scale = 2 ** (camera.zoom - tileZoom);
  const worldSize = TILE_SIZE * 2 ** tileZoom;
  const centerX = lonToWorldX(camera.lon, tileZoom);
  const centerY = latToWorldY(camera.lat, tileZoom);
  const widthAtTileZoom = viewport.width / scale;
  const heightAtTileZoom = viewport.height / scale;
  const left = centerX - widthAtTileZoom / 2;
  const top = centerY - heightAtTileZoom / 2;
  const minX = Math.floor(left / TILE_SIZE) - 1;
  const maxX = Math.floor((left + widthAtTileZoom) / TILE_SIZE) + 1;
  const minY = Math.max(0, Math.floor(top / TILE_SIZE) - 1);
  const maxY = Math.min(2 ** tileZoom - 1, Math.floor((top + heightAtTileZoom) / TILE_SIZE) + 1);
  const tiles: Array<{ key: string; x: number; y: number; z: number; left: number; top: number; size: number; urlX: number }> = [];
  const tileCount = 2 ** tileZoom;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const urlX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${tileZoom}-${x}-${y}`,
        x,
        y,
        z: tileZoom,
        urlX,
        left: viewport.width / 2 + (x * TILE_SIZE - centerX) * scale,
        top: viewport.height / 2 + (y * TILE_SIZE - centerY) * scale,
        size: TILE_SIZE * scale + 0.5,
      });
    }
  }

  return tiles;
}

export function AsymptaWorldExperience() {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [panning, setPanning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState(() => new Set<Marker["category"]>(["people", "business", "supply", "infrastructure"]));

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setViewport({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => getTiles(camera, viewport), [camera, viewport]);
  const visibleMarkers = useMemo(() => MARKERS.filter((marker) => activeCategories.has(marker.category)), [activeCategories]);

  const zoomAt = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const element = mapRef.current;
    const rect = element?.getBoundingClientRect();
    setCamera((previous) => {
      const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (!rect || clientX === undefined || clientY === undefined) return { ...previous, zoom };

      const oldCenterX = lonToWorldX(previous.lon, previous.zoom);
      const oldCenterY = latToWorldY(previous.lat, previous.zoom);
      const anchorX = oldCenterX + clientX - rect.left - rect.width / 2;
      const anchorY = oldCenterY + clientY - rect.top - rect.height / 2;
      const ratio = 2 ** (zoom - previous.zoom);
      const nextCenterX = anchorX * ratio - (clientX - rect.left - rect.width / 2);
      const nextCenterY = anchorY * ratio - (clientY - rect.top - rect.height / 2);

      return {
        zoom,
        lon: worldXToLon(nextCenterX, zoom),
        lat: worldYToLat(nextCenterY, zoom),
      };
    });
  }, []);

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomAt(camera.zoom + (event.deltaY < 0 ? 0.55 : -0.55), event.clientX, event.clientY);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera };
    setPanning(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const cx = lonToWorldX(drag.camera.lon, drag.camera.zoom) - dx;
    const cy = latToWorldY(drag.camera.lat, drag.camera.zoom) - dy;
    setCamera({
      ...drag.camera,
      lon: worldXToLon(cx, drag.camera.zoom),
      lat: worldYToLat(cy, drag.camera.zoom),
    });
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    setPanning(false);
  };

  const toggleCategory = (category: Marker["category"]) => {
    setActiveCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <main className="map-app" data-map-app="true" data-map-style="real-map-visualizer">
      <div
        ref={mapRef}
        className={`map-canvas${panning ? " is-panning" : ""}`}
        role="application"
        aria-label="Interactive real-world map visualizer"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div className="map-tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              className="map-tile"
              src={`https://a.basemaps.cartocdn.com/dark_all/${tile.z}/${tile.urlX}/${tile.y}@2x.png`}
              alt=""
              draggable={false}
              style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }}
            />
          ))}
        </div>

        <svg className="map-overlay" width={viewport.width} height={viewport.height} viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-hidden="true">
          {visibleMarkers.map((marker) => {
            const point = project(marker.lat, marker.lon, camera, viewport);
            const radius = clamp(5 + Math.sqrt(marker.weight) * 1.5, 8, 18);
            const isSelected = selected === marker.id;
            return (
              <g
                key={marker.id}
                className={`map-node map-node--${marker.category}${isSelected ? " is-selected" : ""}`}
                transform={`translate(${point.x} ${point.y})`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setSelected(marker.id)}
              >
                <circle r={radius + 5} className="map-node-halo" />
                <circle r={radius} className="map-node-core" />
                {(camera.zoom >= 11.4 || isSelected) && <text x={radius + 8} y="4">{marker.name}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <section className="map-legend" aria-label="Visualizer filters">
        <div className="map-legend__eyebrow">ASYMPTA WORLD</div>
        <div className="map-legend__title">Tokyo activity map</div>
        <div className="map-legend__filters">
          {(Object.keys(CATEGORY_LABELS) as Array<Marker["category"]>).map((category) => (
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

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => zoomAt(camera.zoom + 1)}><Plus size={18} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomAt(camera.zoom - 1)}><Minus size={18} /></button>
      </div>

      <button type="button" className="map-control map-control--locate" aria-label="Recenter map" onClick={() => setCamera(DEFAULT_CAMERA)}>
        <LocateFixed size={18} strokeWidth={1.8} />
      </button>

      <div className="map-attribution">© OpenStreetMap contributors · © CARTO</div>
    </main>
  );
}

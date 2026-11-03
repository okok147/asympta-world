"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { creatureSvg, type CreatureKind } from "@/lib/world-creatures";

type Coordinates = [number, number];
type MapMarker = {
  setLngLat(position: Coordinates): MapMarker;
  addTo(map: WorldMap): MapMarker;
  remove(): void;
};
type WorldMap = {
  on(name: string, handler: (...args: unknown[]) => void): WorldMap;
  flyTo(options: { center: Coordinates; zoom: number; duration: number; essential: boolean }): void;
  remove(): void;
};
type MapLibrary = {
  Map: new (options: Record<string, unknown>) => WorldMap;
  Marker: new (options: { element: HTMLElement; anchor: "bottom" | "center" }) => MapMarker;
};

declare global {
  interface Window {
    maplibregl?: MapLibrary;
  }
}

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css";
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const START_CENTER: Coordinates = [139.7608, 35.6804]; // Sample view: Tokyo, not the user's location.
const COMPANION_OFFSETS: readonly { kind: CreatureKind; eastKm: number; northKm: number }[] = [
  { kind: "fox", eastKm: -0.92, northKm: 0.59 },
  { kind: "bear", eastKm: 0.84, northKm: 0.76 },
  { kind: "bunny", eastKm: 0.88, northKm: -0.55 },
  { kind: "otter", eastKm: -0.76, northKm: -0.78 },
];

let libraryPromise: Promise<MapLibrary> | null = null;
function loadMapLibrary(): Promise<MapLibrary> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (libraryPromise) return libraryPromise;

  libraryPromise = new Promise<MapLibrary>((resolve, reject) => {
    if (!document.querySelector('link[data-asympta-map-css]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = MAPLIBRE_CSS;
      style.dataset.asymptaMapCss = "true";
      document.head.appendChild(style);
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = MAPLIBRE_JS;
    script.dataset.asymptaMapJs = "true";
    script.onload = () => {
      if (window.maplibregl) resolve(window.maplibregl);
      else reject(new Error("Map library did not initialize."));
    };
    script.onerror = () => reject(new Error("Map library could not be downloaded."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    document.querySelector('script[data-asympta-map-js]')?.remove();
    libraryPromise = null;
    throw error;
  });

  return libraryPromise;
}

function nearby(center: Coordinates, eastKm: number, northKm: number): Coordinates {
  const lat = Math.max(-85, Math.min(85, center[1] + northKm / 110.574));
  const lon = center[0] + eastKm / (111.32 * Math.max(0.09, Math.cos(center[1] * Math.PI / 180)));
  return [lon, lat];
}

function makeCreatureElement(kind: CreatureKind, index: number): HTMLElement {
  const element = document.createElement("div");
  element.className = "asympta-creature-marker asympta-creature-marker--" + kind;
  element.dataset.creature = kind;
  element.dataset.illustration = "true";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", "Illustrated " + kind + " character, not a live user");
  const drawing = document.createElement("span");
  drawing.className = "asympta-creature-marker__drawing";
  drawing.style.animationDelay = "-" + (index * 1.7) + "s";
  drawing.innerHTML = creatureSvg(kind); // Static, local markup: no user input.
  element.appendChild(drawing);
  return element;
}

function makeYouElement(): HTMLElement {
  const element = document.createElement("div");
  element.className = "asympta-you-marker";
  element.dataset.yourLocation = "true";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", "Your approximate current location");
  element.innerHTML = '<span class="asympta-you-marker__halo"></span><span class="asympta-you-marker__center"></span>';
  return element;
}

type LocationStatus = "idle" | "requesting" | "located" | "denied" | "unavailable" | "timeout";
type MapStatus = "loading" | "ready" | "error";

const MESSAGES: Record<LocationStatus, string> = {
  idle: "",
  requesting: "Finding your location…",
  located: "Location shown on this device only.",
  denied: "Location permission was not granted.",
  unavailable: "Location is unavailable on this device.",
  timeout: "Location timed out. Try again.",
};

export default function HomePage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  const mapLibraryRef = useRef<MapLibrary | null>(null);
  const companionsRef = useRef<MapMarker[]>([]);
  const youRef = useRef<MapMarker | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");

  useEffect(() => {
    let canceled = false;
    let localMap: WorldMap | null = null;
    const localCompanions: MapMarker[] = [];
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;

    void loadMapLibrary().then((library) => {
      if (canceled || !canvasRef.current) return;
      mapLibraryRef.current = library;

      const map = new library.Map({
        container: canvasRef.current,
        style: OPENFREEMAP_STYLE,
        center: START_CENTER,
        zoom: 13.1,
        minZoom: 2,
        maxZoom: 18,
        pitch: 0,
        dragRotate: false,
        touchPitch: false,
        maxPitch: 0,
        attributionControl: true,
        renderWorldCopies: false,
        fadeDuration: 0,
      });
      localMap = map;
      mapRef.current = map;

      COMPANION_OFFSETS.forEach(({ kind, eastKm, northKm }, index) => {
        const element = makeCreatureElement(kind, index);
        const marker = new library.Marker({ element, anchor: "bottom" })
          .setLngLat(nearby(START_CENTER, eastKm, northKm))
          .addTo(map);
        localCompanions.push(marker);
      });
      companionsRef.current = localCompanions;

      map.on("load", () => {
        if (canceled) return;
        if (loadTimeout) clearTimeout(loadTimeout);
        setMapStatus("ready");
      });
      loadTimeout = setTimeout(() => {
        if (!canceled) setMapStatus((current) => current === "loading" ? "error" : current);
      }, 18000);
    }).catch(() => {
      if (!canceled) setMapStatus("error");
    });

    return () => {
      canceled = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      localCompanions.forEach((marker) => marker.remove());
      companionsRef.current = [];
      youRef.current?.remove();
      youRef.current = null;
      localMap?.remove();
      mapRef.current = null;
      mapLibraryRef.current = null;
    };
  }, []);

  const locateMe = useCallback(() => {
    // Never obtain location until the person explicitly clicks the button.
    if (mapStatus !== "ready" || locationStatus === "requesting") return;
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = mapRef.current;
        const library = mapLibraryRef.current;
        if (!map || !library) {
          setLocationStatus("unavailable");
          return;
        }
        const point: Coordinates = [position.coords.longitude, position.coords.latitude];
        if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
          setLocationStatus("unavailable");
          return;
        }

        if (youRef.current) youRef.current.setLngLat(point);
        else {
          youRef.current = new library.Marker({ element: makeYouElement(), anchor: "center" })
            .setLngLat(point)
            .addTo(map);
        }

        // Companions are illustrative map characters, not location-sharing users.
        companionsRef.current.forEach((marker, index) => {
          const companion = COMPANION_OFFSETS[index];
          marker.setLngLat(nearby(point, companion.eastKm, companion.northKm));
        });
        map.flyTo({
          center: point,
          zoom: 14.7,
          duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1000,
          essential: true,
        });
        setLocationStatus("located");
      },
      (error) => {
        if (error.code === 1) setLocationStatus("denied");
        else if (error.code === 3) setLocationStatus("timeout");
        else setLocationStatus("unavailable");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10000 },
    );
  }, [mapStatus, locationStatus]);

  return (
    <main className="asympta-map-world" data-map-status={mapStatus} data-location-status={locationStatus}>
      <div
        ref={canvasRef}
        id="asympta-real-map"
        className="asympta-real-map"
        role="region"
        aria-label="Interactive real-world map, move and zoom to explore"
      />
      {mapStatus === "loading" && (
        <p className="asympta-map-message" role="status">Opening the map…</p>
      )}
      {mapStatus === "error" && (
        <p className="asympta-map-message asympta-map-message--error" role="alert">
          Map is unavailable. Check your connection and reload.
        </p>
      )}
      <button
        className="asympta-locate-button"
        type="button"
        onClick={locateMe}
        disabled={mapStatus !== "ready" || locationStatus === "requesting"}
        aria-label="Show my location on the map"
        title="Show my location on the map"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
        <span>My location</span>
      </button>
      {locationStatus !== "idle" && (
        <output className="asympta-location-feedback" aria-live="polite">
          {MESSAGES[locationStatus]}
        </output>
      )}
      <p className="asympta-map-disclosure">Illustrated companions · not live users</p>
    </main>
  );
}

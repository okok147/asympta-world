"use client";

import { useEffect } from "react";

type StyleLayer = { id: string; type?: string };
type PaperMap = {
  getStyle(): { layers?: StyleLayer[] };
  setPaintProperty(layerId: string, property: string, value: unknown): void;
  setLayoutProperty(layerId: string, property: string, value: unknown): void;
  getPixelRatio?: () => number;
  setPixelRatio?: (ratio: number) => void;
};

const PAPER = {
  base: "#EEEDE6",
  water: "#DDE3E0",
  building: "#DDD8CC",
  land: "#E8E4DB",
  green: "#E3E7DD",
  road: "#CBC5B9",
  roadMajor: "#BDB6A9",
  rail: "#C4BEB2",
  boundary: "#CEC8BC",
  text: "#666159",
  halo: "#F3F0E8",
} as const;

const RETRY_MS = 650;
const MAX_ATTEMPTS = 24;
const MAX_MAP_PIXEL_RATIO = 2;

const NOISY_SYMBOL = /poi|point.?of.?interest|housenumber|house.?number|address|amenity|shop|store|restaurant|cafe|bar|school|college|university|hospital|clinic|parking|entrance|barrier|bus.?stop|platform|airport|aerodrome|building.?label/i;
const MINOR_ROUTE = /footway|footpath|path|steps|pedestrian|cycleway|cycle|bridle|track|service.?road|minor.?road|construction/i;

function mapWindow() {
  return window as unknown as { __ASYMPTA_MAP__?: PaperMap };
}

function paint(map: PaperMap, id: string, property: string, value: unknown) {
  try {
    map.setPaintProperty(id, property, value);
  } catch {
    // Some style layers do not expose every paint property. Ignore them.
  }
}

function layout(map: PaperMap, id: string, property: string, value: unknown) {
  try {
    map.setLayoutProperty(id, property, value);
  } catch {
    // Layout support differs between style layer types.
  }
}

function isAsymptaLayer(id: string) {
  return id.startsWith("atlas-") || id.startsWith("asympta-");
}

function simplifyLayer(map: PaperMap, layer: StyleLayer) {
  const id = String(layer.id ?? "");
  const key = id.toLowerCase();

  // Foreground workflow routes and the temporary activity-colour overlay stay first-class.
  if (isAsymptaLayer(id)) return;

  // Ambient route lines are decorative; removing them cuts repeated line rendering while
  // foreground workflow routes remain visible.
  if (id === "city-life-routes") {
    layout(map, id, "visibility", "none");
    return;
  }

  // 3D extrusion adds GPU cost but little information in the calm paper-map language.
  if (layer.type === "fill-extrusion") {
    layout(map, id, "visibility", "none");
    return;
  }

  // Tiny POIs and minor-path labels are visual noise and increase symbol collision work.
  if (layer.type === "symbol" && (NOISY_SYMBOL.test(key) || MINOR_ROUTE.test(key))) {
    layout(map, id, "visibility", "none");
    return;
  }

  // Dot/circle POI layers are non-essential in this map-first coordination view.
  if (layer.type === "circle" && !/city|town|place|station|rail/.test(key)) {
    layout(map, id, "visibility", "none");
    return;
  }

  // Preserve the main road network and rail; remove only fine pedestrian/service geometry.
  if (layer.type === "line" && MINOR_ROUTE.test(key) && !/primary|secondary|tertiary|rail|transit/.test(key)) {
    layout(map, id, "visibility", "none");
  }
}

function capPixelRatio(map: PaperMap) {
  try {
    if (!map.getPixelRatio || !map.setPixelRatio) return;
    const desired = Math.min(Math.max(1, window.devicePixelRatio || 1), MAX_MAP_PIXEL_RATIO);
    if (map.getPixelRatio() > desired + 0.01) map.setPixelRatio(desired);
  } catch {
    // Optional optimisation only.
  }
}

function applyPaperTone(map: PaperMap) {
  const layers = map.getStyle()?.layers ?? [];
  if (layers.length < 4) return false;

  capPixelRatio(map);

  for (const layer of layers) {
    const id = String(layer.id ?? "");
    const key = id.toLowerCase();

    simplifyLayer(map, layer);

    // Keep Asympta's own live layers untouched after simplification decisions so route and
    // activity colours stay semantically clear.
    if (isAsymptaLayer(id) || id === "city-life-routes") continue;

    if (layer.type === "background") {
      paint(map, id, "background-color", PAPER.base);
      continue;
    }

    if (layer.type === "fill") {
      if (/water|ocean|river|lake|canal/.test(key)) {
        paint(map, id, "fill-color", PAPER.water);
        paint(map, id, "fill-opacity", 0.92);
      } else if (/building|structure/.test(key)) {
        paint(map, id, "fill-color", PAPER.building);
        paint(map, id, "fill-opacity", 0.72);
      } else if (/park|grass|wood|forest|green|garden|nature/.test(key)) {
        paint(map, id, "fill-color", PAPER.green);
        paint(map, id, "fill-opacity", 0.62);
      } else if (/landuse|residential|commercial|industrial|land|earth/.test(key)) {
        paint(map, id, "fill-color", PAPER.land);
        paint(map, id, "fill-opacity", 0.56);
      }
      continue;
    }

    if (layer.type === "line") {
      if (/motorway|trunk|highway|primary/.test(key)) {
        paint(map, id, "line-color", PAPER.roadMajor);
        paint(map, id, "line-opacity", 0.82);
      } else if (/secondary|tertiary|road|street/.test(key)) {
        paint(map, id, "line-color", PAPER.road);
        paint(map, id, "line-opacity", 0.62);
      } else if (/rail|transit/.test(key)) {
        paint(map, id, "line-color", PAPER.rail);
        paint(map, id, "line-opacity", 0.68);
      } else if (/boundary|admin/.test(key)) {
        paint(map, id, "line-color", PAPER.boundary);
        paint(map, id, "line-opacity", 0.52);
      }
      continue;
    }

    if (layer.type === "symbol") {
      paint(map, id, "text-color", PAPER.text);
      paint(map, id, "text-halo-color", PAPER.halo);
      paint(map, id, "text-halo-width", 1);
      paint(map, id, "text-opacity", 0.82);
    }
  }

  document.documentElement.dataset.asymptaMapTone = "paper";
  document.documentElement.dataset.asymptaMapDetail = "essential";
  return true;
}

export function AsymptaPaperMapTone() {
  useEffect(() => {
    let attempts = 0;
    let timer = 0;

    const tryApply = () => {
      if (document.hidden) return;
      attempts += 1;
      const map = mapWindow().__ASYMPTA_MAP__;
      if (map) {
        try {
          if (applyPaperTone(map)) {
            window.clearInterval(timer);
            return;
          }
        } catch {
          // Decorative colour/detail tuning must never affect map interaction or simulation.
        }
      }
      if (attempts >= MAX_ATTEMPTS) window.clearInterval(timer);
    };

    tryApply();
    timer = window.setInterval(tryApply, RETRY_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}

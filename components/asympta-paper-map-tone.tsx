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
  roadMajor: "#BDB6A9",
  rail: "#C4BEB2",
  text: "#666159",
  halo: "#F3F0E8",
} as const;

const RETRY_MS = 650;
const MAX_ATTEMPTS = 24;
const MAX_MAP_PIXEL_RATIO = 2;

const NOISY_SYMBOL = /poi|point.?of.?interest|housenumber|house.?number|address|amenity|shop|store|restaurant|cafe|bar|school|college|university|hospital|clinic|parking|entrance|barrier|bus.?stop|platform|airport|aerodrome|building.?label/i;
const MAJOR_ROUTE = /motorway|trunk|highway|primary|rail|transit|subway|train/i;
const NONESSENTIAL_LINE = /secondary|tertiary|residential|minor|service|street|road|lane|footway|footpath|path|steps|pedestrian|cycleway|cycle|bridle|track|construction|boundary|admin/i;

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

  // Workflow routes and the temporary activity-colour overlay remain first-class.
  if (isAsymptaLayer(id)) return;

  // Ambient movement lines are decorative and are hidden entirely.
  if (id === "city-life-routes") {
    layout(map, id, "visibility", "none");
    return;
  }

  // Flat paper buildings are enough; extrusion adds GPU cost without useful meaning here.
  if (layer.type === "fill-extrusion") {
    layout(map, id, "visibility", "none");
    return;
  }

  if (layer.type === "symbol" && (NOISY_SYMBOL.test(key) || /road|street|path|route.?label/i.test(key))) {
    layout(map, id, "visibility", "none");
    return;
  }

  if (layer.type === "circle" && !/city|town|place|station|rail/.test(key)) {
    layout(map, id, "visibility", "none");
    return;
  }

  // Keep only motorway/trunk/primary and rail/transit. Everything below that level is
  // intentionally removed so the map reads as a calm route canvas rather than a street atlas.
  if (layer.type === "line" && !MAJOR_ROUTE.test(key) && NONESSENTIAL_LINE.test(key)) {
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

    if (isAsymptaLayer(id) || id === "city-life-routes") continue;

    if (layer.type === "background") {
      paint(map, id, "background-color", PAPER.base);
      continue;
    }

    if (layer.type === "fill") {
      if (/water|ocean|river|lake|canal/.test(key)) {
        paint(map, id, "fill-color", PAPER.water);
        paint(map, id, "fill-opacity", 0.90);
      } else if (/building|structure/.test(key)) {
        paint(map, id, "fill-color", PAPER.building);
        paint(map, id, "fill-opacity", 0.66);
      } else if (/park|grass|wood|forest|green|garden|nature/.test(key)) {
        paint(map, id, "fill-color", PAPER.green);
        paint(map, id, "fill-opacity", 0.56);
      } else if (/landuse|residential|commercial|industrial|land|earth/.test(key)) {
        paint(map, id, "fill-color", PAPER.land);
        paint(map, id, "fill-opacity", 0.48);
      }
      continue;
    }

    if (layer.type === "line") {
      if (/motorway|trunk|highway|primary/.test(key)) {
        paint(map, id, "line-color", PAPER.roadMajor);
        paint(map, id, "line-opacity", 0.70);
        paint(map, id, "line-width", ["interpolate", ["linear"], ["zoom"], 8, 0.45, 12, 0.8, 16, 1.15]);
      } else if (/rail|transit|subway|train/.test(key)) {
        paint(map, id, "line-color", PAPER.rail);
        paint(map, id, "line-opacity", 0.55);
        paint(map, id, "line-width", 0.7);
      }
      continue;
    }

    if (layer.type === "symbol") {
      paint(map, id, "text-color", PAPER.text);
      paint(map, id, "text-halo-color", PAPER.halo);
      paint(map, id, "text-halo-width", 1);
      paint(map, id, "text-opacity", 0.74);
    }
  }

  document.documentElement.dataset.asymptaMapTone = "paper";
  document.documentElement.dataset.asymptaMapDetail = "minimal-essential-routes";
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

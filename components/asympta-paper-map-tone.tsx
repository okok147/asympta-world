"use client";

import { useEffect } from "react";

type StyleLayer = { id: string; type?: string };
type PaperMap = {
  getStyle(): { layers?: StyleLayer[] };
  setPaintProperty(layerId: string, property: string, value: unknown): void;
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

function applyPaperTone(map: PaperMap) {
  const layers = map.getStyle()?.layers ?? [];
  if (layers.length < 4) return false;

  for (const layer of layers) {
    const id = String(layer.id ?? "");
    const key = id.toLowerCase();

    // Keep Asympta's live activity overlay untouched so its temporary colours remain visible.
    if (id.startsWith("asympta-activity-blocks")) continue;

    if (layer.type === "background") {
      paint(map, id, "background-color", PAPER.base);
      continue;
    }

    if (layer.type === "fill") {
      if (/water|ocean|river|lake|canal/.test(key)) paint(map, id, "fill-color", PAPER.water);
      else if (/building|structure/.test(key)) paint(map, id, "fill-color", PAPER.building);
      else if (/park|grass|wood|forest|green|garden|nature/.test(key)) paint(map, id, "fill-color", PAPER.green);
      else if (/landuse|residential|commercial|industrial|land|earth/.test(key)) paint(map, id, "fill-color", PAPER.land);
      continue;
    }

    if (layer.type === "fill-extrusion" && /building|structure/.test(key)) {
      paint(map, id, "fill-extrusion-color", PAPER.building);
      continue;
    }

    if (layer.type === "line") {
      if (/motorway|trunk|highway|primary/.test(key)) paint(map, id, "line-color", PAPER.roadMajor);
      else if (/road|street|path|service|secondary|tertiary/.test(key)) paint(map, id, "line-color", PAPER.road);
      else if (/rail|transit/.test(key)) paint(map, id, "line-color", PAPER.rail);
      else if (/boundary|admin/.test(key)) paint(map, id, "line-color", PAPER.boundary);
      continue;
    }

    if (layer.type === "symbol") {
      paint(map, id, "text-color", PAPER.text);
      paint(map, id, "text-halo-color", PAPER.halo);
    }
  }

  document.documentElement.dataset.asymptaMapTone = "paper";
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
          // Decorative colour tuning must never affect map interaction or simulation.
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

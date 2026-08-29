import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./asympta-restoration.css";
import "./asympta-animal-art.css";
import "./asympta-live-60hz.css";
import "./asympta-paper-map.css";
import "./asympta-scheduler-overlay.css";

export const metadata: Metadata = {
  title: "Asympta World",
  description: "A calm, map-first spatial world.",
  applicationName: "Asympta World",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#EEEDE6",
};

const ASYMPTA_MAP_PALETTE_BOOTSTRAP = `(() => {
  let current;
  const paper = {
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
    halo: "#F3F0E8"
  };

  const paint = (map, id, property, value) => {
    try { map.setPaintProperty(id, property, value); } catch {}
  };

  const applyLanguage = (map) => {
    try {
      const lang = String(document.documentElement.lang || "en").toLowerCase();
      const expression = lang.startsWith("zh")
        ? ["coalesce", ["get", "name:zh-Hant"], ["get", "name:zh"], ["get", "name:en"], ["get", "name"]]
        : lang.startsWith("ja")
          ? ["coalesce", ["get", "name:ja"], ["get", "name"], ["get", "name:en"]]
          : ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
      const layers = map.getStyle()?.layers ?? [];
      for (const layer of layers) {
        if (layer.type !== "symbol" || !layer.layout?.["text-field"]) continue;
        const key = String(layer.id ?? "").toLowerCase();
        if (!/label|place|road|street|poi|water|airport|station|transit|city|town/.test(key)) continue;
        try { map.setLayoutProperty(layer.id, "text-field", expression); } catch {}
      }
      document.documentElement.dataset.asymptaMapLanguage = lang.startsWith("zh") ? "zh-Hant" : lang.startsWith("ja") ? "ja" : "en";
    } catch {}
  };

  const applyPalette = (map) => {
    try {
      const layers = map.getStyle()?.layers ?? [];
      for (const layer of layers) {
        const id = String(layer.id ?? "");
        const key = id.toLowerCase();
        if (layer.type === "background") {
          paint(map, id, "background-color", paper.base);
          continue;
        }
        if (layer.type === "fill") {
          if (/water|ocean|river|lake/.test(key)) paint(map, id, "fill-color", paper.water);
          else if (/building/.test(key)) paint(map, id, "fill-color", paper.building);
          else if (/park|grass|wood|forest|green|nature/.test(key)) paint(map, id, "fill-color", paper.green);
          else if (/landuse|residential|commercial|industrial|land/.test(key)) paint(map, id, "fill-color", paper.land);
          continue;
        }
        if (layer.type === "fill-extrusion" && /building/.test(key)) {
          paint(map, id, "fill-extrusion-color", paper.building);
          continue;
        }
        if (layer.type === "line") {
          if (/motorway|trunk|highway|primary/.test(key)) paint(map, id, "line-color", paper.roadMajor);
          else if (/road|street|path/.test(key)) paint(map, id, "line-color", paper.road);
          else if (/rail/.test(key)) paint(map, id, "line-color", paper.rail);
          else if (/boundary|admin/.test(key)) paint(map, id, "line-color", paper.boundary);
          continue;
        }
        if (layer.type === "symbol") {
          paint(map, id, "text-color", paper.text);
          paint(map, id, "text-halo-color", paper.halo);
        }
      }
      applyLanguage(map);
      document.documentElement.dataset.asymptaMapPalette = "paper";
    } catch {}
  };

  const wrap = (value) => {
    if (!value || value.__asymptaPaperWrapped || !value.Map) return value;
    const OriginalMap = value.Map;
    value.Map = class AsymptaPaperMap extends OriginalMap {
      constructor(options) {
        super(options);
        const sync = () => requestAnimationFrame(() => applyPalette(this));
        this.on("load", sync);
        const observer = new MutationObserver(() => requestAnimationFrame(() => applyLanguage(this)));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
        this.on("remove", () => observer.disconnect());
      }
    };
    value.__asymptaPaperWrapped = true;
    return value;
  };

  Object.defineProperty(window, "maplibregl", {
    configurable: true,
    get() { return current; },
    set(value) { current = wrap(value); }
  });
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: ASYMPTA_MAP_PALETTE_BOOTSTRAP }} />
        {children}
      </body>
    </html>
  );
}

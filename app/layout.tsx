import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./asympta-restoration.css";
import "./asympta-animal-art.css";
import "./asympta-live-60hz.css";
import "./asympta-paper-map.css";
import "./asympta-scheduler-overlay.css";
import "./asympta-schedule-follow.css";
import "./asympta-demo-controls.css";

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

const ASYMPTA_MAP_NETWORK_RESCUE = `(() => {
  if (window.__asymptaMapNetworkRescueInstalled) return;
  window.__asymptaMapNetworkRescueInstalled = true;

  const mapLibreSources = [
    "https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.js",
    "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"
  ];
  const mapLibreCss = [
    "https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.css",
    "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css"
  ];
  const openFreeMapStyle = "https://tiles.openfreemap.org/styles/positron";
  const fallbackStyle = {
    version: 8,
    name: "Asympta offline paper fallback",
    sources: {},
    layers: [
      { id: "asympta-paper-background", type: "background", paint: { "background-color": "#EEEDE6" } }
    ]
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input && typeof input === "object" && "url" in input
        ? String(input.url)
        : String(input ?? "");
    if (!url.startsWith(openFreeMapStyle)) return nativeFetch(input, init);

    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const relayAbort = () => controller.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      else upstreamSignal.addEventListener("abort", relayAbort, { once: true });
    }
    const timer = window.setTimeout(() => controller.abort(), 3500);
    try {
      return await nativeFetch(input, { ...init, signal: controller.signal });
    } catch {
      return new Response(JSON.stringify(fallbackStyle), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } finally {
      window.clearTimeout(timer);
      upstreamSignal?.removeEventListener?.("abort", relayAbort);
    }
  };

  const loadProbe = (src, timeoutMs) => new Promise((resolve) => {
    const probe = document.createElement("script");
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      probe.remove();
      resolve(Boolean(ok && window.maplibregl));
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    probe.async = true;
    probe.src = src;
    probe.addEventListener("load", () => finish(true), { once: true });
    probe.addEventListener("error", () => finish(false), { once: true });
    document.head.appendChild(probe);
  });

  const nativeAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function appendAsymptaNode(node) {
    if (this === document.head && node instanceof HTMLScriptElement && node.dataset.asymptaMaplibre === "true") {
      (async () => {
        for (const src of mapLibreSources) {
          if (window.maplibregl || await loadProbe(src, 3500)) {
            node.dispatchEvent(new Event("load"));
            return;
          }
        }
        node.dispatchEvent(new Event("error"));
      })();
      return node;
    }

    if (this === document.head && node instanceof HTMLLinkElement && node.dataset.asymptaMaplibre === "true") {
      node.href = mapLibreCss[0];
      let switched = false;
      const switchCss = () => {
        if (switched) return;
        switched = true;
        node.href = mapLibreCss[1];
      };
      node.addEventListener("error", switchCss, { once: true });
      window.setTimeout(() => {
        if (!node.sheet) switchCss();
      }, 3500);
    }

    return nativeAppendChild.call(this, node);
  };
})();`;

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
        <script dangerouslySetInnerHTML={{ __html: ASYMPTA_MAP_NETWORK_RESCUE }} />
        <script dangerouslySetInnerHTML={{ __html: ASYMPTA_MAP_PALETTE_BOOTSTRAP }} />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./asympta-restoration.css";
import "./asympta-animal-art.css";
import "./asympta-live-60hz.css";
import "./asympta-safe-schedule.css";
import "./asympta-marker-bubbles.css";
import "./asympta-agent-card-locale.css";
import "./asympta-schedule-automation.css";
import "./asympta-schedule-total-time.css";
import "./asympta-estimated-progress.css";
import "./asympta-global-locale.css";
import "./asympta-task-celebration.css";
import "./asympta-card-collapse.css";

const faviconPath = process.env.ASYMPTA_PAGES_BUILD === "1"
  ? "/asympta-world/favicon-asympta-cat-20260829.svg"
  : "/favicon-asympta-cat-20260829.svg";
const faviconRevision = "20260829-1018";
const faviconInline = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#FAF6EC"/><path d="M16 23 20.5 9l8.5 8M48 23 43.5 9 35 17" fill="#C99D72" stroke="#4A433A" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="32" cy="34" rx="19" ry="17.5" fill="#D6AE83" stroke="#4A433A" stroke-width="2.4"/><path d="M21 27c3-2 5-2 8 0M43 27c-3-2-5-2-8 0" stroke="#9B7355" stroke-width="1.8" stroke-linecap="round"/><path d="M32 16v5M26 18l2 4M38 18l-2 4" stroke="#9B7355" stroke-width="1.6" stroke-linecap="round"/><circle cx="25" cy="31.5" r="2" fill="#4A433A"/><circle cx="39" cy="31.5" r="2" fill="#4A433A"/><circle cx="21" cy="37" r="2.4" fill="#DDA99B" opacity=".34"/><circle cx="43" cy="37" r="2.4" fill="#DDA99B" opacity=".34"/><path d="m32 34-2-1.8h4z" fill="#8D5F54"/><path d="M27 38c2.5 2 7.5 2 10 0" stroke="#4A433A" stroke-width="1.7" stroke-linecap="round"/><path d="M22 50c5 4 15 4 20 0" stroke="#4B7FA6" stroke-width="3.2" stroke-linecap="round" opacity=".9"/><circle cx="32" cy="51.5" r="2.2" fill="#4B7FA6"/></svg>`;
const faviconDataUrl = `data:image/svg+xml,${encodeURIComponent(`${faviconInline}<!--${faviconRevision}-->`)}`;

export const metadata: Metadata = {
  title: "Asympta World",
  description: "A calm, map-first spatial world.",
  applicationName: "Asympta World",
  icons: {
    icon: [{ url: faviconPath, type: "image/svg+xml" }],
    shortcut: faviconPath,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf7",
};

const ASYMPTA_MAP_BRIDGE_BOOTSTRAP = `(() => {
  let current = window.maplibregl;

  const wrap = (value) => {
    if (!value || value.__asymptaCameraBridgeWrapped || !value.Map) return value;
    const OriginalMap = value.Map;
    value.Map = class AsymptaCameraBridgeMap extends OriginalMap {
      constructor(options) {
        const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);
        const requestedZoom = Number(options?.zoom);
        const initialZoom = Number.isFinite(requestedZoom) ? Math.min(20, requestedZoom + 2) : options?.zoom;
        super({ ...options, zoom: initialZoom, pixelRatio: options?.pixelRatio ?? deviceRatio });
        window.__ASYMPTA_MAP__ = this;
      }

      on(type, listener) {
        if (type === "zoomstart") return this;
        if (type === "dragstart" && typeof listener === "function") {
          const guarded = (event) => {
            const touches = event?.originalEvent?.touches;
            if (touches && touches.length > 1) return;
            return listener(event);
          };
          return super.on(type, guarded);
        }
        return super.on(type, listener);
      }

      remove() {
        if (window.__ASYMPTA_MAP__ === this) delete window.__ASYMPTA_MAP__;
        return super.remove();
      }
    };
    value.__asymptaCameraBridgeWrapped = true;
    return value;
  };

  current = wrap(current);
  try {
    Object.defineProperty(window, "maplibregl", {
      configurable: true,
      get() { return current; },
      set(value) { current = wrap(value); }
    });
  } catch {}
})();`;

const ASYMPTA_FAVICON_REFRESH = `(() => {
  const href = ${JSON.stringify(faviconDataUrl)};
  const refresh = () => {
    document.head.querySelectorAll('link[rel~="icon"]').forEach((node) => node.remove());
    for (const rel of ["icon", "shortcut icon"]) {
      const link = document.createElement("link");
      link.rel = rel;
      link.type = "image/svg+xml";
      link.href = href;
      link.dataset.asymptaFavicon = ${JSON.stringify(faviconRevision)};
      document.head.appendChild(link);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else queueMicrotask(refresh);
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: ASYMPTA_MAP_BRIDGE_BOOTSTRAP }} />
        <script dangerouslySetInnerHTML={{ __html: ASYMPTA_FAVICON_REFRESH }} />
        {children}
      </body>
    </html>
  );
}

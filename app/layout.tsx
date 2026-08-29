import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./asympta-restoration.css";
import "./asympta-animal-art.css";
import "./asympta-live-60hz.css";
import "./asympta-safe-schedule.css";
import "./asympta-marker-bubbles.css";
import "./asympta-agent-card-locale.css";
import "./asympta-schedule-automation.css";
import "./asympta-estimated-progress.css";
import "./asympta-global-locale.css";
import "./asympta-task-celebration.css";

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
        super({ ...options, pixelRatio: options?.pixelRatio ?? deviceRatio });
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: ASYMPTA_MAP_BRIDGE_BOOTSTRAP }} />
        {children}
      </body>
    </html>
  );
}

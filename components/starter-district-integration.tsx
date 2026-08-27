"use client";

import { useEffect } from "react";

const EARTH_KEY = "asympta-earth-world-v1";
const STARTER_CELL_KEY = "asympta-starter-district-cell-v1";

type EarthSnapshot = {
  activeCellId?: string;
  userLocation?: { lat: number; lng: number };
  agent?: { cellId?: string };
};

type DistrictMode = "preview" | "active" | "away";
type OverlayMode = "none" | "places" | "earth" | "discovery" | "agent" | "inspector";

function readEarth(): EarthSnapshot | null {
  try {
    const raw = localStorage.getItem(EARTH_KEY);
    return raw ? (JSON.parse(raw) as EarthSnapshot) : null;
  } catch {
    return null;
  }
}

function syncStarterDistrict() {
  const root = document.documentElement;
  if (root.dataset.earthWorld !== "true") {
    delete root.dataset.starterDistrict;
    delete root.dataset.starterCell;
    return;
  }

  const earth = readEarth();
  const activeCell = earth?.activeCellId ?? earth?.agent?.cellId;
  const hasRealLocation = Boolean(earth?.userLocation && activeCell);
  let starterCell: string | null = null;
  try {
    starterCell = localStorage.getItem(STARTER_CELL_KEY);
    if (!starterCell && hasRealLocation && activeCell) {
      starterCell = activeCell;
      localStorage.setItem(STARTER_CELL_KEY, starterCell);
    }
  } catch {
    // The starter district still works in-memory when storage is unavailable.
  }

  let mode: DistrictMode = "preview";
  if (hasRealLocation && starterCell) mode = activeCell === starterCell ? "active" : "away";
  root.dataset.starterDistrict = mode;
  if (starterCell) root.dataset.starterCell = starterCell;
}

function detectOverlay(): OverlayMode {
  if (document.querySelector(".discovery-builder-panel")) return "discovery";
  if (document.querySelector(".earth-panel")) return "earth";
  if (document.querySelector(".places-directory-panel")) return "places";
  if (document.querySelector(".agent-task-panel")) return "agent";
  if (document.querySelector(".earth-inspector,.city-business-inspector,.community-inspector,.business-route-result")) return "inspector";
  return "none";
}

function syncOverlay() {
  document.documentElement.dataset.asymptaOverlay = detectOverlay();
}

export function StarterDistrictIntegration() {
  useEffect(() => {
    const sync = () => {
      syncStarterDistrict();
      syncOverlay();
    };
    const first = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 260);
    const observer = new MutationObserver(syncOverlay);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      observer.disconnect();
      delete document.documentElement.dataset.starterDistrict;
      delete document.documentElement.dataset.asymptaOverlay;
    };
  }, []);

  return (
    <style>{`
      /* Earth is a geolocation substrate, not a reason to erase the living starter district. */
      html[data-earth-world="true"][data-starter-district="preview"] .latent-city-layer,
      html[data-earth-world="true"][data-starter-district="active"] .latent-city-layer,
      html[data-earth-world="true"][data-starter-district="preview"] .community-layer,
      html[data-earth-world="true"][data-starter-district="active"] .community-layer { display:block!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .route-market-store,
      html[data-earth-world="true"][data-starter-district="active"] .route-market-store,
      html[data-earth-world="true"][data-starter-district="preview"] .community-founded-place,
      html[data-earth-world="true"][data-starter-district="active"] .community-founded-place { display:block!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .world-agent:not(.mission-user-agent),
      html[data-earth-world="true"][data-starter-district="active"] .world-agent:not(.mission-user-agent) { display:grid!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .places-directory-control,
      html[data-earth-world="true"][data-starter-district="active"] .places-directory-control { display:grid!important; }
      html[data-earth-world="true"][data-starter-district="away"] .latent-city-layer,
      html[data-earth-world="true"][data-starter-district="away"] .community-layer,
      html[data-earth-world="true"][data-starter-district="away"] .route-market-store,
      html[data-earth-world="true"][data-starter-district="away"] .community-founded-place,
      html[data-earth-world="true"][data-starter-district="away"] .world-agent:not(.mission-user-agent),
      html[data-earth-world="true"][data-starter-district="away"] .places-directory-control { display:none!important; }

      /* No fake road network in Earth mode. Places exist; imported/default routes do not. */
      html[data-earth-world="true"] .latent-city-streets { display:none!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .earth-cell.is-center .earth-cell-empty,
      html[data-earth-world="true"][data-starter-district="active"] .earth-cell.is-center .earth-cell-empty { display:none!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .earth-cell.is-center::after,
      html[data-earth-world="true"][data-starter-district="active"] .earth-cell.is-center::after {
        content:"STARTER DISTRICT"; position:absolute; right:9px; top:8px; color:rgba(92,111,99,.35); font-family:var(--pixel-font); font-size:.27rem; letter-spacing:.05em;
      }

      /* Full kawaii badge residents. Perception scales the art at distance; the base renderer is never a dust-dot. */
      .city-agent,.community-agent { width:30px!important; height:30px!important; }
      .city-agent-body,.community-agent-body {
        inset:0!important; border:0!important; border-radius:50%!important; box-shadow:none!important;
        background-color:transparent!important; background-image:var(--animal-badge-image)!important; background-position:center!important; background-repeat:no-repeat!important; background-size:contain!important;
      }
      .city-agent-body::before,.city-agent-body::after,.community-agent-body::before,.community-agent-body::after { display:none!important; content:none!important; box-shadow:none!important; }
      .city-agent-thought,.community-agent-thought { left:24px!important; bottom:30px!important; }

      /* Your Agent shares the same badge renderer; only the aura communicates ownership. */
      .world-agent.mission-user-agent .agent-portrait.mission-agent-portrait { width:50px!important; height:50px!important; display:grid!important; place-items:center!important; overflow:visible!important; }
      .mission-user-agent .shared-agent-animal-body {
        width:44px!important; height:44px!important; border:0!important; border-radius:50%!important; box-shadow:none!important;
        background-color:transparent!important; background-image:var(--animal-badge-image)!important; background-position:center!important; background-repeat:no-repeat!important; background-size:contain!important;
      }
      .mission-user-agent .shared-agent-animal-body::before,.mission-user-agent .shared-agent-animal-body::after { display:none!important; content:none!important; box-shadow:none!important; }

      /* Starter district places stay subtle, but visible enough to explain the community at a glance. */
      html[data-earth-world="true"][data-starter-district="preview"] .latent-business,
      html[data-earth-world="true"][data-starter-district="active"] .latent-business { opacity:.64!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .community-place,
      html[data-earth-world="true"][data-starter-district="active"] .community-place { opacity:.58!important; }

      /* Collision-free control dock: zoom -> places -> Earth on the left; agent controls on the right. */
      .asympta-zoom-control { z-index:132!important; }
      .places-directory-control { z-index:131!important; top:max(56px,calc(env(safe-area-inset-top) + 56px))!important; }
      .earth-control { z-index:130!important; top:max(98px,calc(env(safe-area-inset-top) + 98px))!important; width:min(350px,calc(100vw - 218px))!important; }
      .earth-bar { display:flex!important; flex-wrap:wrap!important; width:max-content!important; max-width:100%!important; border-radius:15px!important; }
      html[data-starter-district="preview"] .earth-bar>.earth-pill:nth-child(2),
      html[data-starter-district="active"] .earth-bar>.earth-pill:nth-child(2) { display:none!important; }
      .earth-status { left:max(12px,env(safe-area-inset-left))!important; top:max(142px,calc(env(safe-area-inset-top) + 142px))!important; bottom:auto!important; max-width:210px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .agent-task-control { z-index:134!important; }
      .need-composer { z-index:136!important; }

      /* Opening one large surface retires controls that could physically collide with it. */
      html[data-asympta-overlay="places"] .earth-control,
      html[data-asympta-overlay="places"] .earth-status,
      html[data-asympta-overlay="earth"] .places-directory-control,
      html[data-asympta-overlay="discovery"] .places-directory-control,
      html[data-asympta-overlay="discovery"] .earth-status { opacity:0!important; pointer-events:none!important; }
      .earth-control,.earth-status,.places-directory-control,.agent-task-control { transition:opacity 160ms ease!important; }

      /* Inspectors/panels always stop above the composer instead of covering it. */
      .earth-inspector,.city-business-inspector,.community-inspector,.discovery-builder-panel { max-height:calc(100svh - 190px)!important; }

      @media(max-width:620px) {
        .city-agent,.community-agent { width:27px!important; height:27px!important; }
        .city-agent-thought,.community-agent-thought { left:21px!important; bottom:27px!important; }
        .world-agent.mission-user-agent .agent-portrait.mission-agent-portrait { width:46px!important; height:46px!important; }
        .mission-user-agent .shared-agent-animal-body { width:40px!important; height:40px!important; }
        .asympta-zoom-control { left:max(9px,env(safe-area-inset-left))!important; top:max(10px,env(safe-area-inset-top))!important; }
        .places-directory-control { left:max(9px,env(safe-area-inset-left))!important; top:max(54px,calc(env(safe-area-inset-top) + 54px))!important; }
        .earth-control { left:max(9px,env(safe-area-inset-left))!important; top:max(94px,calc(env(safe-area-inset-top) + 94px))!important; width:196px!important; }
        .earth-bar { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; width:196px!important; gap:3px!important; padding:4px!important; border-radius:15px!important; }
        .earth-pill { justify-content:center!important; min-width:0!important; min-height:28px!important; padding:0 5px!important; font-size:.3rem!important; white-space:nowrap; }
        .earth-bar>.earth-pill:last-child:nth-child(odd) { grid-column:1 / -1; }
        .earth-status { left:max(9px,env(safe-area-inset-left))!important; top:max(196px,calc(env(safe-area-inset-top) + 196px))!important; bottom:auto!important; max-width:196px!important; }
        .agent-live-status { width:148px!important; }
        .places-directory-panel,.earth-panel,.discovery-builder-panel { width:min(310px,calc(100vw - 18px))!important; max-height:calc(100svh - 190px)!important; overflow:auto!important; }
        .earth-inspector,.city-business-inspector,.community-inspector { left:9px!important; right:9px!important; top:auto!important; bottom:max(78px,calc(env(safe-area-inset-bottom) + 78px))!important; width:auto!important; max-height:calc(100svh - 188px)!important; }
        html[data-asympta-overlay="earth"] .agent-task-control,
        html[data-asympta-overlay="places"] .agent-task-control,
        html[data-asympta-overlay="discovery"] .agent-task-control,
        html[data-asympta-overlay="agent"] .earth-control,
        html[data-asympta-overlay="agent"] .earth-status,
        html[data-asympta-overlay="agent"] .places-directory-control { opacity:0!important; pointer-events:none!important; }
      }

      @media(prefers-reduced-motion:reduce) { .earth-control,.earth-status,.places-directory-control,.agent-task-control { transition:none!important; } }
    `}</style>
  );
}

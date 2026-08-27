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
type OverlayMode = "none" | "places" | "earth" | "agent" | "inspector";

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
      html[data-earth-world="true"][data-starter-district="active"] .community-layer {
        display:block!important;
      }
      html[data-earth-world="true"][data-starter-district="preview"] .route-market-store,
      html[data-earth-world="true"][data-starter-district="active"] .route-market-store,
      html[data-earth-world="true"][data-starter-district="preview"] .community-founded-place,
      html[data-earth-world="true"][data-starter-district="active"] .community-founded-place {
        display:block!important;
      }
      html[data-earth-world="true"][data-starter-district="preview"] .world-agent:not(.mission-user-agent),
      html[data-earth-world="true"][data-starter-district="active"] .world-agent:not(.mission-user-agent) {
        display:grid!important;
      }
      html[data-earth-world="true"][data-starter-district="preview"] .places-directory-control,
      html[data-earth-world="true"][data-starter-district="active"] .places-directory-control {
        display:grid!important;
      }
      html[data-earth-world="true"][data-starter-district="away"] .latent-city-layer,
      html[data-earth-world="true"][data-starter-district="away"] .community-layer,
      html[data-earth-world="true"][data-starter-district="away"] .route-market-store,
      html[data-earth-world="true"][data-starter-district="away"] .community-founded-place,
      html[data-earth-world="true"][data-starter-district="away"] .world-agent:not(.mission-user-agent),
      html[data-earth-world="true"][data-starter-district="away"] .places-directory-control {
        display:none!important;
      }

      /* No fake road network in Earth mode. Places exist; imported/default routes do not. */
      html[data-earth-world="true"] .latent-city-streets { display:none!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .earth-cell.is-center .earth-cell-empty,
      html[data-earth-world="true"][data-starter-district="active"] .earth-cell.is-center .earth-cell-empty { display:none!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .earth-cell.is-center::after,
      html[data-earth-world="true"][data-starter-district="active"] .earth-cell.is-center::after {
        content:"STARTER DISTRICT";
        position:absolute;
        right:9px;
        top:8px;
        color:rgba(92,111,99,.35);
        font-family:var(--pixel-font);
        font-size:.27rem;
        letter-spacing:.05em;
      }

      /* Resident agents are readable animals, not 9px dust. Perception still scales them down at distance. */
      .city-agent,.community-agent {
        width:20px!important;
        height:20px!important;
      }
      .city-agent-body,.community-agent-body {
        inset:2px!important;
        border-width:1px!important;
        box-shadow:0 0 0 2px rgba(79,98,86,.035);
      }
      .city-agent-thought,.community-agent-thought {
        left:15px!important;
        bottom:20px!important;
      }
      .city-agent[data-animal-id] .city-agent-body::before,
      .community-agent[data-animal-id] .community-agent-body::before {
        left:1px!important;
        top:-5px!important;
        width:5px!important;
        height:5px!important;
        border-radius:2px 2px 0 0!important;
        background:var(--animal-dark,#59645c)!important;
        box-shadow:8px 0 var(--animal-dark,#59645c)!important;
        opacity:.94!important;
      }
      .city-agent[data-animal-family="round"] .city-agent-body::before,
      .community-agent[data-animal-family="round"] .community-agent-body::before {
        top:-2px!important;
        border-radius:50%!important;
        opacity:.58!important;
      }
      .city-agent[data-animal-family="long-ear"] .city-agent-body::before,
      .community-agent[data-animal-family="long-ear"] .community-agent-body::before {
        width:4px!important;
        height:8px!important;
        top:-8px!important;
        box-shadow:9px 0 var(--animal-dark)!important;
      }
      .city-agent[data-animal-family="horned"] .city-agent-body::before,
      .community-agent[data-animal-family="horned"] .community-agent-body::before {
        width:4px!important;
        height:7px!important;
        top:-7px!important;
        transform:rotate(-10deg);
        box-shadow:9px 1px var(--animal-dark)!important;
      }
      .city-agent[data-animal-family="bird"] .city-agent-body::before,
      .community-agent[data-animal-family="bird"] .community-agent-body::before {
        left:13px!important;
        top:6px!important;
        width:6px!important;
        height:4px!important;
        border-radius:1px!important;
        background:var(--animal-accent)!important;
        box-shadow:none!important;
      }
      .city-agent[data-animal-family="aquatic"] .city-agent-body::before,
      .community-agent[data-animal-family="aquatic"] .community-agent-body::before {
        left:-5px!important;
        top:6px!important;
        width:5px!important;
        height:5px!important;
        border-radius:50%!important;
        background:var(--animal-accent)!important;
        box-shadow:20px 0 var(--animal-accent)!important;
      }
      .city-agent[data-animal-id] .city-agent-body::after,
      .community-agent[data-animal-id] .community-agent-body::after {
        content:"";
        position:absolute;
        left:4px;
        top:6px;
        width:2px;
        height:2px;
        border-radius:50%;
        background:var(--animal-dark,#59645c);
        box-shadow:6px 0 var(--animal-dark,#59645c);
        opacity:.72;
      }

      /* Your Agent uses the same animal scale/language. The aura is identity, not the avatar itself. */
      .world-agent.mission-user-agent .agent-portrait.mission-agent-portrait {
        width:28px!important;
        height:28px!important;
        display:grid!important;
        place-items:center!important;
      }
      .mission-user-agent .shared-agent-animal-body {
        width:20px!important;
        height:20px!important;
        border-width:1px!important;
        box-shadow:0 0 0 2px rgba(88,104,94,.04)!important;
      }
      .mission-user-agent .shared-agent-animal-body::before {
        left:1px!important;
        top:-5px!important;
        width:5px!important;
        height:5px!important;
        border-radius:2px 2px 0 0!important;
        box-shadow:8px 0 var(--animal-dark,#59645c)!important;
      }
      .mission-user-agent .shared-agent-animal-body::after {
        left:4px!important;
        top:7px!important;
        width:2px!important;
        height:2px!important;
        background:var(--animal-dark,#59645c)!important;
        box-shadow:6px 0 var(--animal-dark,#59645c)!important;
      }
      .mission-user-agent[data-animal-family="long-ear"] .shared-agent-animal-body::before { width:4px!important;height:8px!important;top:-8px!important;box-shadow:9px 0 var(--animal-dark)!important; }
      .mission-user-agent[data-animal-family="bird"] .shared-agent-animal-body::before { left:15px!important;top:7px!important;width:6px!important;height:4px!important;box-shadow:none!important;background:var(--animal-accent)!important; }
      .mission-user-agent[data-animal-family="aquatic"] .shared-agent-animal-body::before { left:-5px!important;top:7px!important;width:5px!important;height:5px!important;border-radius:50%!important;box-shadow:21px 0 var(--animal-accent)!important;background:var(--animal-accent)!important; }

      /* Starter district places stay subtle, but visible enough to explain the community at a glance. */
      html[data-earth-world="true"][data-starter-district="preview"] .latent-business,
      html[data-earth-world="true"][data-starter-district="active"] .latent-business { opacity:.64!important; }
      html[data-earth-world="true"][data-starter-district="preview"] .community-place,
      html[data-earth-world="true"][data-starter-district="active"] .community-place { opacity:.58!important; }

      /* Collision-free control dock: zoom -> places -> Earth on the left; agent controls on the right. */
      .asympta-zoom-control { z-index:132!important; }
      .places-directory-control { z-index:131!important; top:max(56px,calc(env(safe-area-inset-top) + 56px))!important; }
      .earth-control {
        z-index:130!important;
        top:max(98px,calc(env(safe-area-inset-top) + 98px))!important;
        width:min(330px,calc(100vw - 218px))!important;
      }
      .earth-bar {
        display:flex!important;
        flex-wrap:wrap!important;
        width:max-content!important;
        max-width:100%!important;
        border-radius:15px!important;
      }
      html[data-starter-district="preview"] .earth-bar>.earth-pill:nth-child(2),
      html[data-starter-district="active"] .earth-bar>.earth-pill:nth-child(2) { display:none!important; }
      .earth-status {
        left:max(12px,env(safe-area-inset-left))!important;
        top:max(142px,calc(env(safe-area-inset-top) + 142px))!important;
        bottom:auto!important;
        max-width:190px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .agent-task-control { z-index:134!important; }
      .need-composer { z-index:136!important; }

      /* Opening one large surface temporarily retires controls that could physically collide with it. */
      html[data-asympta-overlay="places"] .earth-control,
      html[data-asympta-overlay="places"] .earth-status,
      html[data-asympta-overlay="earth"] .places-directory-control {
        opacity:0!important;
        pointer-events:none!important;
      }
      .earth-control,.earth-status,.places-directory-control,.agent-task-control {
        transition:opacity 160ms ease!important;
      }

      /* Inspectors always stop above the composer instead of covering it. */
      .earth-inspector,.city-business-inspector,.community-inspector {
        max-height:calc(100svh - 190px)!important;
      }

      @media(max-width:620px) {
        .asympta-zoom-control { left:max(9px,env(safe-area-inset-left))!important; top:max(10px,env(safe-area-inset-top))!important; }
        .places-directory-control { left:max(9px,env(safe-area-inset-left))!important; top:max(54px,calc(env(safe-area-inset-top) + 54px))!important; }
        .earth-control {
          left:max(9px,env(safe-area-inset-left))!important;
          top:max(94px,calc(env(safe-area-inset-top) + 94px))!important;
          width:184px!important;
        }
        .earth-bar {
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          width:184px!important;
          gap:3px!important;
          padding:4px!important;
          border-radius:15px!important;
        }
        .earth-pill {
          justify-content:center!important;
          min-width:0!important;
          min-height:28px!important;
          padding:0 5px!important;
          font-size:.31rem!important;
          white-space:nowrap;
        }
        .earth-bar>.earth-pill:last-child:nth-child(odd) { grid-column:1 / -1; }
        .earth-status {
          left:max(9px,env(safe-area-inset-left))!important;
          top:max(196px,calc(env(safe-area-inset-top) + 196px))!important;
          bottom:auto!important;
          max-width:184px!important;
        }
        .agent-live-status { width:148px!important; }
        .places-directory-panel,.earth-panel {
          width:min(310px,calc(100vw - 18px))!important;
          max-height:calc(100svh - 190px)!important;
          overflow:auto!important;
        }
        .earth-inspector,.city-business-inspector,.community-inspector {
          left:9px!important;
          right:9px!important;
          top:auto!important;
          bottom:max(78px,calc(env(safe-area-inset-bottom) + 78px))!important;
          width:auto!important;
          max-height:calc(100svh - 188px)!important;
        }
        html[data-asympta-overlay="earth"] .agent-task-control,
        html[data-asympta-overlay="places"] .agent-task-control,
        html[data-asympta-overlay="agent"] .earth-control,
        html[data-asympta-overlay="agent"] .earth-status,
        html[data-asympta-overlay="agent"] .places-directory-control {
          opacity:0!important;
          pointer-events:none!important;
        }
      }

      @media(prefers-reduced-motion:reduce) {
        .earth-control,.earth-status,.places-directory-control,.agent-task-control { transition:none!important; }
      }
    `}</style>
  );
}

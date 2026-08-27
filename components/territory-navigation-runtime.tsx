"use client";

import { Map, Menu, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GEO_CELL_DEGREES, cellFromId, type GeoPoint } from "@/lib/earth-world";

type EarthPlace = { id: string; name: string; cellId: string };
type EarthState = { activeCellId?: string; userLocation?: GeoPoint; agent?: { cellId?: string }; places?: EarthPlace[] };
type EarthRegistry = { invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown> };
type TerritoryWindow = Window & { __ASYMPTA_EARTH_WEBMCP__?: EarthRegistry };

type Territory = { id: "home" | "neighbour"; label: string; cellId: string; center: GeoPoint };

const EARTH_KEY = "asympta-earth-world-v1";
const STARTER_CELL_KEY = "asympta-starter-district-cell-v1";
const NEIGHBOUR_SEEDED_KEY = "asympta-neighbour-territory-seeded-v1";
const DOCK_IDLE_MS = 6200;

function readEarth(): EarthState {
  try {
    const raw = localStorage.getItem(EARTH_KEY);
    return raw ? JSON.parse(raw) as EarthState : {};
  } catch { return {}; }
}
function readStarterCell() {
  try { return localStorage.getItem(STARTER_CELL_KEY); } catch { return null; }
}
function cellCenter(cellId: string): GeoPoint | null {
  const cell = cellFromId(cellId);
  return cell ? { lat: (cell.south + cell.north) / 2, lng: (cell.west + cell.east) / 2 } : null;
}
function neighbourCellId(homeCellId: string) {
  const home = cellFromId(homeCellId);
  return home ? `geo-${home.row}-${home.col + 1}` : null;
}
function planeScale() {
  const transform = document.querySelector<HTMLElement>(".world-plane")?.style.transform ?? "";
  const match = /scale\(\s*([\d.]+)\s*\)/.exec(transform);
  return match ? Number(match[1]) || .77 : .77;
}
function projectedCellCenter(activeCellId: string, targetCellId: string) {
  const active = cellFromId(activeCellId);
  const target = cellFromId(targetCellId);
  if (!active || !target) return null;
  const dx = target.col - active.col;
  const dy = target.row - active.row;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return null;
  return { x: (dx + 1) * 400 + 200, y: (1 - dy) * (760 / 3) + (760 / 6) };
}
function emitProcess(label: string, detail: string, progress: number, tone: string) {
  window.dispatchEvent(new CustomEvent("asympta:user-task-process", { detail: { label, detail, progress, tone } }));
}
async function delay(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }

async function ensureNeighbourCommunity(territory: Territory) {
  let seeded = false;
  try { seeded = localStorage.getItem(NEIGHBOUR_SEEDED_KEY) === territory.cellId; } catch { /* memory fallback */ }
  const earth = readEarth();
  if (seeded || earth.places?.some((place) => place.cellId === territory.cellId)) return;
  const registry = (window as TerritoryWindow).__ASYMPTA_EARTH_WEBMCP__;
  if (!registry) return;

  const cell = cellFromId(territory.cellId);
  if (!cell) return;
  const seeds = [
    {
      name: "Neighbour Commons",
      kind: "community",
      lat: territory.center.lat + GEO_CELL_DEGREES * .12,
      lng: territory.center.lng - GEO_CELL_DEGREES * .13,
      description: "Community-created meeting and help point · pending local verification\nNeighbour check-in service $0\nShared table service $0\nLocal help session $4",
      catalog: [
        { id: "neighbour-check-in", name: "Neighbour check-in", type: "service", price: 0, availability: 8, tags: ["community", "help"] },
        { id: "shared-table", name: "Shared table", type: "service", price: 0, availability: 12, tags: ["community", "social"] },
      ],
    },
    {
      name: "East Pantry",
      kind: "store",
      lat: territory.center.lat - GEO_CELL_DEGREES * .15,
      lng: territory.center.lng + GEO_CELL_DEGREES * .14,
      description: "Community-discovered small pantry · pending local verification\nBread pack $8\nFruit bag $10\nDaily kit $6",
      catalog: [
        { id: "east-bread", name: "Bread pack", type: "product", price: 8, availability: 14, tags: ["food", "bread"] },
        { id: "east-fruit", name: "Fruit bag", type: "product", price: 10, availability: 10, tags: ["food", "fresh"] },
      ],
    },
  ] as const;

  emitProcess("建立第二 Territory", `${territory.label} · 社區開始填入第一批可驗證資訊`, 20, "planning");
  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    const evidence = await registry.invoke("earth_submit_local_evidence", { placeName: seed.name, kind: seed.kind, description: seed.description, lat: seed.lat, lng: seed.lng }) as { ok?: boolean; evidence?: { id?: string } };
    if (!evidence.ok || !evidence.evidence?.id) continue;
    await registry.invoke("earth_process_submission", { evidenceId: evidence.evidence.id, summary: seed.description.split("\n")[0], extractedCatalog: seed.catalog });
    emitProcess("Territory 新地點", `${seed.name} · ${index + 1}/${seeds.length}`, 35 + index * 18, "working");
    await delay(520);
  }
  try { localStorage.setItem(NEIGHBOUR_SEEDED_KEY, territory.cellId); } catch { /* memory fallback */ }
}

export function TerritoryNavigationRuntime() {
  const lastDockActivity = useRef(0);
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [homeCellId, setHomeCellId] = useState<string | null>(null);
  const [scale, setScale] = useState(.77);
  const [dockOpen, setDockOpen] = useState(false);
  const [travelling, setTravelling] = useState<string | null>(null);
  const [placeCounts, setPlaceCounts] = useState<Record<string, number>>({});

  const wakeDock = () => {
    lastDockActivity.current = Date.now();
    setDockOpen(true);
  };

  useEffect(() => {
    const sync = () => {
      const earth = readEarth();
      const active = earth.activeCellId ?? earth.agent?.cellId ?? null;
      const starter = readStarterCell() ?? (earth.userLocation && active ? active : null);
      if (starter && !readStarterCell()) {
        try { localStorage.setItem(STARTER_CELL_KEY, starter); } catch { /* memory fallback */ }
      }
      setActiveCellId(active);
      setHomeCellId(starter);
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane"));
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      setScale(planeScale());
      const counts: Record<string, number> = {};
      earth.places?.forEach((place) => { counts[place.cellId] = (counts[place.cellId] ?? 0) + 1; });
      setPlaceCounts(counts);
    };
    const first = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 420);
    const onPointer = () => {
      if (document.documentElement.dataset.worldDockOpen === "true") lastDockActivity.current = Date.now();
    };
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.worldDockOpen = dockOpen ? "true" : "false";
    if (!dockOpen) return () => { delete document.documentElement.dataset.worldDockOpen; };
    if (!lastDockActivity.current) lastDockActivity.current = Date.now();
    const timer = window.setInterval(() => {
      const hasOpenSurface = Boolean(document.querySelector(".earth-panel,.places-directory-panel,.discovery-builder-panel"));
      if (!hasOpenSurface && Date.now() - lastDockActivity.current >= DOCK_IDLE_MS) setDockOpen(false);
    }, 520);
    return () => {
      window.clearInterval(timer);
      delete document.documentElement.dataset.worldDockOpen;
    };
  }, [dockOpen]);

  const territories = useMemo<Territory[]>(() => {
    if (!homeCellId) return [];
    const homeCenter = cellCenter(homeCellId);
    const neighbourId = neighbourCellId(homeCellId);
    const neighbourCenter = neighbourId ? cellCenter(neighbourId) : null;
    if (!homeCenter || !neighbourId || !neighbourCenter) return [];
    return [
      { id: "home", label: "Home Territory", cellId: homeCellId, center: homeCenter },
      { id: "neighbour", label: "Neighbour Territory", cellId: neighbourId, center: neighbourCenter },
    ];
  }, [homeCellId]);

  useEffect(() => {
    const living = territories.some((territory) => territory.cellId === activeCellId);
    document.documentElement.dataset.livingTerritory = living ? "true" : "false";
    const active = territories.find((territory) => territory.cellId === activeCellId);
    document.documentElement.dataset.activeTerritory = active?.id ?? "other";
    return () => {
      delete document.documentElement.dataset.livingTerritory;
      delete document.documentElement.dataset.activeTerritory;
    };
  }, [activeCellId, territories]);

  const selectTerritory = async (territory: Territory) => {
    if (travelling || territory.cellId === activeCellId) return;
    const registry = (window as TerritoryWindow).__ASYMPTA_EARTH_WEBMCP__;
    if (!registry) return;
    setTravelling(territory.id);
    try {
      if (territory.id === "neighbour") await ensureNeighbourCommunity(territory);
      emitProcess("跨 Territory", `${territory.label} · ${territory.cellId}`, 18, "moving");
      await registry.invoke("earth_travel_to", { name: territory.label, lat: territory.center.lat, lng: territory.center.lng });
      emitProcess("進入 Territory", `${territory.label} · agent behavior 已恢復`, 100, "done");
    } finally { setTravelling(null); }
  };

  const showTerritories = scale <= .72 && Boolean(activeCellId) && territories.length > 1;

  return <>
    <style>{`
      /* Left controls are invisible while idle; one quiet menu dot is the only persistent affordance. */
      html[data-world-dock-open="false"] .asympta-zoom-control,
      html[data-world-dock-open="false"] .places-directory-control,
      html[data-world-dock-open="false"] .earth-control,
      html[data-world-dock-open="false"] .earth-status { opacity:0!important; pointer-events:none!important; transform:translateY(-4px) scale(.98)!important; }
      html[data-world-dock-open="true"] .asympta-zoom-control { left:max(49px,calc(env(safe-area-inset-left) + 49px))!important; }
      .asympta-zoom-control,.places-directory-control,.earth-control,.earth-status { transition:opacity 170ms ease,transform 170ms ease,left 170ms ease!important; }
      .world-dock-toggle { position:absolute;z-index:160;left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));display:grid;place-items:center;width:31px;height:31px;border:1px solid rgba(112,123,115,.1);border-radius:50%;background:rgba(248,247,241,.48);color:#748079;box-shadow:0 5px 18px rgba(49,60,53,.04);backdrop-filter:blur(10px);opacity:.22;cursor:pointer;transition:opacity 160ms ease,transform 160ms ease}
      .world-dock-toggle:hover,.world-dock-toggle:focus-visible,html[data-world-dock-open="true"] .world-dock-toggle{opacity:.9;transform:scale(1.04);outline:none}
      .world-dock-toggle svg{width:13px;height:13px}
      .territory-marker{position:absolute;z-index:63;width:154px;min-height:54px;transform:translate(-50%,-50%);display:grid;place-items:center;gap:2px;padding:7px 9px;border:1px dashed rgba(105,128,111,.2);border-radius:17px;background:rgba(248,247,241,.28);color:#67766c;backdrop-filter:blur(4px);cursor:pointer;opacity:.66;transition:opacity 180ms ease,transform 180ms ease,box-shadow 180ms ease}
      .territory-marker:hover,.territory-marker:focus-visible{opacity:1;transform:translate(-50%,-50%) scale(1.04);box-shadow:0 10px 30px rgba(55,72,61,.08);outline:none}
      .territory-marker.is-active{border-style:solid;border-color:rgba(112,139,181,.24);background:rgba(118,139,181,.055);color:#5d7097;opacity:.92}
      .territory-marker strong{display:flex;align-items:center;gap:5px;font-size:.49rem}.territory-marker strong svg{width:11px;height:11px}.territory-marker small{font-family:var(--pixel-font);font-size:.27rem;color:#879189}.territory-marker em{font-style:normal;font-size:.31rem;color:#738079}
      /* The two demo territories are living territories: resident society keeps moving and interacting after crossing the border. */
      html[data-earth-world="true"][data-living-territory="true"] .latent-city-layer,
      html[data-earth-world="true"][data-living-territory="true"] .community-layer,
      html[data-earth-world="true"][data-living-territory="true"] .route-market-store,
      html[data-earth-world="true"][data-living-territory="true"] .community-founded-place { display:block!important; }
      html[data-earth-world="true"][data-living-territory="true"] .world-agent:not(.mission-user-agent) { display:grid!important; }
      html[data-earth-world="true"][data-living-territory="true"] .places-directory-control { display:grid!important; }
      @media(max-width:620px){.world-dock-toggle{left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));width:30px;height:30px}html[data-world-dock-open="true"] .asympta-zoom-control{left:max(46px,calc(env(safe-area-inset-left) + 46px))!important}.territory-marker{width:132px;min-height:48px;padding:5px 7px}.territory-marker strong{font-size:.43rem}}
      @media(prefers-reduced-motion:reduce){.world-dock-toggle,.territory-marker,.asympta-zoom-control,.places-directory-control,.earth-control,.earth-status{transition:none!important}}
    `}</style>

    {viewport ? createPortal(<button type="button" className="world-dock-toggle" aria-label={dockOpen ? "Hide world controls" : "Show world controls"} aria-expanded={dockOpen} onClick={() => { if (dockOpen) setDockOpen(false); else wakeDock(); }}><Menu aria-hidden="true" /></button>, viewport, "world-dock-toggle") : null}

    {worldPlane && showTerritories ? territories.map((territory) => {
      const point = activeCellId ? projectedCellCenter(activeCellId, territory.cellId) : null;
      if (!point) return null;
      const active = territory.cellId === activeCellId;
      return createPortal(<button type="button" className={"territory-marker" + (active ? " is-active" : "")} style={{ left: point.x, top: point.y }} onClick={() => void selectTerritory(territory)} disabled={Boolean(travelling)}>
        <strong>{territory.id === "home" ? <Map aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{territory.label}</strong>
        <small>{territory.cellId}{active ? " · ACTIVE" : " · select to cross"}</small>
        <em>{placeCounts[territory.cellId] ?? 0} discovered places{travelling === territory.id ? " · travelling…" : ""}</em>
      </button>, worldPlane, "territory-" + territory.id);
    }) : null}
  </>;
}

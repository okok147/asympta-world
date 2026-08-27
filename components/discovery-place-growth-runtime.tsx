"use client";

import { Building2, Check, MapPin, Navigation, Sparkles, Store } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EarthCatalogItem = { id: string; name: string; type: "product" | "service"; price?: number; availability: number };
type EarthPlace = {
  id: string;
  name: string;
  kind: "store" | "service" | "facility" | "community";
  summary: string;
  lat: number;
  lng: number;
  completeness: number;
  confidence: number;
  brightness: number;
  evidenceIds: string[];
  catalog: EarthCatalogItem[];
  updatedAt: number;
};
type EarthState = { places?: EarthPlace[] };
type CityState = { businesses?: Array<{ id: string; name: string }> };
type CommunityState = { places?: Array<{ id: string; name: string }> };
type FounderState = { places?: Array<{ id: string; name: string }> };
type RouteState = { extraStores?: Array<{ id: string; name: string }> };
type EarthRegistry = { invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown> };
type GrowthWindow = Window & { __ASYMPTA_EARTH_WEBMCP__?: EarthRegistry };

const EARTH_KEY = "asympta-earth-world-v1";
const CITY_KEY = "asympta-latent-city-v1";
const COMMUNITY_KEY = "asympta-community-v2";
const FOUNDER_KEY = "asympta-community-store-founder-v1";
const ROUTE_KEY = "asympta-shopping-route-v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function knownLocalNames() {
  const names = new Set<string>();
  readJson<CityState>(CITY_KEY, {}).businesses?.forEach((item) => names.add(normalized(item.name)));
  readJson<CommunityState>(COMMUNITY_KEY, {}).places?.forEach((item) => names.add(normalized(item.name)));
  readJson<FounderState>(FOUNDER_KEY, {}).places?.forEach((item) => names.add(normalized(item.name)));
  readJson<RouteState>(ROUTE_KEY, {}).extraStores?.forEach((item) => names.add(normalized(item.name)));
  return names;
}

function basePlaceCount() {
  const ids = new Set<string>();
  readJson<CityState>(CITY_KEY, {}).businesses?.forEach((item) => ids.add("city:" + item.id));
  readJson<CommunityState>(COMMUNITY_KEY, {}).places?.forEach((item) => ids.add("community:" + item.id));
  readJson<FounderState>(FOUNDER_KEY, {}).places?.forEach((item) => ids.add("founded:" + item.id));
  readJson<RouteState>(ROUTE_KEY, {}).extraStores?.forEach((item) => ids.add("route:" + item.id));
  return ids.size;
}

function uniqueEarthPlaces() {
  const earth = readJson<EarthState>(EARTH_KEY, {});
  const existingNames = knownLocalNames();
  return (earth.places ?? []).filter((place) => !existingNames.has(normalized(place.name)));
}

function asymptaPoint(place: EarthPlace) {
  return Math.round((place.confidence * .45 + place.completeness * .35 + place.brightness * .20) * 100);
}

function placeNode(name: string) {
  return [...document.querySelectorAll<HTMLElement>(".earth-place")].find((node) => (node.textContent ?? "").includes(name)) ?? null;
}

function refreshDirectoryLabels(total: number, extraVisible: number) {
  const button = document.querySelector<HTMLElement>(".places-directory-button span");
  if (button) button.textContent = `Places · ${total}`;
  const summary = document.querySelector<HTMLElement>(".places-summary span:first-child");
  if (summary) {
    const base = Number.parseInt(summary.textContent ?? "0", 10) || 0;
    const previousExtra = Number(summary.dataset.discoveryExtra ?? "0") || 0;
    summary.dataset.discoveryExtra = String(extraVisible);
    summary.textContent = `${Math.max(0, base - previousExtra) + extraVisible} visible`;
  }
}

export function DiscoveryPlaceGrowthRuntime() {
  const previousEarthIds = useRef<Set<string>>(new Set());
  const [places, setPlaces] = useState<EarthPlace[]>([]);
  const [listHost, setListHost] = useState<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opening, setOpening] = useState<{ name: string; until: number } | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const sync = () => {
      const nextPlaces = uniqueEarthPlaces();
      const ids = new Set(nextPlaces.map((place) => place.id));
      if (previousEarthIds.current.size > 0) {
        const added = nextPlaces.find((place) => !previousEarthIds.current.has(place.id));
        if (added) setOpening({ name: added.name, until: Date.now() + 9000 });
      }
      previousEarthIds.current = ids;
      setPlaces(nextPlaces);
      setListHost(document.querySelector<HTMLElement>(".places-list"));
      setPanelHost(document.querySelector<HTMLElement>(".places-directory-panel"));
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      setQuery(document.querySelector<HTMLInputElement>(".places-search input")?.value ?? "");
      setTypeFilter(document.querySelector<HTMLSelectElement>('.places-select[aria-label="Filter place type"]')?.value ?? "all");
      refreshDirectoryLabels(basePlaceCount() + nextPlaces.length, nextPlaces.length);
    };
    const first = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 520);
    const onOpened = (event: Event) => {
      const detail = (event as CustomEvent<{ place?: EarthPlace }>).detail;
      const place = detail?.place;
      if (place) {
        setOpening({ name: place.name, until: Date.now() + 9000 });
        window.setTimeout(() => placeNode(place.name)?.classList.add("is-community-opening"), 120);
      }
      sync();
    };
    window.addEventListener("asympta:discovery-place-opened", onOpened);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("asympta:discovery-place-opened", onOpened);
    };
  }, []);

  useEffect(() => {
    if (!opening) return;
    const node = placeNode(opening.name);
    node?.classList.add("is-community-opening");
    const timer = window.setTimeout(() => {
      node?.classList.remove("is-community-opening");
      setOpening((current) => current?.name === opening.name ? null : current);
    }, Math.max(0, opening.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [opening]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return places
      .filter((place) => typeFilter === "all" || place.kind === typeFilter || (typeFilter === "community" && place.kind === "community"))
      .filter((place) => !clean || `${place.name} ${place.summary} ${place.kind} ${place.catalog.map((item) => item.name).join(" ")}`.toLowerCase().includes(clean))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [places, query, typeFilter]);

  const selected = places.find((place) => place.id === selectedId) ?? null;

  const goTo = async (place: EarthPlace) => {
    const registry = (window as GrowthWindow).__ASYMPTA_EARTH_WEBMCP__;
    if (!registry) return;
    await registry.invoke("earth_travel_to", { name: place.name, lat: place.lat, lng: place.lng });
  };

  return <>
    <style>{`
      .discovery-directory-divider{grid-column:1/-1;margin:5px 3px 1px;padding-top:5px;border-top:1px solid rgba(111,124,114,.1);color:#879087;font-family:var(--pixel-font);font-size:.27rem;letter-spacing:.05em;text-transform:uppercase}
      .place-row.is-earth-discovered{border-color:rgba(115,149,107,.09);background:rgba(115,149,107,.035)}
      .place-row.is-earth-discovered .place-row-icon{background:rgba(115,149,107,.08);color:#6c8d62}
      .discovery-place-detail{margin-top:7px;padding:8px;border-top:1px solid rgba(112,120,114,.11)}
      .discovery-place-growth-toast{position:absolute;z-index:151;left:max(12px,env(safe-area-inset-left));top:max(94px,calc(env(safe-area-inset-top) + 94px));display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid rgba(111,145,103,.2);border-radius:999px;background:rgba(248,247,241,.95);box-shadow:0 9px 28px rgba(53,69,57,.1);color:#647b5c;font-family:var(--pixel-font);font-size:.31rem;backdrop-filter:blur(12px);animation:discovery-growth-toast 3.8s ease both;pointer-events:none}
      .discovery-place-growth-toast svg{width:11px;height:11px;color:#7da16d}
      .earth-place.is-community-opening{overflow:visible!important;z-index:45!important;opacity:1!important;animation:community-opening-glow 1.05s ease-in-out 8 alternate!important}
      .earth-place.is-community-opening .earth-place-bright{opacity:1!important;width:48px!important;height:48px!important;background:radial-gradient(circle,rgba(215,190,103,.28),rgba(117,164,120,.22) 35%,rgba(118,139,181,.09) 58%,transparent 74%)!important;filter:blur(5px)!important;animation:community-opening-halo 1.25s ease-in-out 6 alternate}
      .earth-place.is-community-opening::before{content:""!important;position:absolute!important;left:50%!important;top:28px!important;width:4px!important;height:4px!important;border-radius:1px!important;background:#d7bd70!important;box-shadow:-34px -24px #d7bd70,30px -30px #8bb58a,-40px 8px #8fa7ca,38px 13px #d7bd70,-21px 28px #8bb58a,24px 31px #8fa7ca!important;animation:community-opening-pixels 1.2s ease-in-out 7 alternate!important;pointer-events:none!important}
      .earth-place.is-community-opening::after{content:"NEW"!important;position:absolute!important;left:50%!important;top:-17px!important;transform:translateX(-50%)!important;padding:3px 5px!important;border-radius:999px!important;background:rgba(248,247,241,.94)!important;color:#718b66!important;font-family:var(--pixel-font)!important;font-size:.24rem!important;letter-spacing:.05em!important;box-shadow:0 4px 14px rgba(57,73,60,.08)!important;animation:community-opening-new 1.3s ease-in-out 6 alternate!important}
      @keyframes discovery-growth-toast{0%{opacity:0;transform:translateY(-4px) scale(.96)}12%,78%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-4px) scale(.98)}}
      @keyframes community-opening-halo{from{transform:translate(-50%,-50%) scale(.82)}to{transform:translate(-50%,-50%) scale(1.18)}}
      @keyframes community-opening-pixels{from{opacity:.3;transform:translate(-50%,-50%) scale(.7) rotate(-5deg)}to{opacity:1;transform:translate(-50%,-50%) scale(1.15) rotate(5deg)}}
      @keyframes community-opening-new{from{opacity:.45;transform:translateX(-50%) translateY(2px)}to{opacity:1;transform:translateX(-50%) translateY(-2px)}}
      @media(max-width:620px){.discovery-place-growth-toast{left:9px;top:max(92px,calc(env(safe-area-inset-top) + 92px));max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
      @media(prefers-reduced-motion:reduce){.discovery-place-growth-toast,.earth-place.is-community-opening,.earth-place.is-community-opening .earth-place-bright,.earth-place.is-community-opening::before,.earth-place.is-community-opening::after{animation:none!important}}
    `}</style>

    {listHost && visible.length ? createPortal(<>
      <div className="discovery-directory-divider">Community discovered · {visible.length}</div>
      {visible.map((place) => {
        const Icon = place.kind === "store" ? Store : place.kind === "facility" ? Building2 : MapPin;
        const point = asymptaPoint(place);
        return <button type="button" className="place-row is-earth-discovered" key={"earth:" + place.id} onClick={() => setSelectedId((current) => current === place.id ? null : place.id)}>
          <i className="place-row-icon"><Icon aria-hidden="true" /></i>
          <span className="place-row-copy"><strong>{place.name}</strong><small>{place.kind} · Community discovered · {place.evidenceIds.length} evidence</small></span>
          <span className="place-row-meta"><b>{point} AP</b><span>{Math.round(place.completeness * 100)}% info</span></span>
        </button>;
      })}
    </>, listHost, "earth-discovered-place-rows") : null}

    {panelHost && selected ? createPortal(<section className="place-detail discovery-place-detail">
      <div className="place-detail-head"><span><strong>{selected.name}</strong><small>{selected.summary} · {asymptaPoint(selected)} AP</small></span><button type="button" className="place-go" onClick={() => void goTo(selected)}><Navigation aria-hidden="true" />GO</button></div>
      <div className="place-info-list">{selected.catalog.length ? selected.catalog.slice(0, 10).map((item) => <div className="place-info-line" key={item.id}><span>{item.name}</span><span>{item.type} · {item.availability}{item.price !== undefined ? ` · ₡${item.price}` : ""}</span></div>) : <div className="place-info-line"><span>Pending local verification / catalog evidence</span><span>discovered</span></div>}</div>
    </section>, panelHost, "earth-discovered-place-detail") : null}

    {viewport && opening ? createPortal(<div className="discovery-place-growth-toast" role="status"><Sparkles aria-hidden="true" /><Check aria-hidden="true" />+1 place · {opening.name}</div>, viewport, "discovery-place-growth-toast") : null}
  </>;
}

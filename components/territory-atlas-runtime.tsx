"use client";

import { Map, Navigation, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  buildTerritoryAtlas,
  TERRITORY_ATLAS_COUNT,
  type AtlasTerritory,
} from "@/lib/territory-atlas";

type EarthSnapshot = {
  activeCellId?: string;
  userLocation?: { lat: number; lng: number };
  agent?: { cellId?: string };
  places?: Array<{ cellId: string }>;
};

type EarthRegistry = {
  invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
};

type AtlasTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

type AtlasWindow = Window & {
  __ASYMPTA_EARTH_WEBMCP__?: EarthRegistry;
  __ASYMPTA_TERRITORY_ATLAS__?: {
    tools: AtlasTool[];
    invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  };
};

const EARTH_KEY = "asympta-earth-world-v1";
const STARTER_CELL_KEY = "asympta-starter-district-cell-v1";

function readEarth(): EarthSnapshot {
  try {
    const raw = localStorage.getItem(EARTH_KEY);
    return raw ? (JSON.parse(raw) as EarthSnapshot) : {};
  } catch {
    return {};
  }
}

function readStarterCell() {
  try {
    return localStorage.getItem(STARTER_CELL_KEY);
  } catch {
    return null;
  }
}

export function TerritoryAtlasRuntime() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [homeCellId, setHomeCellId] = useState<string | null>(null);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [placeCounts, setPlaceCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [travelling, setTravelling] = useState(false);

  useEffect(() => {
    const sync = () => {
      const earth = readEarth();
      const active = earth.activeCellId ?? earth.agent?.cellId ?? null;
      const starter = readStarterCell() ?? (earth.userLocation && active ? active : null);
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      setActiveCellId(active);
      setHomeCellId(starter);
      const counts: Record<string, number> = {};
      earth.places?.forEach((place) => {
        counts[place.cellId] = (counts[place.cellId] ?? 0) + 1;
      });
      setPlaceCounts(counts);
    };
    const first = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 520);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const atlas = useMemo(
    () => (homeCellId ? buildTerritoryAtlas(homeCellId) : []),
    [homeCellId],
  );
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return atlas;
    return atlas.filter((territory) =>
      `${territory.label} ${territory.cellId} ${territory.center.lat.toFixed(4)} ${territory.center.lng.toFixed(4)}`
        .toLowerCase()
        .includes(text),
    );
  }, [atlas, query]);
  const selected =
    atlas.find((territory) => territory.id === selectedId) ??
    atlas.find((territory) => territory.cellId === activeCellId) ??
    atlas[0] ??
    null;

  const enterTerritory = async (territory: AtlasTerritory) => {
    if (travelling || territory.cellId === activeCellId) return;
    const registry = (window as AtlasWindow).__ASYMPTA_EARTH_WEBMCP__;
    if (!registry) return;
    setTravelling(true);
    try {
      window.dispatchEvent(
        new CustomEvent("asympta:user-task-process", {
          detail: {
            label: "Territory transfer",
            detail: `${territory.label} · ${territory.cellId}`,
            progress: 18,
            tone: "moving",
          },
        }),
      );
      await registry.invoke("earth_travel_to", {
        name: territory.label,
        lat: territory.center.lat,
        lng: territory.center.lng,
      });
      setSelectedId(territory.id);
    } finally {
      setTravelling(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const tools: AtlasTool[] = [
      {
        name: "territory_list",
        title: "List the 625 geo territories",
        description:
          "List the 25 by 25 Earth-cell territory atlas around the user's home geo cell. Places remain evidence-backed; territory cells themselves are geographic partitions.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () =>
          JSON.stringify({
            ok: atlas.length === TERRITORY_ATLAS_COUNT,
            count: atlas.length,
            territories: atlas.map((territory) => ({
              id: territory.id,
              label: territory.label,
              cellId: territory.cellId,
              lat: territory.center.lat,
              lng: territory.center.lng,
              simulatedResidents: territory.simulatedResidents,
              activity: territory.activity,
              places: placeCounts[territory.cellId] ?? 0,
            })),
          }),
      },
      {
        name: "territory_enter",
        title: "Enter a geo territory",
        description:
          "Travel Your Agent into one territory from the 625-cell atlas using the Earth movement runtime.",
        inputSchema: {
          type: "object",
          properties: { territoryId: { type: "string" } },
          required: ["territoryId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input) => {
          const territory = atlas.find((item) => item.id === String(input.territoryId));
          if (!territory) return JSON.stringify({ ok: false, error: "Territory not found." });
          await enterTerritory(territory);
          return JSON.stringify({ ok: true, territoryId: territory.id, cellId: territory.cellId });
        },
      },
    ];

    const target = window as AtlasWindow;
    target.__ASYMPTA_TERRITORY_ATLAS__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown territory tool: " + name);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };

    const modelContext = (document as unknown as {
      modelContext?: {
        registerTool: (
          tool: AtlasTool,
          options?: { signal?: AbortSignal },
        ) => Promise<void> | void;
      };
    }).modelContext;
    if (modelContext?.registerTool) {
      tools.forEach((tool) => {
        void Promise.resolve(
          modelContext.registerTool(tool, { signal: controller.signal }),
        ).catch(() => undefined);
      });
    }

    return () => {
      controller.abort();
      delete target.__ASYMPTA_TERRITORY_ATLAS__;
    };
  }, [atlas, placeCounts]);

  if (!viewport || !homeCellId) return null;

  return createPortal(
    <>
      <style>{`
        .territory-atlas-control{position:absolute;z-index:176;right:max(58px,calc(env(safe-area-inset-right) + 58px));bottom:max(86px,calc(env(safe-area-inset-bottom) + 78px));pointer-events:auto}
        .territory-atlas-button{position:relative;display:grid;place-items:center;width:39px;height:39px;padding:0;border:1px solid rgba(112,124,115,.13);border-radius:50%;background:rgba(248,247,241,.86);color:#65746b;box-shadow:0 7px 22px rgba(49,60,53,.07);backdrop-filter:blur(12px);cursor:pointer}.territory-atlas-button svg{width:15px;height:15px}.territory-atlas-button b{position:absolute;right:-8px;top:-5px;min-width:27px;height:19px;padding:0 4px;border-radius:10px;background:#7184ad;color:white;font-family:var(--pixel-font);font-size:.24rem;line-height:19px;text-align:center}
        .territory-atlas-panel{position:absolute;z-index:175;left:50%;top:max(54px,calc(env(safe-area-inset-top) + 46px));display:grid;gap:9px;width:min(520px,calc(100vw - 24px));max-height:calc(100svh - 142px);overflow:auto;padding:12px;transform:translateX(-50%);border:1px solid rgba(112,124,115,.17);border-radius:18px;background:rgba(248,247,241,.97);box-shadow:0 18px 50px rgba(49,60,53,.12);color:#455149;backdrop-filter:blur(20px);pointer-events:auto;overscroll-behavior:contain;touch-action:pan-y}
        .territory-atlas-head{display:flex;align-items:flex-start;gap:8px}.territory-atlas-head>span{display:grid;gap:2px;min-width:0;flex:1}.territory-atlas-head strong{font-size:.66rem}.territory-atlas-head small{color:#7d8780;font-size:.38rem;line-height:1.35}.territory-atlas-close{display:grid;place-items:center;width:27px;height:27px;padding:0;border:0;border-radius:50%;background:rgba(90,103,94,.06);color:#707a73;cursor:pointer}.territory-atlas-close svg{width:12px;height:12px}
        .territory-atlas-search{display:flex;align-items:center;gap:6px;min-height:34px;padding:0 9px;border:1px solid rgba(112,123,115,.13);border-radius:10px;background:rgba(255,255,255,.2)}.territory-atlas-search svg{width:12px;height:12px;color:#838c86}.territory-atlas-search input{width:100%;border:0;outline:0;background:transparent;color:#59645d;font-size:.41rem}
        .territory-atlas-grid{display:grid;grid-template-columns:repeat(25,minmax(0,1fr));gap:2px;padding:7px;border:1px solid rgba(112,123,115,.1);border-radius:13px;background:rgba(255,255,255,.17)}.territory-cell{aspect-ratio:1;padding:0;border:1px solid rgba(111,123,114,.08);border-radius:2px;background:rgba(105,119,108,.04);cursor:pointer}.territory-cell:hover,.territory-cell.is-selected{border-color:rgba(118,139,181,.42);background:rgba(118,139,181,.12)}.territory-cell.is-active{background:rgba(103,143,117,.2);border-color:rgba(103,143,117,.45)}.territory-cell.has-place{box-shadow:inset 0 0 0 1px rgba(160,128,86,.22)}.territory-cell.is-filtered{opacity:.09;pointer-events:none}
        .territory-atlas-detail{display:grid;gap:7px;padding:9px;border-radius:12px;background:rgba(105,119,108,.045)}.territory-atlas-detail header{display:flex;align-items:center;gap:6px}.territory-atlas-detail header svg{width:12px;height:12px;color:#6d82ac}.territory-atlas-detail header strong{font-size:.53rem}.territory-atlas-meta{display:flex;flex-wrap:wrap;gap:5px}.territory-atlas-meta span{display:inline-flex;align-items:center;gap:4px;padding:5px 6px;border-radius:8px;background:rgba(255,255,255,.22);color:#707a73;font-family:var(--pixel-font);font-size:.28rem}.territory-atlas-meta svg{width:9px;height:9px}.territory-atlas-enter{display:flex;align-items:center;justify-content:center;gap:5px;min-height:32px;border:1px solid rgba(118,139,181,.2);border-radius:9px;background:rgba(118,139,181,.08);color:#59709d;font-family:var(--pixel-font);font-size:.3rem;cursor:pointer}.territory-atlas-enter:disabled{opacity:.45;cursor:default}.territory-atlas-enter svg{width:11px;height:11px}
        @media(max-width:620px){.territory-atlas-control{right:max(54px,calc(env(safe-area-inset-right) + 54px));bottom:max(84px,calc(env(safe-area-inset-bottom) + 76px))}.territory-atlas-panel{left:9px;right:9px;top:max(50px,calc(env(safe-area-inset-top) + 42px));width:auto;transform:none;max-height:calc(100svh - 138px)}.territory-atlas-grid{gap:1px;padding:5px}.territory-cell{border-radius:1px}}
      `}</style>

      <div className="territory-atlas-control">
        <button
          type="button"
          className="territory-atlas-button"
          aria-label="Open 625 territory atlas"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Map aria-hidden="true" />
          <b>{atlas.length}</b>
        </button>
      </div>

      {open ? (
        <section
          className="territory-atlas-panel"
          aria-label="625 real geo-cell territories"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="territory-atlas-head">
            <Map aria-hidden="true" style={{ width: 17, height: 17 }} />
            <span>
              <strong>Territory Atlas · {atlas.length}</strong>
              <small>25×25 real geo cells around your home cell. Only evidence-backed places appear inside them.</small>
            </span>
            <button type="button" className="territory-atlas-close" aria-label="Close territory atlas" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>
          </div>

          <label className="territory-atlas-search">
            <Search aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search territory / geo cell / coordinate" aria-label="Search territories" />
          </label>

          <div className="territory-atlas-grid" aria-label="Select one of 625 territories">
            {atlas.map((territory) => {
              const visible = filtered.some((item) => item.id === territory.id);
              const places = placeCounts[territory.cellId] ?? 0;
              return (
                <button
                  type="button"
                  key={territory.id}
                  className={[
                    "territory-cell",
                    territory.id === selected?.id ? "is-selected" : "",
                    territory.cellId === activeCellId ? "is-active" : "",
                    places > 0 ? "has-place" : "",
                    visible ? "" : "is-filtered",
                  ].filter(Boolean).join(" ")}
                  title={`${territory.label} · ${territory.cellId} · ${places} contributed places`}
                  aria-label={`${territory.label}, ${territory.cellId}, ${places} contributed places`}
                  onClick={() => setSelectedId(territory.id)}
                />
              );
            })}
          </div>

          {selected ? (
            <section className="territory-atlas-detail">
              <header><Map aria-hidden="true" /><strong>{selected.label}</strong></header>
              <div className="territory-atlas-meta">
                <span>{selected.cellId}</span>
                <span>{selected.center.lat.toFixed(4)}, {selected.center.lng.toFixed(4)}</span>
                <span><Users aria-hidden="true" />~{selected.simulatedResidents} simulated agents</span>
                <span>{selected.activity}% activity</span>
                <span>{placeCounts[selected.cellId] ?? 0} evidence-backed places</span>
              </div>
              <button
                type="button"
                className="territory-atlas-enter"
                disabled={travelling || selected.cellId === activeCellId}
                onClick={() => void enterTerritory(selected)}
              >
                <Navigation aria-hidden="true" />
                {selected.cellId === activeCellId ? "CURRENT TERRITORY" : travelling ? "TRAVELLING…" : "ENTER TERRITORY"}
              </button>
            </section>
          ) : null}
        </section>
      ) : null}
    </>,
    viewport,
    "territory-atlas-runtime",
  );
}

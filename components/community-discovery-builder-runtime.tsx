"use client";

import { Building2, Check, Compass, Hammer, Search, Sparkles, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  discoverCommunityGap,
  emptyDiscoveryState,
  proposalDescription,
  startDiscoveryProject,
  updateDiscoveryProject,
  type DiscoveryProject,
  type DiscoveryProposal,
  type DiscoveryState,
} from "@/lib/community-discovery";
import type { GeoOpportunity, GeoPlace, GeoPoint } from "@/lib/earth-world";

type RuntimeTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};
type EarthRegistry = { invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown> };
type DiscoveryWindow = Window & {
  __ASYMPTA_EARTH_WEBMCP__?: EarthRegistry;
  __ASYMPTA_DISCOVERY_WEBMCP__?: { tools: RuntimeTool[]; invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown> };
};
type EarthObserve = {
  ok?: boolean;
  activeCellId?: string;
  userLocation?: GeoPoint;
  agent?: GeoPoint & { cellId?: string };
};
type EarthPlaces = { ok?: boolean; places?: GeoPlace[] };
type EarthOpportunities = { ok?: boolean; opportunities?: Array<GeoOpportunity & { distanceMeters?: number }> };
type EvidenceResponse = { ok?: boolean; evidence?: { id?: string } };
type ProcessResponse = { ok?: boolean; place?: GeoPlace; xpGain?: number; error?: string };

const DISCOVERY_KEY = "asympta-community-discovery-v1";
const AUTO_KEY = "asympta-community-discovery-auto-v1";
const AUTO_FIRST_DELAY = 58_000;
const AUTO_COOLDOWN = 4 * 60_000;
const MAX_AUTO_OPENINGS = 4;

function delay(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function loadState(): DiscoveryState {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY);
    if (!raw) return emptyDiscoveryState();
    const parsed = JSON.parse(raw) as DiscoveryState;
    return parsed.version === 1 && Array.isArray(parsed.projects) ? parsed : emptyDiscoveryState();
  } catch { return emptyDiscoveryState(); }
}
function saveState(state: DiscoveryState) {
  try { localStorage.setItem(DISCOVERY_KEY, JSON.stringify(state)); } catch { /* memory fallback */ }
}
function loadAuto() {
  try { return localStorage.getItem(AUTO_KEY) !== "off"; } catch { return true; }
}
function saveAuto(value: boolean) {
  try { localStorage.setItem(AUTO_KEY, value ? "on" : "off"); } catch { /* memory fallback */ }
}
function emitProcess(label: string, detail: string, progress: number, tone: string) {
  window.dispatchEvent(new CustomEvent("asympta:user-task-process", { detail: { label, detail, progress, tone } }));
}
function stageLabel(stage: DiscoveryProject["stage"]) {
  const labels: Record<DiscoveryProject["stage"], string> = {
    observing: "觀察需求",
    gap: "發現缺口",
    planning: "設計服務",
    evidence: "建立 proposal evidence",
    review: "社區評估",
    building: "建設中",
    open: "已開放",
  };
  return labels[stage];
}
function activeProject(state: DiscoveryState) {
  return state.projects.find((project) => project.stage !== "open") ?? state.projects[0] ?? null;
}
async function earthInvoke(name: string, input: Record<string, unknown> = {}) {
  const registry = (window as DiscoveryWindow).__ASYMPTA_EARTH_WEBMCP__;
  if (!registry) throw new Error("Earth WebMCP runtime is not ready yet.");
  return registry.invoke(name, input);
}
async function worldContext() {
  const [observedRaw, placesRaw, opportunitiesRaw] = await Promise.all([
    earthInvoke("earth_observe_world"),
    earthInvoke("earth_search_places", { query: "" }),
    earthInvoke("earth_search_opportunities", { query: "" }),
  ]);
  const observed = observedRaw as EarthObserve;
  const places = placesRaw as EarthPlaces;
  const opportunities = opportunitiesRaw as EarthOpportunities;
  const origin = observed.userLocation;
  const cellId = observed.activeCellId ?? observed.agent?.cellId;
  if (!origin || !cellId) throw new Error("Enable real geolocation before the community can build a local service or facility.");
  return { origin, cellId, places: places.places ?? [], opportunities: opportunities.opportunities ?? [] };
}
function findOpenedPlace(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(".earth-place")).find((node) => node.textContent?.includes(name)) ?? null;
}
function celebratePlace(name: string) {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const node = findOpenedPlace(name);
    if (!node && attempts < 24) return;
    window.clearInterval(timer);
    if (!node) return;
    node.classList.add("is-community-opening");
    window.setTimeout(() => node.classList.remove("is-community-opening"), 9000);
  }, 180);
}

export function CommunityDiscoveryBuilderRuntime() {
  const stateRef = useRef<DiscoveryState>(emptyDiscoveryState());
  const busyRef = useRef(false);
  const [state, setState] = useState<DiscoveryState>(emptyDiscoveryState());
  const [barHost, setBarHost] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [message, setMessage] = useState("Discover what this community still needs.");

  const commit = useCallback((next: DiscoveryState) => {
    stateRef.current = next;
    saveState(next);
    setState(clone(next));
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => {
      const loaded = loadState();
      stateRef.current = loaded;
      setState(clone(loaded));
      setAuto(loadAuto());
    }, 0);
    const scan = window.setInterval(() => {
      const bar = document.querySelector<HTMLElement>(".earth-bar");
      const view = document.querySelector<HTMLElement>(".world-viewport");
      setBarHost((current) => current === bar ? current : bar);
      setViewport((current) => current === view ? current : view);
    }, 420);
    return () => { window.clearTimeout(first); window.clearInterval(scan); };
  }, []);

  useEffect(() => {
    if (open) document.documentElement.dataset.discoveryBuilderOpen = "true";
    else delete document.documentElement.dataset.discoveryBuilderOpen;
    return () => { delete document.documentElement.dataset.discoveryBuilderOpen; };
  }, [open]);

  const discover = useCallback(async (showPanel = true) => {
    if (busyRef.current) return null;
    try {
      setMessage("Agent is observing local needs and missing capabilities…");
      emitProcess("觀察社區需求", "比較現有 stores / services / facilities / open jobs", 8, "planning");
      const context = await worldContext();
      await delay(1300);
      const proposal = discoverCommunityGap(context.places, context.opportunities, context.origin, context.cellId, Date.now());
      const next = startDiscoveryProject(proposal, stateRef.current, Date.now());
      commit(updateDiscoveryProject(next, proposal.id, { stage: "gap", progress: 18, supporters: 1 }, Date.now()));
      setMessage(`${proposal.name} · ${proposal.reason}`);
      emitProcess("發現服務缺口", `${proposal.need} → ${proposal.name}`, 18, "planning");
      if (showPanel) setOpen(true);
      return proposal;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Discovery could not start.");
      return null;
    }
  }, [commit]);

  const build = useCallback(async (proposalInput: DiscoveryProposal | DiscoveryProject) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    const id = proposalInput.id;
    try {
      let next = updateDiscoveryProject(stateRef.current, id, { stage: "planning", progress: 30, supporters: 2 }, Date.now());
      commit(next);
      setMessage("Agent is turning the need into a concrete service/facility plan.");
      emitProcess("設計新服務", `${proposalInput.name} · 定義 offerings / rules / human handoff`, 30, "working");
      await delay(2200);

      next = updateDiscoveryProject(stateRef.current, id, { stage: "evidence", progress: 48, supporters: 2 }, Date.now());
      commit(next);
      setMessage("Creating proposal evidence. This is community-created, not a claimed existing POI.");
      emitProcess("建立 Proposal Evidence", "標記 community-created · pending local verification", 48, "working");
      const evidenceRaw = await earthInvoke("earth_submit_local_evidence", {
        placeName: proposalInput.name,
        kind: proposalInput.kind,
        description: proposalDescription(proposalInput),
        lat: proposalInput.lat,
        lng: proposalInput.lng,
      });
      const evidence = evidenceRaw as EvidenceResponse;
      const evidenceId = evidence.evidence?.id;
      if (!evidence.ok || !evidenceId) throw new Error("Earth runtime did not accept the discovery proposal evidence.");
      await delay(1900);

      const supporters = 3 + (proposalInput.name.length % 4);
      next = updateDiscoveryProject(stateRef.current, id, { stage: "review", progress: 66, supporters }, Date.now());
      commit(next);
      setMessage(`${supporters} simulated community signals agree this gap is useful enough to prototype.`);
      emitProcess("社區評估", `${supporters} signals · usefulness / overlap / local need`, 66, "talking");
      await delay(2300);

      next = updateDiscoveryProject(stateRef.current, id, { stage: "building", progress: 84, supporters }, Date.now());
      commit(next);
      setMessage("Store Agent is structuring the service catalog and building the place into Earth state.");
      emitProcess("建設新地點", `${proposalInput.name} · 寫入 catalog / brightness / opportunity hooks`, 84, "working");
      const processedRaw = await earthInvoke("earth_process_submission", {
        evidenceId,
        summary: `Community-created ${proposalInput.kind} for ${proposalInput.need}. Pending local verification.`,
        extractedCatalog: proposalInput.offerings.map((offering, index) => ({
          id: `${proposalInput.id}-offering-${index + 1}`,
          name: offering.name,
          type: offering.type,
          price: offering.price,
          availability: 4,
          tags: offering.tags,
        })),
      });
      const processed = processedRaw as ProcessResponse;
      if (!processed.ok || !processed.place) throw new Error(processed.error ?? "Store Agent could not build the new place.");
      await delay(900);

      next = updateDiscoveryProject(stateRef.current, id, { stage: "open", progress: 100, supporters, builtPlaceId: processed.place.id }, Date.now());
      next = { ...next, lastAutoDiscoveryAt: Date.now() };
      commit(next);
      setMessage(`${processed.place.name} is now in the world · ${Math.round(processed.place.brightness * 100)}% brightness · verification job remains open.`);
      emitProcess("新服務正式開放", `${processed.place.name} · +${processed.xpGain ?? 0} XP · 待現場驗證`, 100, "done");
      celebratePlace(processed.place.name);
      window.dispatchEvent(new CustomEvent("asympta:discovery-place-opened", { detail: { projectId: id, place: processed.place } }));
      return processed.place;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Discovery build failed.");
      emitProcess("建設暫停", error instanceof Error ? error.message : "Discovery build failed", 84, "blocked");
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [commit]);

  useEffect(() => {
    if (!auto) return;
    const first = window.setTimeout(async () => {
      const current = stateRef.current;
      if (busyRef.current || current.openedCount >= MAX_AUTO_OPENINGS || Date.now() - current.lastAutoDiscoveryAt < AUTO_COOLDOWN) return;
      const proposal = await discover(false);
      if (!proposal) return;
      const marked = { ...stateRef.current, lastAutoDiscoveryAt: Date.now() };
      commit(marked);
      await delay(4200);
      void build(proposal);
    }, AUTO_FIRST_DELAY);
    const repeat = window.setInterval(async () => {
      const current = stateRef.current;
      if (busyRef.current || current.openedCount >= MAX_AUTO_OPENINGS || Date.now() - current.lastAutoDiscoveryAt < AUTO_COOLDOWN) return;
      const proposal = await discover(false);
      if (!proposal) return;
      commit({ ...stateRef.current, lastAutoDiscoveryAt: Date.now() });
      await delay(4200);
      void build(proposal);
    }, AUTO_COOLDOWN);
    return () => { window.clearTimeout(first); window.clearInterval(repeat); };
  }, [auto, build, commit, discover]);

  useEffect(() => {
    saveAuto(auto);
  }, [auto]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: RuntimeTool[] = [
      {
        name: "earth_discover_service_gap",
        title: "Discover a missing local service or facility",
        description: "Observe community-built places and open opportunities, then propose one useful missing service, facility or community node without importing third-party POIs.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => {
          const context = await worldContext();
          return JSON.stringify({ ok: true, proposal: discoverCommunityGap(context.places, context.opportunities, context.origin, context.cellId, Date.now()) });
        },
      },
      {
        name: "earth_observe_discovery_projects",
        title: "Observe community discovery projects",
        description: "Read active and recently opened service/facility discovery projects and their real build stage.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => JSON.stringify({ ok: true, projects: stateRef.current.projects, auto: loadAuto() }),
      },
      {
        name: "earth_start_discovery_project",
        title: "Start a missing-service discovery project",
        description: "Create a visible discovery project from the current local gap analysis. It does not fabricate an existing real-world POI.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async () => {
          const proposal = await discover(false);
          return JSON.stringify(proposal ? { ok: true, proposal } : { ok: false, error: "Discovery could not start." });
        },
      },
      {
        name: "earth_build_discovery_project",
        title: "Build a discovered service or facility",
        description: "Advance a discovery project through planning, proposal evidence, community review, catalog structuring and Earth place creation. The created place remains pending local verification.",
        inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input) => {
          const project = stateRef.current.projects.find((item) => item.id === String(input.projectId));
          if (!project) return JSON.stringify({ ok: false, error: "Discovery project not found." });
          const place = await build(project);
          return JSON.stringify(place ? { ok: true, place } : { ok: false, error: "Build did not complete." });
        },
      },
    ];
    const runtime = window as DiscoveryWindow;
    runtime.__ASYMPTA_DISCOVERY_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error(`Unknown discovery WebMCP tool: ${name}`);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };
    const modelContext = (document as unknown as { modelContext?: { registerTool: (tool: RuntimeTool, options?: { signal?: AbortSignal }) => Promise<void> | void } }).modelContext;
    if (modelContext?.registerTool) tools.forEach((tool) => { void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => undefined); });
    return () => { controller.abort(); delete runtime.__ASYMPTA_DISCOVERY_WEBMCP__; };
  }, [build, discover]);

  const current = useMemo(() => activeProject(state), [state]);
  const opened = useMemo(() => state.projects.filter((project) => project.stage === "open").slice(0, 4), [state.projects]);

  return (
    <>
      <style>{`
        .discovery-pill { color:#64755f!important; }
        .discovery-pill svg { color:#75945e; }
        .discovery-builder-panel { position:absolute; z-index:145; left:max(12px,env(safe-area-inset-left)); top:max(148px,calc(env(safe-area-inset-top) + 148px)); width:min(342px,calc(100vw - 24px)); max-height:calc(100svh - 236px); overflow:auto; padding:12px; border:1px solid rgba(105,125,108,.18); border-radius:17px; background:rgba(248,247,241,.97); box-shadow:0 18px 54px rgba(49,62,52,.12); color:#414b43; backdrop-filter:blur(18px); }
        .discovery-head { display:flex; justify-content:space-between; gap:10px; }
        .discovery-head span { display:grid; gap:2px; }
        .discovery-head strong { font-size:.65rem; }
        .discovery-head small { color:#828c84; font-size:.36rem; line-height:1.35; }
        .discovery-close { display:grid; place-items:center; width:28px; height:28px; flex:0 0 28px; border:0; border-radius:50%; background:rgba(97,111,100,.06); color:#68736b; }
        .discovery-close svg { width:12px; height:12px; }
        .discovery-status { margin-top:8px; padding:7px 8px; border-radius:10px; background:rgba(111,137,104,.055); color:#68736b; font-size:.39rem; line-height:1.35; }
        .discovery-card { display:grid; gap:7px; margin-top:9px; padding:9px; border:1px solid rgba(109,124,112,.12); border-radius:12px; background:rgba(255,255,255,.2); }
        .discovery-card header { display:flex; justify-content:space-between; gap:8px; align-items:start; }
        .discovery-card header span { display:grid; gap:2px; }
        .discovery-card header strong { font-size:.54rem; }
        .discovery-card header small { color:#849087; font-family:var(--pixel-font); font-size:.28rem; }
        .discovery-score { padding:4px 6px; border-radius:999px; background:rgba(117,144,94,.09); color:#657d55; font-family:var(--pixel-font); font-size:.28rem; white-space:nowrap; }
        .discovery-reason { color:#69746c; font-size:.39rem; line-height:1.42; }
        .discovery-progress { height:3px; overflow:hidden; border-radius:99px; background:rgba(105,118,109,.1); }
        .discovery-progress i { display:block; height:100%; border-radius:inherit; background:#7a9b66; }
        .discovery-stage { display:flex; justify-content:space-between; gap:8px; color:#7b867e; font-family:var(--pixel-font); font-size:.28rem; }
        .discovery-offerings { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; }
        .discovery-offering { min-width:0; padding:5px 6px; border-radius:8px; background:rgba(101,119,105,.045); color:#68736b; font-size:.34rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .discovery-actions { display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }
        .discovery-action { display:inline-flex; align-items:center; gap:5px; min-height:32px; padding:0 9px; border:1px solid rgba(112,131,104,.17); border-radius:9px; background:rgba(112,142,93,.07); color:#607653; font-size:.38rem; cursor:pointer; }
        .discovery-action svg { width:11px; height:11px; }
        .discovery-action:disabled { opacity:.45; cursor:default; }
        .discovery-auto { background:rgba(118,139,181,.06); color:#60749b; border-color:rgba(118,139,181,.16); }
        .discovery-opened { display:grid; gap:4px; margin-top:10px; }
        .discovery-opened-label { color:#879088; font-family:var(--pixel-font); font-size:.28rem; text-transform:uppercase; letter-spacing:.05em; }
        .discovery-opened-row { display:flex; align-items:center; gap:6px; padding:5px 6px; border-radius:8px; background:rgba(95,122,102,.045); color:#667269; font-size:.36rem; }
        .discovery-opened-row svg { width:10px; height:10px; color:#719265; }
        .earth-place.is-community-opening { z-index:40!important; opacity:1!important; animation:community-opening-glow 1.1s ease-in-out 8 alternate; }
        .earth-place.is-community-opening::before,.earth-place.is-community-opening::after { content:"✦"; position:absolute; z-index:3; color:#d7b96b; font-size:12px; text-shadow:0 0 8px rgba(211,184,104,.55); animation:community-opening-spark 1.2s ease-in-out infinite alternate; }
        .earth-place.is-community-opening::before { left:4px; top:-8px; }
        .earth-place.is-community-opening::after { right:3px; top:8px; animation-delay:.35s; }
        @keyframes community-opening-glow { from { filter:drop-shadow(0 0 4px rgba(121,163,119,.18)); } to { filter:drop-shadow(0 0 16px rgba(121,163,119,.48)) drop-shadow(0 0 9px rgba(213,184,101,.3)); transform:translate(-50%,-50%) scale(1.07); } }
        @keyframes community-opening-spark { from { opacity:.35; transform:translateY(3px) scale(.8); } to { opacity:1; transform:translateY(-3px) scale(1.18); } }
        html[data-discovery-builder-open="true"] .earth-panel,html[data-discovery-builder-open="true"] .places-directory-control { opacity:0!important; pointer-events:none!important; }
        @media(max-width:620px){ .discovery-builder-panel { left:9px; right:9px; top:max(202px,calc(env(safe-area-inset-top) + 202px)); width:auto; max-height:calc(100svh - 300px); } .discovery-offerings { grid-template-columns:1fr; } }
        @media(prefers-reduced-motion:reduce){ .earth-place.is-community-opening { animation:none; } .earth-place.is-community-opening::before,.earth-place.is-community-opening::after { animation:none; } }
      `}</style>
      {barHost ? createPortal(
        <button type="button" className="earth-pill discovery-pill" onClick={() => setOpen((value) => !value)} aria-expanded={open} title="Discover and build missing community services or facilities">
          <Compass aria-hidden="true" />Discover{current && current.stage !== "open" ? ` · ${current.progress}%` : ""}
        </button>,
        barHost,
        "community-discovery-pill",
      ) : null}
      {open && viewport ? createPortal(
        <section className="discovery-builder-panel" aria-label="Discover and build community services or facilities">
          <div className="discovery-head"><span><strong>Discover & Build</strong><small>Find a real community capability gap, prototype it, then leave local verification work for humans.</small></span><button type="button" className="discovery-close" onClick={() => setOpen(false)} aria-label="Close discovery builder"><X aria-hidden="true" /></button></div>
          <div className="discovery-status">{message}</div>
          {current ? <article className="discovery-card">
            <header><span><strong>{current.name}</strong><small>{current.kind} · {current.need}</small></span><b className="discovery-score">gap {current.score.toFixed(1)}</b></header>
            <div className="discovery-reason">{current.reason}</div>
            <div className="discovery-progress"><i style={{ width: `${current.progress}%` }} /></div>
            <div className="discovery-stage"><span>{stageLabel(current.stage)}</span><span>{current.supporters} community signals</span></div>
            <div className="discovery-offerings">{current.offerings.map((offering) => <span className="discovery-offering" key={offering.name}>{offering.name}{offering.price !== undefined ? ` · ₡${offering.price}` : ""}</span>)}</div>
          </article> : null}
          <div className="discovery-actions">
            <button type="button" className="discovery-action" disabled={busy} onClick={() => void discover(true)}><Search aria-hidden="true" />DISCOVER GAP</button>
            {current && current.stage !== "open" ? <button type="button" className="discovery-action" disabled={busy} onClick={() => void build(current)}><Hammer aria-hidden="true" />LET AGENT BUILD</button> : null}
            <button type="button" className="discovery-action discovery-auto" onClick={() => setAuto((value) => !value)}><Sparkles aria-hidden="true" />AUTO {auto ? "ON" : "OFF"}</button>
          </div>
          {opened.length ? <div className="discovery-opened"><span className="discovery-opened-label">Recently community-built</span>{opened.map((project) => <div className="discovery-opened-row" key={project.id}><Check aria-hidden="true" /><span>{project.name} · {project.kind} · pending local verification</span></div>)}</div> : null}
          <div className="discovery-opened-row" style={{ marginTop: 9 }}><Users aria-hidden="true" /><span>Physical-world truth still needs human evidence; the agent never pretends a new digital proposal is already a verified real facility.</span></div>
        </section>,
        viewport,
        "community-discovery-panel",
      ) : null}
    </>
  );
}

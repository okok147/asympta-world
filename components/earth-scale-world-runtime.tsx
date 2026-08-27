"use client";

import {
  BriefcaseBusiness,
  Camera,
  Compass,
  Crosshair,
  FileImage,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  Store,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  cellFor,
  cellFromId,
  createEvidence,
  createLocalOpportunity,
  earthWorldDefault,
  haversineMeters,
  moveAgentGeo,
  neighboringCells,
  processEvidence,
  projectIntoNeighborhood,
  searchOpportunities,
  setUserLocation,
  workOpportunity,
  type EarthWorldState,
  type GeoCatalogItem,
  type GeoOpportunity,
  type GeoPlace,
  type GeoPlaceKind,
  type GeoPoint,
} from "@/lib/earth-world";

type RuntimeTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};
type EarthWindow = Window & {
  __ASYMPTA_EARTH_WEBMCP__?: {
    tools: RuntimeTool[];
    invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  };
};
type Panel = "none" | "places" | "contribute" | "jobs";

const EARTH_KEY = "asympta-earth-world-v1";
const MODE_KEY = "asympta-earth-mode-v1";
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 760;

function delay(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function cloneState(state: EarthWorldState): EarthWorldState {
  return JSON.parse(JSON.stringify(state)) as EarthWorldState;
}
function loadEarth() {
  try {
    const raw = localStorage.getItem(EARTH_KEY);
    if (!raw) return earthWorldDefault(Date.now());
    const parsed = JSON.parse(raw) as EarthWorldState;
    return parsed.version === 1 && Array.isArray(parsed.places) && Array.isArray(parsed.opportunities)
      ? parsed
      : earthWorldDefault(Date.now());
  } catch { return earthWorldDefault(Date.now()); }
}
function saveEarth(state: EarthWorldState) {
  try { localStorage.setItem(EARTH_KEY, JSON.stringify(state)); } catch { /* memory fallback */ }
}
function emitProcess(label: string, detail: string, progress: number, tone: string) {
  window.dispatchEvent(new CustomEvent("asympta:user-task-process", { detail: { label, detail, progress, tone } }));
}
function distanceLabel(meters: number) {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
}
function currentWorldPosition() {
  const node = document.querySelector<HTMLElement>(".mission-user-agent");
  if (!node) return null;
  return { x: Number.parseFloat(node.style.left) || node.offsetLeft || 600, y: Number.parseFloat(node.style.top) || node.offsetTop || 380 };
}
function dispatchWorldTarget(x: number, y: number, durationMs = 14000) {
  window.dispatchEvent(new CustomEvent("asympta:agent-motion-target", { detail: { agentName: "Your Agent", x, y, durationMs } }));
}
async function waitWorldArrival(x: number, y: number, timeout = 18000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const point = currentWorldPosition();
    if (point && Math.hypot(point.x - x, point.y - y) <= 38) return true;
    await delay(180);
  }
  return false;
}
function centerOfCell(cellId: string): GeoPoint | null {
  const cell = cellFromId(cellId);
  return cell ? { lat: (cell.south + cell.north) / 2, lng: (cell.west + cell.east) / 2 } : null;
}
function lineValue(seed: string, salt: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index) + salt; hash = Math.imul(hash, 16777619); }
  return ((hash >>> 0) % 1000) / 1000;
}
function placeLines(id: string) {
  const a = 8 + lineValue(id, 1) * 7; const b = 42 - lineValue(id, 2) * 7; const mid = 21 + lineValue(id, 3) * 8;
  return [`M ${a} 31 Q ${mid} 5 ${b} 31`, `M ${a + 3} 31 L ${b - 3} 31`, `M ${mid - 7} 31 L ${mid - 7} 19 L ${mid + 7} 19 L ${mid + 7} 31`];
}
async function imageThumbnail(file: File) {
  if (!file.type.startsWith("image/")) return undefined;
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const node = new Image(); node.onload = () => resolve(node); node.onerror = () => reject(new Error("Unable to decode image")); node.src = source;
  });
  const scale = Math.min(1, 360 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d"); if (!context) return source;
  context.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/jpeg", .72);
}
function parseCatalogInput(value: unknown): GeoCatalogItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 24).map((entry, index) => {
    const row = entry as Record<string, unknown>; const type = row.type === "service" ? "service" : "product";
    return { id: String(row.id ?? `catalog-${index + 1}`), name: String(row.name ?? `Item ${index + 1}`).slice(0, 64), type, price: typeof row.price === "number" ? row.price : undefined, availability: typeof row.availability === "number" ? row.availability : 1, tags: Array.isArray(row.tags) ? row.tags.map(String).slice(0, 8) : [type] };
  });
}

export function EarthScaleWorldRuntime() {
  const stateRef = useRef<EarthWorldState>(earthWorldDefault(0));
  const [state, setState] = useState<EarthWorldState>(earthWorldDefault(0));
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [status, setStatus] = useState("Earth substrate ready · enable location");
  const [placeName, setPlaceName] = useState("");
  const [placeKind, setPlaceKind] = useState<GeoPlaceKind>("store");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [linkedJobId, setLinkedJobId] = useState<string | undefined>();
  const [jobTitle, setJobTitle] = useState("");
  const [jobSummary, setJobSummary] = useState("");
  const [jobAgentTask, setJobAgentTask] = useState("");
  const [jobHumanTask, setJobHumanTask] = useState("");
  const [busy, setBusy] = useState(false);

  const commit = useCallback((next: EarthWorldState) => { stateRef.current = next; saveEarth(next); setState(cloneState(next)); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadEarth(); stateRef.current = loaded; setState(cloneState(loaded));
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane")); setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      document.documentElement.dataset.earthWorld = "true";
      try { localStorage.setItem(MODE_KEY, "earth"); } catch { /* ignore */ }
      dispatchWorldTarget(600, 380, 9000);
      setStatus(loaded.userLocation ? `Earth · ${loaded.activeCellId}` : "Earth · location not enabled");
    }, 0);
    return () => { window.clearTimeout(timer); delete document.documentElement.dataset.earthWorld; };
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setStatus("Geolocation is unavailable in this browser"); return; }
    setStatus("Requesting device geolocation…");
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      const next = setUserLocation(stateRef.current, point, Date.now()); commit(next); dispatchWorldTarget(600, 380, 8000);
      setStatus(`Located · ${next.activeCellId}`); emitProcess("定位世界", `進入 ${next.activeCellId} · 世界仍保持空白，等待社區發現`, 100, "done");
    }, () => setStatus("Location permission was not granted · no location is fabricated"), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }, [commit]);

  const travelTo = useCallback(async (target: GeoPoint & { name: string }) => {
    setBusy(true);
    try {
      const currentCell = cellFromId(stateRef.current.activeCellId ?? stateRef.current.agent.cellId); const targetCell = cellFor(target.lat, target.lng);
      if (!currentCell) return false;
      let row = currentCell.row; let col = currentCell.col; let completed = 0;
      const totalHops = Math.max(Math.abs(targetCell.row - row), Math.abs(targetCell.col - col));
      emitProcess("規劃跨區移動", `${target.name} · ${distanceLabel(haversineMeters(stateRef.current.agent, target))}`, 10, "planning");
      while (row !== targetCell.row || col !== targetCell.col) {
        const rowStep = Math.sign(targetCell.row - row); const colStep = Math.sign(targetCell.col - col); row += rowStep; col += colStep; completed += 1;
        const nextId = `geo-${row}-${col}`; const center = centerOfCell(nextId); if (!center) break;
        emitProcess("跨越社區邊界", `${nextId} · ${completed}/${totalHops}`, clamp(15 + completed / Math.max(1, totalHops) * 55, 15, 70), "moving");
        dispatchWorldTarget(colStep > 0 ? 1035 : colStep < 0 ? 165 : 600, rowStep > 0 ? 175 : rowStep < 0 ? 585 : 380, 6500);
        await delay(totalHops > 8 ? 260 : 850); commit(moveAgentGeo(stateRef.current, center, `Crossed into ${nextId}`, Date.now())); dispatchWorldTarget(600, 380, 5200);
        if (completed >= 10 && totalHops > 12) {
          const targetCenter = centerOfCell(targetCell.id); if (targetCenter) commit(moveAgentGeo(stateRef.current, targetCenter, `Long-distance transfer · ${targetCell.id}`, Date.now()));
          emitProcess("跨區長途移動", `已略過 ${Math.max(0, totalHops - completed)} 個空白 cells · 不使用既有道路`, 72, "moving"); break;
        }
      }
      commit({ ...stateRef.current, activeCellId: targetCell.id }); await delay(260);
      const projected = projectIntoNeighborhood(targetCell.id, target, WORLD_WIDTH, WORLD_HEIGHT) ?? { x: 600, y: 380 };
      emitProcess("接近目的地", target.name, 82, "moving"); dispatchWorldTarget(projected.x, projected.y, 16000);
      const arrived = await waitWorldArrival(projected.x, projected.y, 18000);
      if (!arrived) { emitProcess("未完成到達", `${target.name} · 不會假裝完成現實活動`, 82, "blocked"); return false; }
      commit(moveAgentGeo(stateRef.current, target, `Arrived · ${target.name}`, Date.now())); emitProcess("已到達", `${target.name} · 可開始現場活動`, 100, "done"); return true;
    } finally { setBusy(false); }
  }, [commit]);

  const submitContribution = useCallback(async () => {
    const location = stateRef.current.userLocation ?? ((stateRef.current.agent.lat || stateRef.current.agent.lng) ? { lat: stateRef.current.agent.lat, lng: stateRef.current.agent.lng } : undefined);
    if (!location) { setStatus("Enable geolocation before contributing local information"); return; }
    if (!placeName.trim() || (!description.trim() && !file)) { setStatus("Add a place name and either a description or image"); return; }
    setBusy(true);
    try {
      emitProcess("提交在地資訊", `${placeName} · 建立 evidence`, 12, "planning"); const thumbnail = file ? await imageThumbnail(file) : undefined;
      let next = createEvidence(stateRef.current, { placeName, kind: placeKind, description, lat: location.lat, lng: location.lng, imageName: file?.name, imageDataUrl: thumbnail, linkedOpportunityId: linkedJobId }, Date.now());
      commit(next); const evidenceId = next.evidence[0]?.id; if (!evidenceId) return;
      setStatus("Store Agent · reading submitted evidence"); emitProcess("Store Agent · 讀取資料", file ? "圖片已建立輕量 reference；文字與 metadata 正在整理" : "正在理解描述與價格資訊", 30, "working"); await delay(850);
      next = { ...stateRef.current, evidence: stateRef.current.evidence.map((item) => item.id === evidenceId ? { ...item, status: "reading" as const, updatedAt: Date.now() } : item) }; commit(next);
      emitProcess("Store Agent · 結構化", "整理 products / services / prices / availability", 58, "working"); await delay(950);
      const result = processEvidence(stateRef.current, evidenceId, {}, Date.now()); if (!result.ok) { setStatus(result.error); return; }
      commit(result.state); setStatus(`${result.place.name} built · +${result.xpGain} XP`); emitProcess("社區地點已建立", `${result.place.name} · +${result.xpGain} XP · completeness ${Math.round(result.place.completeness * 100)}%`, 100, "done");
      setPlaceName(""); setDescription(""); setFile(null); setLinkedJobId(undefined); setPanel("places"); setSelectedPlaceId(result.place.id);
    } finally { setBusy(false); }
  }, [commit, description, file, linkedJobId, placeKind, placeName]);

  const runOpportunity = useCallback(async (opportunity: GeoOpportunity) => {
    emitProcess("Opportunity Mode", `${opportunity.title} · agent 正在判斷 agent/human 分工`, 15, "planning");
    if (opportunity.humanTasks.length && haversineMeters(stateRef.current.agent, opportunity) < 5000) {
      const arrived = await travelTo({ lat: opportunity.lat, lng: opportunity.lng, name: opportunity.title }); if (!arrived) return;
    }
    setBusy(true);
    try {
      emitProcess("Agent 執行可自動部分", opportunity.agentTasks.join(" · ") || "沒有 agent-side steps", 60, "working"); await delay(1000);
      const result = workOpportunity(stateRef.current, opportunity.id, Date.now()); if (!result.ok) return;
      const nextState = result.state as EarthWorldState; commit(nextState);
      if (result.opportunity.status === "human-needed") { setStatus(`Human handoff ready · ${opportunity.title}`); emitProcess("整理人類 Handoff", result.opportunity.handoff ?? "Human action required", 82, "talking"); }
      else { setStatus(`Opportunity complete · +${result.xpGain} XP`); emitProcess("Opportunity 完成", `${opportunity.title} · +${result.xpGain} XP`, 100, "done"); }
    } finally { setBusy(false); }
  }, [commit, travelTo]);

  const postJob = useCallback(() => {
    if (!jobTitle.trim() || !jobSummary.trim()) return;
    const origin = stateRef.current.userLocation ?? { lat: stateRef.current.agent.lat, lng: stateRef.current.agent.lng };
    commit(createLocalOpportunity(stateRef.current, { title: jobTitle, summary: jobSummary, lat: origin.lat, lng: origin.lng, rewardXp: 70, agentTasks: jobAgentTask.split(/\n|;/).filter(Boolean), humanTasks: jobHumanTask.split(/\n|;/).filter(Boolean) }, Date.now()));
    setJobTitle(""); setJobSummary(""); setJobAgentTask(""); setJobHumanTask(""); setStatus("Local opportunity posted to this geo cell");
  }, [commit, jobAgentTask, jobHumanTask, jobSummary, jobTitle]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: RuntimeTool[] = [
      { name: "earth_observe_world", title: "Observe Earth-scale Asympta World", description: "Read current geo cell, discovered places, XP, agent mode and open opportunities. No imported roads or POIs.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async () => JSON.stringify({ ok: true, activeCellId: stateRef.current.activeCellId, userLocation: stateRef.current.userLocation, discoveredPlaces: stateRef.current.places.length, contributor: stateRef.current.contributor, agent: stateRef.current.agent }) },
      { name: "earth_list_cells", title: "List nearby geolocation cells", description: "Return current cell and eight neighbors. Borders are management coordinates only, not imported routes.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async () => JSON.stringify({ ok: true, cells: neighboringCells(stateRef.current.activeCellId ?? stateRef.current.agent.cellId) }) },
      { name: "earth_search_places", title: "Search community-discovered places", description: "Search only locations built from contributed evidence. No third-party POI database.", inputSchema: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: async (input) => { const text = String(input.query ?? "").toLowerCase(); const origin = stateRef.current.userLocation ?? stateRef.current.agent; return JSON.stringify({ ok: true, places: stateRef.current.places.filter((place) => !text || `${place.name} ${place.summary} ${place.catalog.map((item) => item.name).join(" ")}`.toLowerCase().includes(text)).map((place) => ({ ...place, distanceMeters: haversineMeters(origin, place) })).sort((a, b) => a.distanceMeters - b.distanceMeters) }); } },
      { name: "earth_submit_local_evidence", title: "Submit local evidence", description: "Create geolocated store/service/facility evidence from a human description and optional image reference.", inputSchema: { type: "object", properties: { placeName: { type: "string" }, kind: { type: "string", enum: ["store", "service", "facility", "community"] }, description: { type: "string" }, lat: { type: "number" }, lng: { type: "number" }, imageDataUrl: { type: "string" }, imageName: { type: "string" }, linkedOpportunityId: { type: "string" } }, required: ["placeName", "kind", "lat", "lng"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: async (input) => { const next = createEvidence(stateRef.current, { placeName: String(input.placeName), kind: input.kind as GeoPlaceKind, description: String(input.description ?? ""), lat: Number(input.lat), lng: Number(input.lng), imageDataUrl: typeof input.imageDataUrl === "string" ? input.imageDataUrl : undefined, imageName: typeof input.imageName === "string" ? input.imageName : undefined, linkedOpportunityId: typeof input.linkedOpportunityId === "string" ? input.linkedOpportunityId : undefined }, Date.now()); commit(next); return JSON.stringify({ ok: true, evidence: next.evidence[0] }); } },
      { name: "earth_process_submission", title: "Store Agent: structure local evidence", description: "Convert human text or a connected vision agent's extractedCatalog into products/services, build the place and award XP.", inputSchema: { type: "object", properties: { evidenceId: { type: "string" }, summary: { type: "string" }, extractedCatalog: { type: "array" } }, required: ["evidenceId"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: async (input) => { const result = processEvidence(stateRef.current, String(input.evidenceId), { summary: typeof input.summary === "string" ? input.summary : undefined, extractedCatalog: parseCatalogInput(input.extractedCatalog) }, Date.now()); if (result.ok) commit(result.state); return JSON.stringify(result.ok ? { ok: true, place: result.place, xpGain: result.xpGain } : result); } },
      { name: "earth_contributor_profile", title: "Read contributor XP", description: "Read XP, level and completed local information jobs.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async () => JSON.stringify({ ok: true, contributor: stateRef.current.contributor }) },
      { name: "earth_search_opportunities", title: "Search local jobs and opportunities", description: "Find nearby work and expose agent-capable versus human-required steps.", inputSchema: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: async (input) => JSON.stringify({ ok: true, opportunities: searchOpportunities(stateRef.current, stateRef.current.userLocation ?? stateRef.current.agent, String(input.query ?? "")) }) },
      { name: "earth_work_opportunity", title: "Work an opportunity", description: "Complete agent-capable steps and create a concise human handoff for physical or human-only steps.", inputSchema: { type: "object", properties: { opportunityId: { type: "string" } }, required: ["opportunityId"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input) => { const result = workOpportunity(stateRef.current, String(input.opportunityId), Date.now()); if (result.ok) commit(result.state as EarthWorldState); return JSON.stringify(result); } },
      { name: "earth_post_opportunity", title: "Post a local opportunity", description: "Create a geolocated job with explicit agent tasks and human tasks.", inputSchema: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, lat: { type: "number" }, lng: { type: "number" }, rewardXp: { type: "number" }, agentTasks: { type: "array" }, humanTasks: { type: "array" } }, required: ["title", "summary", "lat", "lng"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: async (input) => { const next = createLocalOpportunity(stateRef.current, { title: String(input.title), summary: String(input.summary), lat: Number(input.lat), lng: Number(input.lng), rewardXp: typeof input.rewardXp === "number" ? input.rewardXp : undefined, agentTasks: Array.isArray(input.agentTasks) ? input.agentTasks.map(String) : undefined, humanTasks: Array.isArray(input.humanTasks) ? input.humanTasks.map(String) : undefined }, Date.now()); commit(next); return JSON.stringify({ ok: true, opportunity: next.opportunities[0] }); } },
      { name: "earth_travel_to", title: "Travel across geo borders", description: "Move Your Agent through blank geo cells without imported road routes, and only finish after arrival.", inputSchema: { type: "object", properties: { name: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } }, required: ["name", "lat", "lng"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: async (input) => JSON.stringify({ ok: await travelTo({ name: String(input.name), lat: Number(input.lat), lng: Number(input.lng) }) }) },
    ];
    const earthWindow = window as EarthWindow; earthWindow.__ASYMPTA_EARTH_WEBMCP__ = { tools, invoke: async (name, input = {}) => { const tool = tools.find((item) => item.name === name); if (!tool) throw new Error(`Unknown Earth WebMCP tool: ${name}`); return JSON.parse(await tool.execute(input)) as unknown; } };
    const modelContext = (document as unknown as { modelContext?: { registerTool: (tool: RuntimeTool, options?: { signal?: AbortSignal }) => Promise<void> | void } }).modelContext;
    if (modelContext?.registerTool) tools.forEach((tool) => { void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => undefined); });
    return () => { controller.abort(); delete earthWindow.__ASYMPTA_EARTH_WEBMCP__; };
  }, [commit, travelTo]);

  const centerId = state.activeCellId ?? state.agent.cellId;
  const cells = useMemo(() => neighboringCells(centerId), [centerId]);
  const origin = useMemo<GeoPoint>(() => state.userLocation ?? { lat: state.agent.lat, lng: state.agent.lng }, [state.agent.lat, state.agent.lng, state.userLocation]);
  const visiblePlaces = useMemo(() => state.places.map((place) => ({ place, projected: projectIntoNeighborhood(centerId, place, WORLD_WIDTH, WORLD_HEIGHT) })).filter((item): item is { place: GeoPlace; projected: { x: number; y: number } } => Boolean(item.projected)), [centerId, state.places]);
  const searchedPlaces = useMemo(() => { const text = query.toLowerCase(); return state.places.filter((place) => !text || `${place.name} ${place.summary} ${place.catalog.map((item) => item.name).join(" ")}`.toLowerCase().includes(text)).map((place) => ({ ...place, distance: haversineMeters(origin, place) })).sort((a, b) => a.distance - b.distance); }, [origin, query, state.places]);
  const opportunities = useMemo(() => searchOpportunities(state, origin, jobQuery), [jobQuery, origin, state]);
  const selectedPlace = state.places.find((place) => place.id === selectedPlaceId);

  if (!worldPlane || !viewport) return null;
  return <>
    <style>{`
      html[data-earth-world="true"] .latent-city-layer,html[data-earth-world="true"] .community-layer,html[data-earth-world="true"] .route-market-store,html[data-earth-world="true"] .community-founded-place,html[data-earth-world="true"] .world-agent:not(.mission-user-agent),html[data-earth-world="true"] .places-directory-control{display:none!important}
      .earth-layer{position:absolute;inset:0;z-index:7;pointer-events:none}.earth-cell{position:absolute;width:400px;height:253.333px;border:1px solid rgba(100,115,106,.12);box-sizing:border-box}.earth-cell.is-center{border-color:rgba(104,124,111,.28)}.earth-cell-label{position:absolute;left:8px;top:7px;color:rgba(93,106,97,.32);font-family:var(--pixel-font);font-size:.28rem}.earth-cell-empty{position:absolute;inset:0;display:grid;place-items:center;color:rgba(93,106,97,.09);font-family:var(--pixel-font);font-size:.35rem}.earth-place{position:absolute;z-index:12;width:98px;height:68px;padding:0;transform:translate(-50%,-50%);border:0;background:transparent;pointer-events:auto;cursor:pointer;color:#67746b}.earth-place svg{position:absolute;left:25px;top:3px;width:48px;height:36px}.earth-place svg path{fill:none;stroke:currentColor;stroke-width:.85;stroke-linecap:round}.earth-place-name{position:absolute;left:0;right:0;bottom:3px;color:#5d6961;font-family:var(--pixel-font);font-size:.34rem;text-align:center}.earth-place-bright{position:absolute;left:50%;top:22px;width:26px;height:26px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(139,177,143,.24),rgba(118,139,181,.08) 45%,transparent 72%);filter:blur(4px)}
      .earth-control{position:absolute;z-index:108;left:max(12px,env(safe-area-inset-left));top:max(58px,calc(env(safe-area-inset-top) + 58px));width:min(340px,calc(100vw - 24px));pointer-events:none}.earth-bar,.earth-panel{pointer-events:auto}.earth-bar{display:flex;gap:4px;width:max-content;max-width:100%;padding:4px;border:1px solid rgba(112,123,115,.14);border-radius:999px;background:rgba(248,247,241,.86);backdrop-filter:blur(14px)}.earth-pill{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:#657169;font-size:.36rem;cursor:pointer}.earth-pill svg{width:11px;height:11px}.earth-panel{margin-top:7px;padding:11px;border:1px solid rgba(112,123,115,.16);border-radius:16px;background:rgba(248,247,241,.96);box-shadow:0 14px 42px rgba(54,63,58,.11);color:#414a44;backdrop-filter:blur(18px)}.earth-panel header{display:flex;justify-content:space-between;gap:8px}.earth-panel header span{display:grid;gap:2px}.earth-panel strong{font-size:.58rem}.earth-panel small{color:#838b85;font-size:.34rem}.earth-close{width:26px;height:26px;border:0;border-radius:50%;background:rgba(90,103,94,.06);color:#69736d}.earth-close svg{width:11px;height:11px}.earth-field{display:flex;align-items:center;gap:5px;min-height:32px;margin-top:7px;padding:0 8px;border:1px solid rgba(111,123,114,.13);border-radius:9px;background:rgba(255,255,255,.2)}.earth-field svg{width:11px;height:11px}.earth-field input,.earth-field select,.earth-field textarea{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#555f59;font-size:.4rem}.earth-field textarea{min-height:62px;padding:6px 0}.earth-list{display:grid;gap:4px;max-height:230px;margin-top:8px;overflow:auto}.earth-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 7px;border:0;border-radius:9px;background:rgba(102,116,106,.045);text-align:left;color:#4e5852}.earth-row span{display:grid;gap:2px}.earth-row strong{font-size:.45rem}.earth-row small{color:#7d867f;font-size:.31rem}.earth-row b{font-family:var(--pixel-font);font-size:.28rem}.earth-action{display:inline-flex;align-items:center;gap:5px;min-height:32px;margin-top:8px;padding:0 9px;border:1px solid rgba(118,139,181,.18);border-radius:9px;background:rgba(118,139,181,.07);color:#5d729e;font-size:.38rem}.earth-action svg{width:11px;height:11px}.earth-handoff{margin-top:7px;padding:8px;border-radius:9px;background:rgba(161,132,95,.07);font-size:.38rem;line-height:1.45;white-space:pre-line}.earth-status{position:absolute;z-index:107;left:max(12px,env(safe-area-inset-left));bottom:max(62px,calc(env(safe-area-inset-bottom) + 62px));padding:5px 8px;border-radius:9px;background:rgba(248,247,241,.72);color:#79817b;font-family:var(--pixel-font);font-size:.29rem}.earth-inspector{position:absolute;z-index:106;right:12px;bottom:70px;width:min(292px,calc(100vw - 24px));padding:11px;border:1px solid rgba(112,123,115,.16);border-radius:16px;background:rgba(248,247,241,.96);color:#414a44;pointer-events:auto}.earth-catalog{display:grid;gap:3px;margin-top:7px}.earth-catalog-line{display:grid;grid-template-columns:1fr auto;gap:7px;padding:5px 6px;border-radius:7px;background:rgba(99,114,104,.04);font-size:.37rem}.earth-stat{display:inline-block;margin:5px 4px 0 0;padding:4px 5px;border-radius:7px;background:rgba(99,114,104,.05);font-family:var(--pixel-font);font-size:.27rem}@media(max-width:620px){.earth-control{left:9px;top:54px;width:min(310px,calc(100vw - 18px))}.earth-bar{overflow:auto}.earth-inspector{left:9px;right:9px;width:auto}}
    `}</style>
    {createPortal(<div className="earth-layer" aria-label="Earth-scale blank geolocation world built only from community discovery">
      {cells.map((cell,index)=><div key={cell.id} className={"earth-cell"+(cell.id===centerId?" is-center":"")} style={{left:(index%3)*400,top:Math.floor(index/3)*(760/3)}}><span className="earth-cell-label">{cell.id}{cell.id===centerId?" · ACTIVE":""}</span>{!state.places.some((place)=>place.cellId===cell.id)?<span className="earth-cell-empty">UNDISCOVERED</span>:null}</div>)}
      {visiblePlaces.map(({place,projected})=><button type="button" className="earth-place" key={place.id} style={{left:projected.x,top:projected.y,opacity:.28+place.brightness*.72,filter:`drop-shadow(0 0 ${2+place.brightness*8}px rgba(112,151,122,${.05+place.brightness*.18}))`}} onClick={()=>setSelectedPlaceId(place.id)}><i className="earth-place-bright" style={{opacity:place.brightness}}/><svg viewBox="0 0 50 36">{placeLines(place.id).map((path,index)=><path d={path} key={index}/>)}</svg><span className="earth-place-name">{place.name}</span></button>)}
    </div>,worldPlane)}
    {createPortal(<><div className="earth-control"><div className="earth-bar"><button className="earth-pill" type="button" onClick={locate}><LocateFixed/>LOCATE</button><button className="earth-pill" type="button" onClick={()=>setPanel(panel==="places"?"none":"places")}><MapPin/>Places · {state.places.length}</button><button className="earth-pill" type="button" onClick={()=>setPanel(panel==="contribute"?"none":"contribute")}><Upload/>Contribute</button><button className="earth-pill" type="button" onClick={()=>setPanel(panel==="jobs"?"none":"jobs")}><BriefcaseBusiness/>Jobs · {state.opportunities.filter((item)=>item.status!=="completed").length}</button><span className="earth-pill"><Sparkles/>LV{state.contributor.level} · {state.contributor.xp}XP</span></div>
      {panel==="places"?<section className="earth-panel"><header><span><strong>Community-built places</strong><small>No imported POIs · brightness comes from contributed information</small></span><button className="earth-close" onClick={()=>setPanel("none")}><X/></button></header><label className="earth-field"><Search/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search discovered places / products / services"/></label><div className="earth-list">{searchedPlaces.length?searchedPlaces.map((place)=><button className="earth-row" key={place.id} onClick={()=>{setSelectedPlaceId(place.id);void travelTo({lat:place.lat,lng:place.lng,name:place.name});}}><span><strong>{place.name}</strong><small>{place.kind} · {Math.round(place.completeness*100)}% info · {place.catalog.length} items</small></span><b>{distanceLabel(place.distance)}</b></button>):<div className="earth-row"><span><strong>Nothing here yet</strong><small>This is intentional: the Earth layer starts empty.</small></span><b>—</b></div>}</div></section>:null}
      {panel==="contribute"?<section className="earth-panel"><header><span><strong>Build the local world</strong><small>Upload real local information · Store Agent structures it · earn XP</small></span><button className="earth-close" onClick={()=>setPanel("none")}><X/></button></header>{linkedJobId?<div className="earth-handoff">Completing local job: {state.opportunities.find((item)=>item.id===linkedJobId)?.title}</div>:null}<label className="earth-field"><Store/><input value={placeName} onChange={(event)=>setPlaceName(event.target.value)} placeholder="Store / service / facility name"/></label><label className="earth-field"><select value={placeKind} onChange={(event)=>setPlaceKind(event.target.value as GeoPlaceKind)}><option value="store">Store</option><option value="service">Service</option><option value="facility">Facility</option><option value="community">Community</option></select></label><label className="earth-field"><Camera/><textarea value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="Description / product list / service list / prices"/></label><label className="earth-field"><FileImage/><input type="file" accept="image/*" onChange={(event)=>setFile(event.target.files?.[0]??null)}/></label><button className="earth-action" disabled={busy} onClick={()=>void submitContribution()}><Upload/>UPLOAD & BUILD</button></section>:null}
      {panel==="jobs"?<section className="earth-panel"><header><span><strong>Opportunity Mode</strong><small>Agent finishes agent-capable work; physical/human steps become a clean handoff</small></span><button className="earth-close" onClick={()=>setPanel("none")}><X/></button></header><label className="earth-field"><Search/><input value={jobQuery} onChange={(event)=>setJobQuery(event.target.value)} placeholder="Search job / opportunity"/></label><button className="earth-action" disabled={busy} onClick={()=>{const best=searchOpportunities(stateRef.current,stateRef.current.userLocation??stateRef.current.agent,jobQuery)[0];if(best)void runOpportunity(best);}}><Compass/>AGENT SEARCH MODE</button><div className="earth-list">{opportunities.slice(0,10).map((job)=><button className="earth-row" key={job.id} onClick={()=>void runOpportunity(job)}><span><strong>{job.title}</strong><small>{job.kind} · agent {job.agentTasks.length} · human {job.humanTasks.length}</small></span><b>+{job.rewardXp}XP · {distanceLabel(job.distanceMeters)}</b></button>)}</div>{opportunities.find((item)=>item.status==="human-needed"&&item.handoff)?<div className="earth-handoff">{opportunities.find((item)=>item.status==="human-needed"&&item.handoff)?.handoff}</div>:null}<label className="earth-field"><input value={jobTitle} onChange={(event)=>setJobTitle(event.target.value)} placeholder="Post local job title"/></label><label className="earth-field"><input value={jobSummary} onChange={(event)=>setJobSummary(event.target.value)} placeholder="What needs to be done?"/></label><label className="earth-field"><textarea value={jobAgentTask} onChange={(event)=>setJobAgentTask(event.target.value)} placeholder="Agent-capable steps; separate with ;"/></label><label className="earth-field"><textarea value={jobHumanTask} onChange={(event)=>setJobHumanTask(event.target.value)} placeholder="Human / physical steps; separate with ;"/></label><button className="earth-action" onClick={postJob}><BriefcaseBusiness/>POST LOCAL OPPORTUNITY</button></section>:null}
    </div><div className="earth-status">{status}</div></>,viewport)}
    {selectedPlace?createPortal(<aside className="earth-inspector"><header><strong>{selectedPlace.name}</strong><button className="earth-close" onClick={()=>setSelectedPlaceId(null)}><X/></button></header><span className="earth-stat">info {Math.round(selectedPlace.completeness*100)}%</span><span className="earth-stat">confidence {Math.round(selectedPlace.confidence*100)}%</span><span className="earth-stat">evidence {selectedPlace.evidenceIds.length}</span><span className="earth-stat">brightness {Math.round(selectedPlace.brightness * 100)}%</span><div className="earth-catalog">{selectedPlace.catalog.length?selectedPlace.catalog.map((item)=><div className="earth-catalog-line" key={item.id}><span>{item.name}</span><span>{item.type}{item.price!==undefined?` · $${item.price}`:""}</span></div>):<div className="earth-catalog-line"><span>Photo / basic evidence exists, but catalog still needs community or connected AI extraction</span><span>incomplete</span></div>}</div><button className="earth-action" disabled={busy} onClick={()=>void travelTo({lat:selectedPlace.lat,lng:selectedPlace.lng,name:selectedPlace.name})}><Crosshair/>GO TO PLACE</button>{selectedPlace.completeness<.86?<button className="earth-action" onClick={()=>{const job=state.opportunities.find((item)=>item.placeId===selectedPlace.id&&item.status!=="completed");setLinkedJobId(job?.id);setPlaceName(selectedPlace.name);setPlaceKind(selectedPlace.kind);setPanel("contribute");}}><Camera/>ADD MISSING INFO · EARN XP</button>:null}</aside>,viewport):null}
  </>;
}

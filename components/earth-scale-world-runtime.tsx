"use client";

import {
  BriefcaseBusiness,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  FileImage,
  LocateFixed,
  MapPin,
  PackageSearch,
  Search,
  Sparkles,
  Store,
  Upload,
  UserRoundSearch,
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

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cloneState(state: EarthWorldState): EarthWorldState {
  return {
    ...state,
    userLocation: state.userLocation ? { ...state.userLocation } : undefined,
    places: state.places.map((place) => ({
      ...place,
      catalog: place.catalog.map((item) => ({ ...item, tags: [...item.tags] })),
      evidenceIds: [...place.evidenceIds],
    })),
    evidence: state.evidence.map((item) => ({
      ...item,
      extractedCatalog: item.extractedCatalog.map((catalog) => ({ ...catalog, tags: [...catalog.tags] })),
    })),
    opportunities: state.opportunities.map((item) => ({
      ...item,
      agentTasks: [...item.agentTasks],
      humanTasks: [...item.humanTasks],
      agentCompleted: [...item.agentCompleted],
      humanCompleted: [...item.humanCompleted],
    })),
    contributor: { ...state.contributor },
    agent: { ...state.agent },
  };
}

function loadEarth() {
  try {
    const raw = localStorage.getItem(EARTH_KEY);
    if (!raw) return earthWorldDefault(Date.now());
    const parsed = JSON.parse(raw) as EarthWorldState;
    if (parsed.version !== 1 || !Array.isArray(parsed.places) || !Array.isArray(parsed.opportunities)) {
      return earthWorldDefault(Date.now());
    }
    return parsed;
  } catch {
    return earthWorldDefault(Date.now());
  }
}

function saveEarth(state: EarthWorldState) {
  try { localStorage.setItem(EARTH_KEY, JSON.stringify(state)); } catch { /* memory fallback */ }
}

function emitProcess(label: string, detail: string, progress: number, tone: string) {
  window.dispatchEvent(new CustomEvent("asympta:user-task-process", {
    detail: { label, detail, progress, tone },
  }));
}

function parseCatalogInput(value: unknown): GeoCatalogItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 24).map((item, index) => {
    const row = item as Record<string, unknown>;
    const type = row.type === "service" ? "service" : "product";
    return {
      id: typeof row.id === "string" ? row.id : `catalog-${index + 1}`,
      name: String(row.name ?? `Item ${index + 1}`).slice(0, 64),
      type,
      price: typeof row.price === "number" ? row.price : undefined,
      availability: typeof row.availability === "number" ? row.availability : 1,
      tags: Array.isArray(row.tags) ? row.tags.map(String).slice(0, 8) : [type],
    } satisfies GeoCatalogItem;
  });
}

function lineValue(seed: string, salt: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index) + salt;
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function placeLines(id: string) {
  const a = 8 + lineValue(id, 1) * 7;
  const b = 42 - lineValue(id, 2) * 7;
  const mid = 21 + lineValue(id, 3) * 8;
  return [
    `M ${a} 31 Q ${mid} 5 ${b} 31`,
    `M ${a + 3} 31 L ${b - 3} 31`,
    `M ${mid - 7} 31 L ${mid - 7} 19 L ${mid + 7} 19 L ${mid + 7} 31`,
  ];
}

function distanceLabel(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
}

function currentWorldPosition() {
  const node = document.querySelector<HTMLElement>(".mission-user-agent");
  if (!node) return null;
  return {
    x: Number.parseFloat(node.style.left) || node.offsetLeft || 600,
    y: Number.parseFloat(node.style.top) || node.offsetTop || 380,
  };
}

async function waitWorldArrival(x: number, y: number, timeout = 18000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = currentWorldPosition();
    if (current && Math.hypot(current.x - x, current.y - y) <= 38) return true;
    await delay(180);
  }
  return false;
}

function dispatchWorldTarget(x: number, y: number, durationMs = 14000) {
  window.dispatchEvent(new CustomEvent("asympta:agent-motion-target", {
    detail: { agentName: "Your Agent", x, y, durationMs },
  }));
}

async function imageThumbnail(file: File) {
  if (!file.type.startsWith("image/")) return undefined;
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error("Unable to decode image"));
    next.src = source;
  });
  const max = 360;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function centerOfCell(cellId: string): GeoPoint | null {
  const cell = cellFromId(cellId);
  return cell ? { lat: (cell.south + cell.north) / 2, lng: (cell.west + cell.east) / 2 } : null;
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
  const [jobHumanTask, setJobHumanTask] = useState("");
  const [jobAgentTask, setJobAgentTask] = useState("");
  const [busy, setBusy] = useState(false);

  const commit = useCallback((next: EarthWorldState) => {
    stateRef.current = next;
    saveEarth(next);
    setState(cloneState(next));
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const loaded = loadEarth();
      stateRef.current = loaded;
      setState(cloneState(loaded));
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane"));
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      document.documentElement.dataset.earthWorld = "true";
      try { localStorage.setItem(MODE_KEY, "earth"); } catch { /* ignore */ }
      dispatchWorldTarget(600, 380, 9000);
      setStatus(loaded.userLocation ? `Earth · ${loaded.activeCellId}` : "Earth · location not enabled");
    }, 0);
    return () => {
      window.clearTimeout(initialize);
      delete document.documentElement.dataset.earthWorld;
    };
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is unavailable in this browser");
      return;
    }
    setStatus("Requesting device geolocation…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        const next = setUserLocation(stateRef.current, point, Date.now());
        commit(next);
        dispatchWorldTarget(600, 380, 8000);
        setStatus(`Located · ${next.activeCellId}`);
        emitProcess("定位世界", `進入 ${next.activeCellId} · 世界仍保持空白，等待社區發現`, 100, "done");
      },
      () => setStatus("Location permission was not granted · no location is fabricated"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [commit]);

  const travelTo = useCallback(async (target: GeoPoint & { name: string }) => {
    if (busy) return false;
    setBusy(true);
    try {
      const current = stateRef.current;
      const currentCell = cellFromId(current.activeCellId ?? current.agent.cellId);
      const targetCell = cellFor(target.lat, target.lng);
      if (!currentCell) return false;
      emitProcess("規劃跨區移動", `${target.name} · ${distanceLabel(haversineMeters(current.agent, target))}`, 10, "planning");
      let row = currentCell.row;
      let col = currentCell.col;
      const totalHops = Math.max(Math.abs(targetCell.row - row), Math.abs(targetCell.col - col));
      let completed = 0;
      while (row !== targetCell.row || col !== targetCell.col) {
        const rowStep = Math.sign(targetCell.row - row);
        const colStep = Math.sign(targetCell.col - col);
        row += rowStep;
        col += colStep;
        completed += 1;
        const nextId = `geo-${row}-${col}`;
        const center = centerOfCell(nextId);
        if (!center) break;
        const percent = clamp(15 + (completed / Math.max(1, totalHops)) * 55, 15, 70);
        emitProcess("跨越社區邊界", `${nextId} · ${completed}/${totalHops}`, percent, "moving");
        dispatchWorldTarget(colStep > 0 ? 1035 : colStep < 0 ? 165 : 600, rowStep > 0 ? 175 : rowStep < 0 ? 585 : 380, 6500);
        await delay(totalHops > 8 ? 260 : 850);
        const moved = moveAgentGeo(stateRef.current, center, `Crossed into ${nextId}`, Date.now());
        commit(moved);
        dispatchWorldTarget(600, 380, 5200);
        if (completed >= 10 && totalHops > 12) {
          row = targetCell.row;
          col = targetCell.col;
          const targetCenter = centerOfCell(targetCell.id);
          if (targetCenter) commit(moveAgentGeo(stateRef.current, targetCenter, `Long-distance transfer · ${targetCell.id}`, Date.now()));
          emitProcess("跨區長途移動", `已略過 ${Math.max(0, totalHops - completed)} 個空白 cells · 不使用既有道路`, 72, "moving");
          break;
        }
      }
      const nextCellState = { ...stateRef.current, activeCellId: targetCell.id };
      commit(nextCellState);
      await delay(300);
      const projected = projectIntoNeighborhood(targetCell.id, target, WORLD_WIDTH, WORLD_HEIGHT) ?? { x: 600, y: 380 };
      emitProcess("接近目的地", target.name, 82, "moving");
      dispatchWorldTarget(projected.x, projected.y, 16000);
      const arrived = await waitWorldArrival(projected.x, projected.y, 18000);
      if (!arrived) {
        emitProcess("未完成到達", `${target.name} · 不會假裝完成現實活動`, 82, "blocked");
        return false;
      }
      commit(moveAgentGeo(stateRef.current, target, `Arrived · ${target.name}`, Date.now()));
      emitProcess("已到達", `${target.name} · 可開始現場活動`, 100, "done");
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy, commit]);

  const submitContribution = useCallback(async () => {
    const current = stateRef.current;
    const location = current.userLocation ?? (current.agent.lat || current.agent.lng ? { lat: current.agent.lat, lng: current.agent.lng } : undefined);
    if (!location) {
      setStatus("Enable geolocation before contributing local information");
      return;
    }
    if (!placeName.trim() || (!description.trim() && !file)) {
      setStatus("Add a place name and either a description or image");
      return;
    }
    setBusy(true);
    try {
      emitProcess("提交在地資訊", `${placeName} · 建立 evidence`, 12, "planning");
      const thumbnail = file ? await imageThumbnail(file) : undefined;
      let next = createEvidence(current, {
        placeName,
        kind: placeKind,
        description,
        lat: location.lat,
        lng: location.lng,
        imageName: file?.name,
        imageDataUrl: thumbnail,
        linkedOpportunityId: linkedJobId,
      }, Date.now());
      commit(next);
      const evidenceId = next.evidence[0]?.id;
      if (!evidenceId) return;
      setStatus("Store Agent · reading submitted evidence");
      emitProcess("Store Agent · 讀取資料", file ? "圖片已建立輕量 reference；文字與 metadata 正在整理" : "正在理解描述與價格資訊", 30, "working");
      await delay(900);
      next = {
        ...stateRef.current,
        evidence: stateRef.current.evidence.map((item) => item.id === evidenceId ? { ...item, status: "reading" as const, updatedAt: Date.now() } : item),
      };
      commit(next);
      emitProcess("Store Agent · 結構化", "整理 products / services / prices / availability", 58, "working");
      await delay(1050);
      const result = processEvidence(stateRef.current, evidenceId, {}, Date.now());
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      commit(result.state);
      setStatus(`${result.place.name} built · +${result.xpGain} XP`);
      emitProcess("社區地點已建立", `${result.place.name} · +${result.xpGain} XP · completeness ${Math.round(result.place.completeness * 100)}%`, 100, "done");
      setPlaceName("");
      setDescription("");
      setFile(null);
      setLinkedJobId(undefined);
      setPanel("places");
      setSelectedPlaceId(result.place.id);
    } finally {
      setBusy(false);
    }
  }, [commit, description, file, linkedJobId, placeKind, placeName]);

  const runOpportunity = useCallback(async (opportunity: GeoOpportunity) => {
    if (busy) return;
    setBusy(true);
    try {
      emitProcess("Opportunity Mode", `${opportunity.title} · agent 正在判斷 agent/human 分工`, 15, "planning");
      const distance = haversineMeters(stateRef.current.agent, opportunity);
      if (distance < 5000 && opportunity.humanTasks.length) {
        emitProcess("前往工作地點", `${opportunity.title} · ${distanceLabel(distance)}`, 28, "moving");
        setBusy(false);
        const arrived = await travelTo({ lat: opportunity.lat, lng: opportunity.lng, name: opportunity.title });
        setBusy(true);
        if (!arrived) return;
      }
      emitProcess("Agent 執行可自動部分", opportunity.agentTasks.join(" · ") || "沒有 agent-side steps", 60, "working");
      await delay(1100);
      const result = workOpportunity(stateRef.current, opportunity.id, Date.now());
      if (!result.ok) return;
      commit(result.state);
      if (result.opportunity.status === "human-needed") {
        setStatus(`Human handoff ready · ${opportunity.title}`);
        emitProcess("整理人類 Handoff", result.opportunity.handoff ?? "Human action required", 82, "talking");
      } else {
        setStatus(`Opportunity complete · +${result.xpGain} XP`);
        emitProcess("Opportunity 完成", `${opportunity.title} · +${result.xpGain} XP`, 100, "done");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, commit, travelTo]);

  const searchBestOpportunity = useCallback(async () => {
    const current = stateRef.current;
    const origin = current.userLocation ?? { lat: current.agent.lat, lng: current.agent.lng };
    const best = searchOpportunities(current, origin, jobQuery)[0];
    if (!best) {
      setStatus("No matching open opportunities in discovered community data");
      return;
    }
    await runOpportunity(best);
  }, [jobQuery, runOpportunity]);

  const postJob = useCallback(() => {
    const current = stateRef.current;
    const origin = current.userLocation ?? { lat: current.agent.lat, lng: current.agent.lng };
    if (!jobTitle.trim() || !jobSummary.trim()) return;
    const next = createLocalOpportunity(current, {
      title: jobTitle,
      summary: jobSummary,
      lat: origin.lat,
      lng: origin.lng,
      rewardXp: 70,
      agentTasks: jobAgentTask.split(/\n|;/).map((item) => item.trim()).filter(Boolean),
      humanTasks: jobHumanTask.split(/\n|;/).map((item) => item.trim()).filter(Boolean),
    }, Date.now());
    commit(next);
    setJobTitle(""); setJobSummary(""); setJobAgentTask(""); setJobHumanTask("");
    setStatus("Local opportunity posted to this geo cell");
  }, [commit, jobAgentTask, jobHumanTask, jobSummary, jobTitle]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: RuntimeTool[] = [
      {
        name: "earth_observe_world",
        title: "Observe the empty geolocation-built Asympta World",
        description: "Read the current geo cell, discovered places, contributor XP, agent mode and open opportunities. The world contains no imported roads or POIs.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => JSON.stringify({
          ok: true,
          activeCellId: stateRef.current.activeCellId,
          userLocation: stateRef.current.userLocation,
          discoveredPlaces: stateRef.current.places.length,
          evidenceCount: stateRef.current.evidence.length,
          openOpportunities: stateRef.current.opportunities.filter((item) => item.status !== "completed").length,
          contributor: stateRef.current.contributor,
          agent: stateRef.current.agent,
        }),
      },
      {
        name: "earth_list_cells",
        title: "List the active geolocation community cells",
        description: "Return the current cell and its eight neighboring management cells. Cells are coordinate borders only, not imported map routes.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => JSON.stringify({ ok: true, cells: neighboringCells(stateRef.current.activeCellId ?? stateRef.current.agent.cellId) }),
      },
      {
        name: "earth_search_places",
        title: "Search community-discovered local places",
        description: "Search only places that humans or agents have built from local evidence. No third-party POI database is queried.",
        inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 160 } }, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) => {
          const terms = String(input.query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
          const origin = stateRef.current.userLocation ?? stateRef.current.agent;
          const places = stateRef.current.places
            .filter((place) => !terms.length || terms.every((term) => `${place.name} ${place.summary} ${place.catalog.map((item) => item.name).join(" ")}`.toLowerCase().includes(term)))
            .map((place) => ({ ...place, distanceMeters: haversineMeters(origin, place) }))
            .sort((a, b) => a.distanceMeters - b.distanceMeters);
          return JSON.stringify({ ok: true, places });
        },
      },
      {
        name: "earth_submit_local_evidence",
        title: "Submit local store, service or facility evidence",
        description: "Create a geolocated community evidence record from a human description and optional image reference. Contributors earn XP after processing.",
        inputSchema: {
          type: "object",
          properties: {
            placeName: { type: "string", minLength: 1, maxLength: 80 },
            kind: { type: "string", enum: ["store", "service", "facility", "community"] },
            description: { type: "string", maxLength: 2400 },
            lat: { type: "number", minimum: -90, maximum: 90 },
            lng: { type: "number", minimum: -180, maximum: 180 },
            imageDataUrl: { type: "string" },
            imageName: { type: "string" },
            linkedOpportunityId: { type: "string" },
          },
          required: ["placeName", "kind", "lat", "lng"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const next = createEvidence(stateRef.current, {
            placeName: String(input.placeName),
            kind: (input.kind as GeoPlaceKind) ?? "store",
            description: String(input.description ?? ""),
            lat: Number(input.lat),
            lng: Number(input.lng),
            imageDataUrl: typeof input.imageDataUrl === "string" ? input.imageDataUrl : undefined,
            imageName: typeof input.imageName === "string" ? input.imageName : undefined,
            linkedOpportunityId: typeof input.linkedOpportunityId === "string" ? input.linkedOpportunityId : undefined,
          }, Date.now());
          commit(next);
          return JSON.stringify({ ok: true, evidence: next.evidence[0] });
        },
      },
      {
        name: "earth_process_submission",
        title: "Store Agent: convert local evidence into structured place information",
        description: "Structure products/services from description or from a connected vision agent's extractedCatalog, then build or update the geolocated place and award contributor XP.",
        inputSchema: {
          type: "object",
          properties: {
            evidenceId: { type: "string" },
            summary: { type: "string", maxLength: 300 },
            extractedCatalog: {
              type: "array",
              items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["product", "service"] }, price: { type: "number" }, availability: { type: "number" }, tags: { type: "array", items: { type: "string" } } }, required: ["name", "type"] },
            },
          },
          required: ["evidenceId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const result = processEvidence(stateRef.current, String(input.evidenceId), {
            summary: typeof input.summary === "string" ? input.summary : undefined,
            extractedCatalog: parseCatalogInput(input.extractedCatalog),
          }, Date.now());
          if (result.ok) commit(result.state);
          return JSON.stringify(result.ok ? { ok: true, place: result.place, xpGain: result.xpGain } : result);
        },
      },
      {
        name: "earth_contributor_profile",
        title: "Read local discovery contributor rewards",
        description: "Read XP, level, contribution count and completed community information jobs.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => JSON.stringify({ ok: true, contributor: stateRef.current.contributor }),
      },
      {
        name: "earth_search_opportunities",
        title: "Search local jobs and opportunities for the agent or human",
        description: "Find nearby opportunities and expose which steps are agent-capable versus human-required.",
        inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 180 } }, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) => {
          const origin = stateRef.current.userLocation ?? stateRef.current.agent;
          return JSON.stringify({ ok: true, opportunities: searchOpportunities(stateRef.current, origin, String(input.query ?? "")) });
        },
      },
      {
        name: "earth_work_opportunity",
        title: "Let Your Agent work a local opportunity",
        description: "Complete agent-capable steps. If physical or human judgment is required, produce a concise human handoff instead of pretending the agent completed it.",
        inputSchema: { type: "object", properties: { opportunityId: { type: "string" } }, required: ["opportunityId"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input) => {
          const result = workOpportunity(stateRef.current, String(input.opportunityId), Date.now());
          if (result.ok) commit(result.state);
          return JSON.stringify(result.ok ? { ok: true, opportunity: result.opportunity, xpGain: result.xpGain } : result);
        },
      },
      {
        name: "earth_post_opportunity",
        title: "Post a geolocated community job or opportunity",
        description: "Create a local job with explicit agent-side and human-side tasks. Hybrid jobs become clean human handoffs after the agent finishes its portion.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 2, maxLength: 100 },
            summary: { type: "string", minLength: 2, maxLength: 700 },
            lat: { type: "number", minimum: -90, maximum: 90 },
            lng: { type: "number", minimum: -180, maximum: 180 },
            rewardXp: { type: "number", minimum: 5, maximum: 1000 },
            agentTasks: { type: "array", items: { type: "string" } },
            humanTasks: { type: "array", items: { type: "string" } },
            placeId: { type: "string" },
          },
          required: ["title", "summary", "lat", "lng"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const next = createLocalOpportunity(stateRef.current, {
            title: String(input.title), summary: String(input.summary), lat: Number(input.lat), lng: Number(input.lng),
            rewardXp: typeof input.rewardXp === "number" ? input.rewardXp : undefined,
            agentTasks: Array.isArray(input.agentTasks) ? input.agentTasks.map(String) : undefined,
            humanTasks: Array.isArray(input.humanTasks) ? input.humanTasks.map(String) : undefined,
            placeId: typeof input.placeId === "string" ? input.placeId : undefined,
          }, Date.now());
          commit(next);
          return JSON.stringify({ ok: true, opportunity: next.opportunities[0] });
        },
      },
      {
        name: "earth_travel_to",
        title: "Travel Your Agent across geolocation community borders",
        description: "Move Your Agent through blank geo cells to a discovered latitude/longitude without using imported road routes, then only act after arrival.",
        inputSchema: { type: "object", properties: { name: { type: "string" }, lat: { type: "number", minimum: -90, maximum: 90 }, lng: { type: "number", minimum: -180, maximum: 180 } }, required: ["name", "lat", "lng"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => JSON.stringify({ ok: await travelTo({ name: String(input.name), lat: Number(input.lat), lng: Number(input.lng) }) }),
      },
    ];

    const earthWindow = window as EarthWindow;
    earthWindow.__ASYMPTA_EARTH_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error(`Unknown Earth WebMCP tool: ${name}`);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };
    const modelContext = (document as unknown as { modelContext?: { registerTool: (tool: RuntimeTool, options?: { signal?: AbortSignal }) => Promise<void> | void } }).modelContext;
    if (modelContext?.registerTool) {
      tools.forEach((tool) => { void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => undefined); });
    }
    return () => { controller.abort(); delete earthWindow.__ASYMPTA_EARTH_WEBMCP__; };
  }, [commit, travelTo]);

  const centerId = state.activeCellId ?? state.agent.cellId;
  const cells = useMemo(() => neighboringCells(centerId), [centerId]);
  const origin = state.userLocation ?? { lat: state.agent.lat, lng: state.agent.lng };
  const visiblePlaces = useMemo(() => state.places
    .map((place) => ({ place, projected: projectIntoNeighborhood(centerId, place, WORLD_WIDTH, WORLD_HEIGHT) }))
    .filter((item): item is { place: GeoPlace; projected: { x: number; y: number } } => Boolean(item.projected)), [centerId, state.places]);
  const searchedPlaces = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return state.places
      .filter((place) => !lower || `${place.name} ${place.summary} ${place.catalog.map((item) => item.name).join(" ")}`.toLowerCase().includes(lower))
      .map((place) => ({ ...place, distance: haversineMeters(origin, place) }))
      .sort((a, b) => a.distance - b.distance);
  }, [origin, query, state.places]);
  const opportunities = useMemo(() => searchOpportunities(state, origin, jobQuery), [jobQuery, origin, state]);
  const selectedPlace = state.places.find((place) => place.id === selectedPlaceId);

  if (!worldPlane || !viewport) return null;

  return (
    <>
      <style>{`
        html[data-earth-world="true"] .latent-city-layer,
        html[data-earth-world="true"] .community-layer,
        html[data-earth-world="true"] .route-market-store,
        html[data-earth-world="true"] .community-founded-place,
        html[data-earth-world="true"] .world-agent:not(.mission-user-agent),
        html[data-earth-world="true"] .places-directory-control { display:none!important; }
        .earth-layer { position:absolute; inset:0; z-index:7; pointer-events:none; }
        .earth-cell { position:absolute; width:400px; height:253.333px; border:1px solid rgba(100,115,106,.12); box-sizing:border-box; }
        .earth-cell.is-center { border-color:rgba(104,124,111,.28); box-shadow:inset 0 0 0 1px rgba(104,124,111,.04); }
        .earth-cell-label { position:absolute; left:8px; top:7px; color:rgba(93,106,97,.32); font-family:var(--pixel-font); font-size:.28rem; letter-spacing:.06em; }
        .earth-cell-empty { position:absolute; inset:0; display:grid; place-items:center; color:rgba(93,106,97,.09); font-family:var(--pixel-font); font-size:.35rem; letter-spacing:.08em; }
        .earth-place { position:absolute; z-index:12; width:98px; height:68px; padding:0; transform:translate(-50%,-50%); border:0; background:transparent; pointer-events:auto; cursor:pointer; color:#67746b; transition:opacity 260ms ease,filter 260ms ease,transform 260ms ease; }
        .earth-place:hover,.earth-place:focus-visible,.earth-place.is-selected { transform:translate(-50%,-50%) scale(1.05); outline:none; filter:brightness(1.08); }
        .earth-place svg { position:absolute; left:25px; top:3px; width:48px; height:36px; overflow:visible; }
        .earth-place svg path { fill:none; stroke:currentColor; stroke-width:.85; stroke-linecap:round; opacity:.78; }
        .earth-place-name { position:absolute; left:0; right:0; bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#5d6961; font-family:var(--pixel-font); font-size:.34rem; text-align:center; }
        .earth-place-bright { position:absolute; left:50%; top:22px; width:26px; height:26px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle,rgba(139,177,143,.24),rgba(118,139,181,.08) 45%,transparent 72%); filter:blur(4px); pointer-events:none; }
        .earth-control { position:absolute; z-index:108; left:max(12px,env(safe-area-inset-left)); top:max(58px,calc(env(safe-area-inset-top) + 58px)); width:min(340px,calc(100vw - 24px)); pointer-events:none; }
        .earth-control-bar,.earth-panel { pointer-events:auto; }
        .earth-control-bar { display:flex; align-items:center; gap:4px; width:max-content; max-width:100%; padding:4px; border:1px solid rgba(112,123,115,.14); border-radius:999px; background:rgba(248,247,241,.86); box-shadow:0 7px 22px rgba(54,63,58,.06); backdrop-filter:blur(14px); }
        .earth-pill { display:inline-flex; align-items:center; gap:5px; min-height:28px; padding:0 8px; border:0; border-radius:999px; background:transparent; color:#657169; font-size:.38rem; cursor:pointer; }
        .earth-pill:hover,.earth-pill.is-active { background:rgba(101,119,106,.07); }
        .earth-pill svg { width:11px; height:11px; }
        .earth-pill strong { font-family:var(--pixel-font); font-size:.29rem; }
        .earth-panel { margin-top:7px; padding:11px; border:1px solid rgba(112,123,115,.16); border-radius:16px; background:rgba(248,247,241,.96); box-shadow:0 14px 42px rgba(54,63,58,.11); color:#414a44; backdrop-filter:blur(18px); }
        .earth-panel header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .earth-panel header span { display:grid; gap:2px; min-width:0; }
        .earth-panel header strong { font-size:.62rem; }
        .earth-panel header small { color:#838b85; font-size:.36rem; }
        .earth-close { display:grid; place-items:center; width:28px; height:28px; border:0; border-radius:50%; background:rgba(90,103,94,.06); color:#69736d; cursor:pointer; }
        .earth-close svg { width:12px; height:12px; }
        .earth-search,.earth-field { display:flex; align-items:center; gap:6px; min-height:32px; margin-top:8px; padding:0 8px; border:1px solid rgba(111,123,114,.13); border-radius:9px; background:rgba(255,255,255,.2); }
        .earth-search svg { width:11px; height:11px; color:#89918b; }
        .earth-search input,.earth-field input,.earth-field textarea,.earth-field select { width:100%; min-width:0; border:0; outline:0; background:transparent; color:#555f59; font-size:.42rem; }
        .earth-field textarea { min-height:70px; padding:7px 0; resize:vertical; }
        .earth-list { display:grid; gap:4px; max-height:260px; margin-top:8px; overflow:auto; }
        .earth-row { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center; min-height:42px; padding:6px 7px; border:0; border-radius:9px; background:rgba(102,116,106,.045); color:#4e5852; text-align:left; cursor:pointer; }
        .earth-row:hover { background:rgba(102,116,106,.075); }
        .earth-row span { display:grid; gap:2px; min-width:0; }
        .earth-row strong { overflow:hidden; font-size:.47rem; text-overflow:ellipsis; white-space:nowrap; }
        .earth-row small { color:#7d867f; font-size:.32rem; }
        .earth-row b { color:#647269; font-family:var(--pixel-font); font-size:.3rem; font-weight:600; }
        .earth-action { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:32px; margin-top:8px; padding:0 9px; border:1px solid rgba(118,139,181,.18); border-radius:9px; background:rgba(118,139,181,.07); color:#5d729e; font-size:.4rem; cursor:pointer; }
        .earth-action:disabled { opacity:.45; cursor:default; }
        .earth-action svg { width:11px; height:11px; }
        .earth-statline { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
        .earth-stat { padding:5px 6px; border-radius:8px; background:rgba(99,114,104,.05); color:#677169; font-family:var(--pixel-font); font-size:.29rem; }
        .earth-catalog { display:grid; gap:3px; margin-top:8px; }
        .earth-catalog-line { display:grid; grid-template-columns:1fr auto; gap:8px; padding:5px 6px; border-radius:7px; background:rgba(99,114,104,.04); font-size:.39rem; }
        .earth-catalog-line span:last-child { color:#7b847e; font-family:var(--pixel-font); font-size:.28rem; }
        .earth-handoff { margin-top:7px; padding:8px; border-radius:9px; background:rgba(161,132,95,.07); color:#655d50; font-size:.39rem; line-height:1.45; white-space:pre-line; }
        .earth-status { position:absolute; z-index:107; left:max(12px,env(safe-area-inset-left)); bottom:max(62px,calc(env(safe-area-inset-bottom) + 62px)); max-width:min(430px,calc(100vw - 24px)); padding:5px 8px; border-radius:9px; background:rgba(248,247,241,.7); color:#79817b; font-family:var(--pixel-font); font-size:.29rem; opacity:.62; pointer-events:none; backdrop-filter:blur(8px); }
        .earth-place-inspector { position:absolute; z-index:106; right:max(12px,env(safe-area-inset-right)); bottom:max(70px,calc(env(safe-area-inset-bottom) + 70px)); width:min(292px,calc(100vw - 24px)); padding:11px; border:1px solid rgba(112,123,115,.16); border-radius:16px; background:rgba(248,247,241,.96); box-shadow:0 14px 42px rgba(54,63,58,.11); color:#414a44; pointer-events:auto; backdrop-filter:blur(18px); }
        .earth-place-inspector header { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .earth-place-inspector header span { display:grid; gap:2px; min-width:0; }
        .earth-place-inspector header strong { font-size:.62rem; }
        .earth-place-inspector header small { color:#838b85; font-size:.34rem; }
        @media(max-width:620px){.earth-control{left:max(9px,env(safe-area-inset-left));top:max(54px,calc(env(safe-area-inset-top) + 54px));width:min(310px,calc(100vw - 18px))}.earth-control-bar{max-width:100%;overflow:auto}.earth-place-inspector{left:9px;right:9px;bottom:68px;width:auto}.earth-status{left:9px;bottom:58px}}
        @media(prefers-reduced-motion:reduce){.earth-place{transition:none!important}}
      `}</style>

      {createPortal(
        <div className="earth-layer" aria-label="Earth-scale blank geolocation world built only from community discovery">
          {cells.map((cell, index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);
            const isCenter = cell.id === centerId;
            const hasPlace = state.places.some((place) => place.cellId === cell.id);
            return <div className={"earth-cell" + (isCenter ? " is-center" : "")} key={cell.id} style={{ left: col * 400, top: row * (760 / 3) }}>
              <span className="earth-cell-label">{cell.id}{isCenter ? " · ACTIVE" : ""}</span>
              {!hasPlace ? <span className="earth-cell-empty">UNDISCOVERED</span> : null}
            </div>;
          })}
          {visiblePlaces.map(({ place, projected }) => (
            <button
              type="button"
              key={place.id}
              className={"earth-place" + (selectedPlaceId === place.id ? " is-selected" : "")}
              style={{ left: projected.x, top: projected.y, opacity: 0.28 + place.brightness * 0.72, filter: `drop-shadow(0 0 ${2 + place.brightness * 8}px rgba(112,151,122,${0.05 + place.brightness * 0.18}))` }}
              aria-label={`${place.name}, community-discovered ${place.kind}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setSelectedPlaceId(place.id)}
            >
              <i className="earth-place-bright" style={{ opacity: place.brightness }} />
              <svg viewBox="0 0 50 36" aria-hidden="true">{placeLines(place.id).map((path, index) => <path d={path} key={index} />)}</svg>
              <span className="earth-place-name">{place.name}</span>
            </button>
          ))}
        </div>,
        worldPlane,
        "earth-scale-world",
      )}

      {createPortal(
        <>
          <div className="earth-control" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
            <div className="earth-control-bar">
              <button className="earth-pill" type="button" onClick={locate}><LocateFixed aria-hidden="true" /><strong>{state.activeCellId ? "LOCATED" : "LOCATE"}</strong></button>
              <button className={"earth-pill" + (panel === "places" ? " is-active" : "")} type="button" onClick={() => setPanel(panel === "places" ? "none" : "places")}><MapPin aria-hidden="true" />Places · {state.places.length}{panel === "places" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>
              <button className={"earth-pill" + (panel === "contribute" ? " is-active" : "")} type="button" onClick={() => setPanel(panel === "contribute" ? "none" : "contribute")}><Upload aria-hidden="true" />Contribute</button>
              <button className={"earth-pill" + (panel === "jobs" ? " is-active" : "")} type="button" onClick={() => setPanel(panel === "jobs" ? "none" : "jobs")}><BriefcaseBusiness aria-hidden="true" />Jobs · {state.opportunities.filter((item) => item.status !== "completed").length}</button>
              <span className="earth-pill"><Sparkles aria-hidden="true" /><strong>LV{state.contributor.level} · {state.contributor.xp}XP</strong></span>
            </div>

            {panel === "places" ? <section className="earth-panel">
              <header><span><strong>Community-built places</strong><small>No imported POIs · brightness comes from contributed information</small></span><button className="earth-close" type="button" onClick={() => setPanel("none")}><X aria-hidden="true" /></button></header>
              <label className="earth-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discovered places / products / services" /></label>
              <div className="earth-list">{searchedPlaces.length ? searchedPlaces.map((place) => <button className="earth-row" type="button" key={place.id} onClick={() => { setSelectedPlaceId(place.id); void travelTo({ lat: place.lat, lng: place.lng, name: place.name }); }}><span><strong>{place.name}</strong><small>{place.kind} · {Math.round(place.completeness * 100)}% info · {place.catalog.length} items</small></span><b>{distanceLabel(place.distance)}</b></button>) : <div className="earth-row"><span><strong>Nothing here yet</strong><small>This is intentional: the Earth layer starts empty.</small></span><b>—</b></div>}</div>
            </section> : null}

            {panel === "contribute" ? <section className="earth-panel">
              <header><span><strong>Build the local world</strong><small>Upload real local information · Store Agent structures it · earn XP</small></span><button className="earth-close" type="button" onClick={() => setPanel("none")}><X aria-hidden="true" /></button></header>
              {linkedJobId ? <div className="earth-handoff">Completing local job: {state.opportunities.find((item) => item.id === linkedJobId)?.title}</div> : null}
              <label className="earth-field"><Store aria-hidden="true" style={{ width: 12, height: 12 }} /><input value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="Store / service / facility name" /></label>
              <label className="earth-field"><PackageSearch aria-hidden="true" style={{ width: 12, height: 12 }} /><select value={placeKind} onChange={(event) => setPlaceKind(event.target.value as GeoPlaceKind)}><option value="store">Store</option><option value="service">Service</option><option value="facility">Facility</option><option value="community">Community</option></select></label>
              <label className="earth-field"><Camera aria-hidden="true" style={{ width: 12, height: 12 }} /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={'Description / product list / service list / prices\nExample: Milk bread $12; Coffee $8; Delivery service $20'} /></label>
              <label className="earth-field"><FileImage aria-hidden="true" style={{ width: 12, height: 12 }} /><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
              <div className="earth-statline"><span className="earth-stat">cell {state.activeCellId ?? "unlocated"}</span><span className="earth-stat">image {file ? file.name : "optional"}</span><span className="earth-stat">XP reward after processing</span></div>
              <button className="earth-action" type="button" disabled={busy} onClick={() => void submitContribution()}><Upload aria-hidden="true" />{busy ? "STORE AGENT WORKING" : "UPLOAD & BUILD"}</button>
            </section> : null}

            {panel === "jobs" ? <section className="earth-panel">
              <header><span><strong>Opportunity Mode</strong><small>Agent finishes agent-capable work; physical/human steps become a clean handoff</small></span><button className="earth-close" type="button" onClick={() => setPanel("none")}><X aria-hidden="true" /></button></header>
              <label className="earth-search"><UserRoundSearch aria-hidden="true" /><input value={jobQuery} onChange={(event) => setJobQuery(event.target.value)} placeholder="Search job / opportunity" /></label>
              <button className="earth-action" type="button" disabled={busy} onClick={() => void searchBestOpportunity()}><Compass aria-hidden="true" />AGENT SEARCH MODE</button>
              <div className="earth-list">{opportunities.slice(0, 12).map((job) => <button className="earth-row" type="button" key={job.id} onClick={() => void runOpportunity(job)}><span><strong>{job.title}</strong><small>{job.kind} · agent {job.agentTasks.length} · human {job.humanTasks.length}</small></span><b>+{job.rewardXp}XP · {distanceLabel(job.distanceMeters)}</b></button>)}</div>
              {opportunities.find((item) => item.status === "human-needed" && item.handoff) ? <div className="earth-handoff">{opportunities.find((item) => item.status === "human-needed" && item.handoff)?.handoff}</div> : null}
              <div className="earth-statline"><span className="earth-stat">Post a local job</span></div>
              <label className="earth-field"><BriefcaseBusiness aria-hidden="true" style={{ width: 12, height: 12 }} /><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Job title" /></label>
              <label className="earth-field"><input value={jobSummary} onChange={(event) => setJobSummary(event.target.value)} placeholder="What needs to be done?" /></label>
              <label className="earth-field"><textarea value={jobAgentTask} onChange={(event) => setJobAgentTask(event.target.value)} placeholder="Agent-capable steps; separate with ;" /></label>
              <label className="earth-field"><textarea value={jobHumanTask} onChange={(event) => setJobHumanTask(event.target.value)} placeholder="Human / physical steps; separate with ;" /></label>
              <button className="earth-action" type="button" onClick={postJob}><BriefcaseBusiness aria-hidden="true" />POST LOCAL OPPORTUNITY</button>
            </section> : null}
          </div>
          <div className="earth-status">{status}</div>
        </>,
        viewport,
        "earth-world-controls",
      )}

      {selectedPlace ? createPortal(
        <aside className="earth-place-inspector" aria-label={`${selectedPlace.name} local information`}>
          <header><span><strong>{selectedPlace.name}</strong><small>{selectedPlace.kind} · {selectedPlace.cellId}</small></span><button className="earth-close" type="button" onClick={() => setSelectedPlaceId(null)}><X aria-hidden="true" /></button></header>
          <div className="earth-statline"><span className="earth-stat">info {Math.round(selectedPlace.completeness * 100)}%</span><span className="earth-stat">confidence {Math.round(selectedPlace.confidence * 100)}%</span><span className="earth-stat">evidence {selectedPlace.evidenceIds.length}</span><span className="earth-stat">brightness {Math.round(selectedPlace.brightness * 100)}%</span></div>
          <div className="earth-catalog">{selectedPlace.catalog.length ? selectedPlace.catalog.map((item) => <div className="earth-catalog-line" key={item.id}><span>{item.name}</span><span>{item.type}{item.price !== undefined ? ` · $${item.price}` : ""}</span></div>) : <div className="earth-catalog-line"><span>Photo / basic evidence exists, but catalog still needs community or connected AI extraction</span><span>incomplete</span></div>}</div>
          <button className="earth-action" type="button" disabled={busy} onClick={() => void travelTo({ lat: selectedPlace.lat, lng: selectedPlace.lng, name: selectedPlace.name })}><Crosshair aria-hidden="true" />GO TO PLACE</button>
          {selectedPlace.completeness < .86 ? <button className="earth-action" type="button" onClick={() => { const job = state.opportunities.find((item) => item.placeId === selectedPlace.id && item.status !== "completed"); setLinkedJobId(job?.id); setPlaceName(selectedPlace.name); setPlaceKind(selectedPlace.kind); setPanel("contribute"); }}><Camera aria-hidden="true" />ADD MISSING INFO · EARN XP</button> : null}
        </aside>,
        viewport,
        "earth-place-inspector",
      ) : null}
    </>
  );
}

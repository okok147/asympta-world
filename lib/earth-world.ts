export const GEO_CELL_DEGREES = 0.01;

export type GeoPoint = { lat: number; lng: number };
export type GeoCell = {
  id: string;
  row: number;
  col: number;
  south: number;
  north: number;
  west: number;
  east: number;
};
export type GeoPlaceKind = "store" | "service" | "facility" | "community";
export type GeoCatalogItem = {
  id: string;
  name: string;
  type: "product" | "service";
  price?: number;
  availability?: number;
  tags: string[];
};
export type GeoEvidenceStatus = "queued" | "reading" | "structured" | "verified";
export type GeoEvidence = {
  id: string;
  contributorId: string;
  createdAt: number;
  updatedAt: number;
  lat: number;
  lng: number;
  cellId: string;
  placeName: string;
  kind: GeoPlaceKind;
  description: string;
  imageName?: string;
  imageDataUrl?: string;
  status: GeoEvidenceStatus;
  extractedCatalog: GeoCatalogItem[];
  linkedOpportunityId?: string;
};
export type GeoPlace = {
  id: string;
  name: string;
  kind: GeoPlaceKind;
  lat: number;
  lng: number;
  cellId: string;
  summary: string;
  catalog: GeoCatalogItem[];
  evidenceIds: string[];
  confidence: number;
  completeness: number;
  brightness: number;
  contributorCount: number;
  updatedAt: number;
};
export type OpportunityStatus = "open" | "claimed" | "agent-working" | "human-needed" | "completed";
export type GeoOpportunity = {
  id: string;
  title: string;
  summary: string;
  kind: "local-info" | "local-service" | "remote-agent" | "hybrid";
  lat: number;
  lng: number;
  cellId: string;
  placeId?: string;
  rewardXp: number;
  status: OpportunityStatus;
  agentTasks: string[];
  humanTasks: string[];
  agentCompleted: string[];
  humanCompleted: string[];
  handoff?: string;
  claimedBy?: string;
  createdAt: number;
  updatedAt: number;
};
export type ContributorProfile = {
  id: string;
  xp: number;
  level: number;
  contributions: number;
  completedJobs: number;
};
export type GeoAgentState = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cellId: string;
  mode: "community" | "opportunity";
  status: string;
  currentOpportunityId?: string;
};
export type EarthWorldState = {
  version: 1;
  userLocation?: GeoPoint;
  activeCellId?: string;
  places: GeoPlace[];
  evidence: GeoEvidence[];
  opportunities: GeoOpportunity[];
  contributor: ContributorProfile;
  agent: GeoAgentState;
  updatedAt: number;
};

const DEFAULT_CONTRIBUTOR_ID = "local-contributor";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function earthWorldDefault(now = Date.now()): EarthWorldState {
  const origin = cellFor(0, 0);
  return {
    version: 1,
    places: [],
    evidence: [],
    opportunities: [],
    contributor: { id: DEFAULT_CONTRIBUTOR_ID, xp: 0, level: 1, contributions: 0, completedJobs: 0 },
    agent: { id: "earth-user-agent", name: "Your Agent", lat: 0, lng: 0, cellId: origin.id, mode: "community", status: "Waiting for geolocation" },
    updatedAt: now,
  };
}

export function cellFor(lat: number, lng: number): GeoCell {
  const safeLat = clamp(lat, -89.999999, 89.999999);
  const safeLng = clamp(lng, -179.999999, 179.999999);
  const row = Math.floor((safeLat + 90) / GEO_CELL_DEGREES);
  const col = Math.floor((safeLng + 180) / GEO_CELL_DEGREES);
  const south = row * GEO_CELL_DEGREES - 90;
  const west = col * GEO_CELL_DEGREES - 180;
  return {
    id: `geo-${row}-${col}`,
    row,
    col,
    south,
    north: south + GEO_CELL_DEGREES,
    west,
    east: west + GEO_CELL_DEGREES,
  };
}

export function cellFromId(id: string): GeoCell | null {
  const match = /^geo-(\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  const south = row * GEO_CELL_DEGREES - 90;
  const west = col * GEO_CELL_DEGREES - 180;
  return { id, row, col, south, north: south + GEO_CELL_DEGREES, west, east: west + GEO_CELL_DEGREES };
}

export function neighboringCells(centerId: string): GeoCell[] {
  const center = cellFromId(centerId);
  if (!center) return [];
  const result: GeoCell[] = [];
  for (let dy = 1; dy >= -1; dy -= 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const row = center.row + dy;
      const col = center.col + dx;
      const south = row * GEO_CELL_DEGREES - 90;
      const west = col * GEO_CELL_DEGREES - 180;
      result.push({ id: `geo-${row}-${col}`, row, col, south, north: south + GEO_CELL_DEGREES, west, east: west + GEO_CELL_DEGREES });
    }
  }
  return result;
}

export function projectIntoNeighborhood(centerId: string, point: GeoPoint, width = 1200, height = 760) {
  const center = cellFromId(centerId);
  if (!center) return null;
  const target = cellFor(point.lat, point.lng);
  const dx = target.col - center.col;
  const dy = target.row - center.row;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return null;
  const cellWidth = width / 3;
  const cellHeight = height / 3;
  const colIndex = dx + 1;
  const rowIndex = 1 - dy;
  const lngFraction = clamp((point.lng - target.west) / GEO_CELL_DEGREES, 0, 1);
  const latFraction = clamp((point.lat - target.south) / GEO_CELL_DEGREES, 0, 1);
  return {
    x: colIndex * cellWidth + lngFraction * cellWidth,
    y: rowIndex * cellHeight + (1 - latFraction) * cellHeight,
  };
}

export function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const toRad = (value: number) => value * Math.PI / 180;
  const radius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "place";
}

function moneyFrom(text: string) {
  const match = text.match(/(?:HK\$|\$|₡|hkd\s*)\s*(\d+(?:\.\d+)?)/i) ?? text.match(/(\d+(?:\.\d+)?)\s*(?:HKD|dollars?)/i);
  return match ? Number(match[1]) : undefined;
}

function catalogItemFromLine(line: string, index: number): GeoCatalogItem | null {
  const clean = line.trim().replace(/^[-•*\d.\s]+/, "");
  if (clean.length < 2) return null;
  const lower = clean.toLowerCase();
  const serviceWords = ["service", "repair", "booking", "session", "class", "consult", "delivery", "clean", "wash", "lesson", "服務", "維修", "預約", "課程", "送貨", "清潔"];
  const type = serviceWords.some((word) => lower.includes(word)) ? "service" : "product";
  const price = moneyFrom(clean);
  const name = clean
    .replace(/(?:HK\$|\$|₡|hkd\s*)\s*\d+(?:\.\d+)?/ig, "")
    .replace(/\d+(?:\.\d+)?\s*(?:HKD|dollars?)/ig, "")
    .replace(/[|·—–-]+$/g, "")
    .trim();
  if (!name) return null;
  return { id: `${slug(name)}-${index + 1}`, name: name.slice(0, 64), type, price, availability: 1, tags: [type] };
}

export function extractCatalogFromDescription(description: string) {
  const lines = description.split(/\n|;|；/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.slice(0, 24).map(catalogItemFromLine).filter((item): item is GeoCatalogItem => Boolean(item));
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}

export function createEvidence(
  state: EarthWorldState,
  input: {
    placeName: string;
    kind: GeoPlaceKind;
    description: string;
    lat: number;
    lng: number;
    imageName?: string;
    imageDataUrl?: string;
    linkedOpportunityId?: string;
  },
  now = Date.now(),
) {
  const cell = cellFor(input.lat, input.lng);
  const id = `evidence-${now.toString(36)}-${Math.abs(Math.round(input.lat * 1e5 + input.lng * 1e5)).toString(36)}`;
  const evidence: GeoEvidence = {
    id,
    contributorId: state.contributor.id,
    createdAt: now,
    updatedAt: now,
    lat: input.lat,
    lng: input.lng,
    cellId: cell.id,
    placeName: input.placeName.trim().slice(0, 80) || "Unnamed local place",
    kind: input.kind,
    description: input.description.trim().slice(0, 2400),
    imageName: input.imageName,
    imageDataUrl: input.imageDataUrl,
    status: "queued",
    extractedCatalog: [],
    linkedOpportunityId: input.linkedOpportunityId,
  };
  return { ...state, evidence: [evidence, ...state.evidence].slice(0, 200), updatedAt: now };
}

function upsertOpportunity(list: GeoOpportunity[], next: GeoOpportunity) {
  const existing = list.findIndex((item) => item.id === next.id);
  if (existing < 0) return [next, ...list].slice(0, 180);
  return list.map((item, index) => index === existing ? next : item);
}

function opportunityForPlace(place: GeoPlace, now: number): GeoOpportunity | null {
  if (place.completeness >= 0.86) return null;
  const missingCatalog = place.catalog.length < 3;
  const id = `opportunity-info-${place.id}`;
  return {
    id,
    title: missingCatalog ? `Complete ${place.name} product/service info` : `Verify ${place.name} locally`,
    summary: missingCatalog
      ? "Add a current photo, menu, price list, product list or service details so the community can rely on this place."
      : "Verify current availability, opening information or prices on location.",
    kind: "local-info",
    lat: place.lat,
    lng: place.lng,
    cellId: place.cellId,
    placeId: place.id,
    rewardXp: missingCatalog ? 70 : 45,
    status: "open",
    agentTasks: ["Summarise existing evidence", "Detect missing fields", "Prepare a clean upload checklist"],
    humanTasks: missingCatalog ? ["Visit the place", "Take a current photo or menu image", "Upload the evidence"] : ["Confirm one current detail on location", "Upload proof or a short note"],
    agentCompleted: [],
    humanCompleted: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function processEvidence(
  state: EarthWorldState,
  evidenceId: string,
  options: { extractedCatalog?: GeoCatalogItem[]; summary?: string } = {},
  now = Date.now(),
) {
  const evidence = state.evidence.find((item) => item.id === evidenceId);
  if (!evidence) return { ok: false as const, state, error: "Evidence not found." };
  const extracted = options.extractedCatalog?.length
    ? options.extractedCatalog.slice(0, 24)
    : extractCatalogFromDescription(evidence.description);
  const placeId = `geo-place-${slug(evidence.placeName)}-${evidence.cellId}`;
  const existing = state.places.find((item) => item.id === placeId);
  const priorCatalog = existing?.catalog ?? [];
  const catalogMap = new Map<string, GeoCatalogItem>();
  [...priorCatalog, ...extracted].forEach((item) => catalogMap.set(item.name.toLowerCase(), item));
  const catalog = [...catalogMap.values()].slice(0, 32);
  const evidenceIds = [...new Set([...(existing?.evidenceIds ?? []), evidence.id])];
  const completeness = clamp(0.22 + Math.min(0.52, catalog.length * 0.08) + (evidence.imageDataUrl ? 0.18 : 0) + (evidence.description.length > 80 ? 0.08 : 0), 0, 1);
  const confidence = clamp((existing?.confidence ?? 0.35) + 0.16 + (evidence.imageDataUrl ? 0.12 : 0.04), 0, 1);
  const place: GeoPlace = {
    id: placeId,
    name: evidence.placeName,
    kind: evidence.kind,
    lat: evidence.lat,
    lng: evidence.lng,
    cellId: evidence.cellId,
    summary: (options.summary ?? evidence.description.split(/\n|[.!?。！？]/)[0] ?? "Community-discovered place").slice(0, 180),
    catalog,
    evidenceIds,
    confidence,
    completeness,
    brightness: clamp(0.2 + completeness * 0.8, 0.2, 1),
    contributorCount: Math.max(existing?.contributorCount ?? 0, evidenceIds.length),
    updatedAt: now,
  };
  const nextEvidence = state.evidence.map((item) => item.id === evidence.id ? { ...item, status: "verified" as const, extractedCatalog: extracted, updatedAt: now } : item);
  let opportunities = state.opportunities;
  const generated = opportunityForPlace(place, now);
  if (generated) opportunities = upsertOpportunity(opportunities, generated);
  if (evidence.linkedOpportunityId) {
    opportunities = opportunities.map((item) => item.id === evidence.linkedOpportunityId
      ? { ...item, humanCompleted: [...new Set([...item.humanCompleted, ...item.humanTasks])], status: "completed" as const, updatedAt: now }
      : item);
  }
  const xpGain = 35 + (evidence.imageDataUrl ? 25 : 0) + Math.min(40, catalog.length * 5);
  const xp = state.contributor.xp + xpGain;
  const contributor = {
    ...state.contributor,
    xp,
    level: 1 + Math.floor(xp / 250),
    contributions: state.contributor.contributions + 1,
    completedJobs: state.contributor.completedJobs + (evidence.linkedOpportunityId ? 1 : 0),
  };
  const places = existing ? state.places.map((item) => item.id === placeId ? place : item) : [place, ...state.places];
  return {
    ok: true as const,
    state: { ...state, places, evidence: nextEvidence, opportunities, contributor, updatedAt: now },
    place,
    xpGain,
  };
}

export function createLocalOpportunity(
  state: EarthWorldState,
  input: {
    title: string;
    summary: string;
    lat: number;
    lng: number;
    rewardXp?: number;
    agentTasks?: string[];
    humanTasks?: string[];
    placeId?: string;
  },
  now = Date.now(),
) {
  const cell = cellFor(input.lat, input.lng);
  const agentTasks = (input.agentTasks ?? []).map((task) => task.trim()).filter(Boolean).slice(0, 10);
  const humanTasks = (input.humanTasks ?? []).map((task) => task.trim()).filter(Boolean).slice(0, 10);
  const kind: GeoOpportunity["kind"] = humanTasks.length === 0 ? "remote-agent" : agentTasks.length === 0 ? "local-service" : "hybrid";
  const opportunity: GeoOpportunity = {
    id: `opportunity-${now.toString(36)}-${slug(input.title).slice(0, 16)}`,
    title: input.title.trim().slice(0, 100),
    summary: input.summary.trim().slice(0, 700),
    kind,
    lat: input.lat,
    lng: input.lng,
    cellId: cell.id,
    placeId: input.placeId,
    rewardXp: clamp(Math.round(input.rewardXp ?? 60), 5, 1000),
    status: "open",
    agentTasks,
    humanTasks,
    agentCompleted: [],
    humanCompleted: [],
    createdAt: now,
    updatedAt: now,
  };
  return { ...state, opportunities: [opportunity, ...state.opportunities].slice(0, 180), updatedAt: now };
}

export function searchOpportunities(state: EarthWorldState, origin: GeoPoint, query = "") {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return state.opportunities
    .filter((item) => item.status !== "completed")
    .filter((item) => !terms.length || terms.every((term) => `${item.title} ${item.summary} ${item.agentTasks.join(" ")} ${item.humanTasks.join(" ")}`.toLowerCase().includes(term)))
    .map((item) => ({ ...item, distanceMeters: haversineMeters(origin, item) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters || b.rewardXp - a.rewardXp);
}

export function workOpportunity(state: EarthWorldState, opportunityId: string, now = Date.now()) {
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return { ok: false as const, state, error: "Opportunity not found." };
  const agentCompleted = [...opportunity.agentTasks];
  const needsHuman = opportunity.humanTasks.length > 0;
  const handoff = needsHuman
    ? [
        `Human handoff for: ${opportunity.title}`,
        ...opportunity.humanTasks.map((task, index) => `${index + 1}. ${task}`),
        "Your Agent has already completed: " + (agentCompleted.join(" · ") || "No agent-side steps"),
      ].join("\n")
    : undefined;
  const next: GeoOpportunity = {
    ...opportunity,
    status: needsHuman ? "human-needed" : "completed",
    claimedBy: state.agent.id,
    agentCompleted,
    handoff,
    updatedAt: now,
  };
  const xpGain = needsHuman ? Math.max(5, Math.round(opportunity.rewardXp * 0.25)) : opportunity.rewardXp;
  const xp = state.contributor.xp + xpGain;
  return {
    ok: true as const,
    state: {
      ...state,
      opportunities: state.opportunities.map((item) => item.id === opportunityId ? next : item),
      contributor: {
        ...state.contributor,
        xp,
        level: 1 + Math.floor(xp / 250),
        completedJobs: state.contributor.completedJobs + (needsHuman ? 0 : 1),
      },
      agent: { ...state.agent, mode: "opportunity", status: needsHuman ? "Prepared human handoff" : "Opportunity completed", currentOpportunityId: opportunityId },
      updatedAt: now,
    },
    opportunity: next,
    xpGain,
  };
}

export function setUserLocation(state: EarthWorldState, point: GeoPoint, now = Date.now()) {
  const cell = cellFor(point.lat, point.lng);
  return {
    ...state,
    userLocation: point,
    activeCellId: cell.id,
    agent: { ...state.agent, lat: point.lat, lng: point.lng, cellId: cell.id, status: "Located in real-world cell" },
    updatedAt: now,
  };
}

export function moveAgentGeo(state: EarthWorldState, point: GeoPoint, status: string, now = Date.now()) {
  const cell = cellFor(point.lat, point.lng);
  return {
    ...state,
    activeCellId: cell.id,
    agent: { ...state.agent, lat: point.lat, lng: point.lng, cellId: cell.id, status },
    updatedAt: now,
  };
}

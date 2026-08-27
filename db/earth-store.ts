import { env } from "cloudflare:workers";

import type { GeoEvidence, GeoOpportunity, GeoPlace } from "@/lib/earth-world";

const EARTH_WORLD_ID = "asympta-earth-community";

export type EarthSharedState = {
  version: 1;
  places: GeoPlace[];
  evidence: GeoEvidence[];
  opportunities: GeoOpportunity[];
  updatedAt: number;
};

type SnapshotRow = {
  id: string;
  version: number;
  snapshot: string;
  last_processed_at: number;
  updated_at: number;
};

function database() {
  if (!env.DB) throw new Error("The shared Earth database is unavailable.");
  return env.DB;
}

export function emptySharedEarth(now = Date.now()): EarthSharedState {
  return { version: 1, places: [], evidence: [], opportunities: [], updatedAt: now };
}

function stripEvidenceImage(evidence: GeoEvidence): GeoEvidence {
  return {
    ...evidence,
    imageDataUrl:
      evidence.imageDataUrl && evidence.imageDataUrl.length <= 150_000
        ? evidence.imageDataUrl
        : undefined,
    extractedCatalog: evidence.extractedCatalog.map((item) => ({ ...item, tags: [...item.tags] })),
  };
}

export function sanitizeSharedEarth(input: EarthSharedState): EarthSharedState {
  return {
    version: 1,
    places: input.places.slice(0, 5000).map((place) => ({
      ...place,
      catalog: place.catalog.slice(0, 48).map((item) => ({ ...item, tags: [...item.tags].slice(0, 12) })),
      evidenceIds: [...place.evidenceIds].slice(0, 40),
    })),
    evidence: input.evidence.slice(0, 6000).map(stripEvidenceImage),
    opportunities: input.opportunities.slice(0, 5000).map((item) => ({
      ...item,
      agentTasks: [...item.agentTasks].slice(0, 16),
      humanTasks: [...item.humanTasks].slice(0, 16),
      agentCompleted: [...item.agentCompleted].slice(0, 16),
      humanCompleted: [...item.humanCompleted].slice(0, 16),
      handoff: item.handoff?.slice(0, 2400),
    })),
    updatedAt: input.updatedAt,
  };
}

function mergeByUpdatedAt<T extends { id: string; updatedAt: number }>(left: T[], right: T[], cap: number) {
  const map = new Map<string, T>();
  for (const item of [...left, ...right]) {
    const current = map.get(item.id);
    if (!current || item.updatedAt >= current.updatedAt) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, cap);
}

export function mergeSharedEarth(left: EarthSharedState, right: EarthSharedState, now = Date.now()): EarthSharedState {
  return sanitizeSharedEarth({
    version: 1,
    places: mergeByUpdatedAt(left.places, right.places, 5000),
    evidence: mergeByUpdatedAt(left.evidence, right.evidence, 6000),
    opportunities: mergeByUpdatedAt(left.opportunities, right.opportunities, 5000),
    updatedAt: Math.max(left.updatedAt, right.updatedAt, now),
  });
}

async function ensureEarth(now: number) {
  const initial = emptySharedEarth(now);
  await database()
    .prepare("INSERT OR IGNORE INTO world_snapshots (id, version, snapshot, last_processed_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(EARTH_WORLD_ID, 1, JSON.stringify(initial), now, now)
    .run();
}

async function loadRow(): Promise<{ state: EarthSharedState; rowVersion: number }> {
  const row = await database()
    .prepare("SELECT id, version, snapshot, last_processed_at, updated_at FROM world_snapshots WHERE id = ?")
    .bind(EARTH_WORLD_ID)
    .first<SnapshotRow>();
  if (!row) throw new Error("Shared Earth snapshot was not initialized.");
  const parsed = JSON.parse(row.snapshot) as EarthSharedState;
  return { state: sanitizeSharedEarth(parsed), rowVersion: row.version };
}

export async function getSharedEarth(now = Date.now()) {
  await ensureEarth(now);
  return (await loadRow()).state;
}

export async function mergeIntoSharedEarth(incoming: EarthSharedState, now = Date.now()) {
  await ensureEarth(now);
  const safeIncoming = sanitizeSharedEarth(incoming);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await loadRow();
    const next = mergeSharedEarth(current.state, safeIncoming, now);
    const result = await database()
      .prepare("UPDATE world_snapshots SET version = ?, snapshot = ?, last_processed_at = ?, updated_at = ? WHERE id = ? AND version = ?")
      .bind(current.rowVersion + 1, JSON.stringify(next), now, now, EARTH_WORLD_ID, current.rowVersion)
      .run();
    if ((result.meta.changes ?? 0) === 1) return next;
  }
  throw new Error("The shared Earth world changed concurrently. Please retry.");
}

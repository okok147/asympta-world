import { env } from "cloudflare:workers";

import {
  advanceAutonomousSimulation,
  hasLivingAgentState,
} from "@/lib/autonomous-simulation";
import {
  advanceWorld,
  applyWorldCommand,
  catchUpTicks,
  seedWorld,
  validateWorld,
  type WorldCommand,
  type WorldEvent,
  type WorldState,
} from "@/lib/world-engine";

const WORLD_ID = "asympta-main";

type SnapshotRow = {
  id: string;
  version: number;
  snapshot: string;
  last_processed_at: number;
  updated_at: number;
};

function database() {
  if (!env.DB) {
    throw new Error("The authoritative world database is unavailable.");
  }
  return env.DB;
}

async function ensureWorld(now: number) {
  const initial = seedWorld(now);
  await database()
    .prepare(
      "INSERT OR IGNORE INTO world_snapshots (id, version, snapshot, last_processed_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      WORLD_ID,
      initial.version,
      JSON.stringify(initial),
      initial.lastProcessedAt,
      now,
    )
    .run();

  for (const event of initial.events) {
    await appendEvent(event);
  }
}

async function loadWorld(): Promise<WorldState> {
  const row = await database()
    .prepare(
      "SELECT id, version, snapshot, last_processed_at, updated_at FROM world_snapshots WHERE id = ?",
    )
    .bind(WORLD_ID)
    .first<SnapshotRow>();
  if (!row) throw new Error("World snapshot was not initialized.");
  const parsed = JSON.parse(row.snapshot) as WorldState;
  parsed.version = row.version;
  parsed.lastProcessedAt = row.last_processed_at;
  return parsed;
}

async function appendEvent(event: WorldEvent) {
  await database()
    .prepare(
      "INSERT OR IGNORE INTO world_events (id, world_id, type, origin, importance, entity_id, parent_event_ids, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      event.id,
      WORLD_ID,
      event.type,
      event.origin,
      event.importance,
      event.entityId ?? null,
      JSON.stringify(event.parentEventIds),
      JSON.stringify(event),
      event.createdAt,
    )
    .run();
}

async function appendNewEvents(previous: WorldState, next: WorldState) {
  const existingIds = new Set(previous.events.map((event) => event.id));
  const additions = next.events
    .filter((event) => !existingIds.has(event.id))
    .sort((a, b) => a.createdAt - b.createdAt);
  if (additions.length === 0) return;
  const statements = additions.map((event) =>
    database()
      .prepare(
        "INSERT OR IGNORE INTO world_events (id, world_id, type, origin, importance, entity_id, parent_event_ids, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        event.id,
        WORLD_ID,
        event.type,
        event.origin,
        event.importance,
        event.entityId ?? null,
        JSON.stringify(event.parentEventIds),
        JSON.stringify(event),
        event.createdAt,
      ),
  );
  await database().batch(statements);
}

async function mutateWorld(
  transform: (world: WorldState) => WorldState,
): Promise<WorldState> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const previous = await loadWorld();
    const next = transform(previous);
    const errors = validateWorld(next);
    if (errors.length > 0) {
      throw new Error("World validation failed: " + errors.join("; "));
    }
    const result = await database()
      .prepare(
        "UPDATE world_snapshots SET version = ?, snapshot = ?, last_processed_at = ?, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(
        next.version,
        JSON.stringify(next),
        next.lastProcessedAt,
        Date.now(),
        WORLD_ID,
        previous.version,
      )
      .run();
    if ((result.meta.changes ?? 0) === 1) {
      await appendNewEvents(previous, next);
      return next;
    }
  }
  throw new Error("The world changed concurrently. Please retry.");
}

export async function getAuthoritativeWorld(now = Date.now()) {
  await ensureWorld(now);
  const current = await loadWorld();
  const ticks = catchUpTicks(current, now);
  if (ticks === 0 && hasLivingAgentState(current)) return current;

  return mutateWorld((fresh) => {
    const freshTicks = catchUpTicks(fresh, now);
    if (freshTicks > 0) {
      const advanced = advanceWorld(fresh, freshTicks, now);
      return advanceAutonomousSimulation(advanced, freshTicks, now);
    }
    if (hasLivingAgentState(fresh)) return fresh;
    const hydrated = advanceAutonomousSimulation(fresh, 0, now);
    hydrated.version += 1;
    return hydrated;
  });
}

export async function executeWorldCommand(
  command: WorldCommand,
  now = Date.now(),
) {
  await ensureWorld(now);
  return mutateWorld((current) => {
    if (current.processedCommands.includes(command.idempotencyKey)) {
      return current;
    }
    const commanded = applyWorldCommand(current, command, now);
    const reactionTicks =
      command.type === "post_need"
        ? 3
        : command.type === "accept_offer"
          ? 1
          : 1;
    const advanced = advanceWorld(commanded, reactionTicks, now + reactionTicks);
    return advanceAutonomousSimulation(
      advanced,
      reactionTicks,
      now + reactionTicks,
    );
  });
}

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const worldSnapshots = sqliteTable("world_snapshots", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  snapshot: text("snapshot").notNull(),
  lastProcessedAt: integer("last_processed_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const worldEvents = sqliteTable(
  "world_events",
  {
    id: text("id").primaryKey(),
    worldId: text("world_id").notNull(),
    type: text("type").notNull(),
    origin: text("origin").notNull(),
    importance: integer("importance").notNull(),
    entityId: text("entity_id"),
    parentEventIds: text("parent_event_ids").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("world_events_world_created_idx").on(
      table.worldId,
      table.createdAt,
    ),
    index("world_events_entity_idx").on(table.entityId),
  ],
);

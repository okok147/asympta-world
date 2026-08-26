CREATE TABLE `world_events` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`type` text NOT NULL,
	`origin` text NOT NULL,
	`importance` integer NOT NULL,
	`entity_id` text,
	`parent_event_ids` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `world_events_world_created_idx` ON `world_events` (`world_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `world_events_entity_idx` ON `world_events` (`entity_id`);--> statement-breakpoint
CREATE TABLE `world_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`last_processed_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

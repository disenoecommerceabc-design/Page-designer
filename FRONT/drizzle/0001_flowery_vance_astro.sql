CREATE TABLE `builder_assets` (
	`filename` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`mime` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `builder_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`document` text NOT NULL,
	`revision` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `builder_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL
);

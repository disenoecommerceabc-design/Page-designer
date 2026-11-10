CREATE TABLE `builder_ai_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`kind` text NOT NULL,
	`fingerprint` text NOT NULL,
	`cost` integer NOT NULL,
	`day` text NOT NULL,
	`created` integer NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`result` text DEFAULT '{}' NOT NULL,
	`poll_until` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`provider_credits` text DEFAULT '0' NOT NULL
);

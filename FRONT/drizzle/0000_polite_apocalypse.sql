CREATE TABLE `interests` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plan` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`consent_version` text DEFAULT 'launch-v1' NOT NULL
);

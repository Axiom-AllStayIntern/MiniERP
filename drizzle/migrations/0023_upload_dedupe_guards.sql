CREATE TABLE IF NOT EXISTS `upload_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`endpoint` text NOT NULL,
	`user_id` text,
	`project_scope` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`response_body` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
CREATE UNIQUE INDEX IF NOT EXISTS `upload_idempotency_key_unique` ON `upload_idempotency` (`idempotency_key`);

CREATE TABLE IF NOT EXISTS `upload_file_dedup` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`project_scope` text NOT NULL,
	`file_hash` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
CREATE UNIQUE INDEX IF NOT EXISTS `upload_file_dedup_hash_unique` ON `upload_file_dedup` (`domain`, `project_scope`, `file_hash`);

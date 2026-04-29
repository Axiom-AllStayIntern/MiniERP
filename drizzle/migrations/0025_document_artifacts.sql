CREATE TABLE IF NOT EXISTS `document_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text DEFAULT 'default' NOT NULL,
	`source` text NOT NULL,
	`processing_status` text DEFAULT 'received' NOT NULL,
	`document_type` text,
	`original_file` text NOT NULL,
	`source_metadata` text,
	`text_extraction` text,
	`classification` text,
	`normalized_metadata` text,
	`security_flags` text,
	`size_bytes` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
CREATE INDEX IF NOT EXISTS `document_artifacts_tenant_status_idx` ON `document_artifacts` (`tenant_id`, `processing_status`);
CREATE INDEX IF NOT EXISTS `document_artifacts_tenant_created_idx` ON `document_artifacts` (`tenant_id`, `created_at`);

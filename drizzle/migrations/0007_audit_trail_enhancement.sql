-- AUD001: Centralised Audit Trail Enhancement
-- Adds IP address, module, action type, old/new value tracking, and hash chain for tamper evidence.

ALTER TABLE `audit_logs` ADD COLUMN `ip_address` text;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD COLUMN `module` text;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD COLUMN `action_type` text;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD COLUMN `old_value` text;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD COLUMN `new_value` text;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD COLUMN `hash_chain` text;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD COLUMN `seq` integer;
--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_logs` (`actor_user_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_module` ON `audit_logs` (`module`);
--> statement-breakpoint
CREATE INDEX `idx_audit_action_type` ON `audit_logs` (`action_type`);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_project` ON `audit_logs` (`project_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`, `entity_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_seq` ON `audit_logs` (`seq`);

ALTER TABLE `audit_logs` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action;
CREATE INDEX `audit_logs_project_id_created_at_idx` ON `audit_logs` (`project_id`, `created_at`);

ALTER TABLE `employees` ADD COLUMN `cpf_applicable` integer DEFAULT 1 NOT NULL;
ALTER TABLE `employees` ADD COLUMN `tax_resident_label` text;

CREATE TABLE `employee_compensation_components` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`label` text NOT NULL,
	`income_type` text NOT NULL,
	`rule_type` text NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`floor` real,
	`cap` real,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`taxable` integer DEFAULT 1 NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `employee_project_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`project_id` text NOT NULL,
	`weight_pct` real NOT NULL,
	`allocation_mode` text DEFAULT 'manual' NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `employee_compensation_components_employee_id_idx` ON `employee_compensation_components` (`employee_id`);
CREATE INDEX `employee_project_allocations_employee_id_idx` ON `employee_project_allocations` (`employee_id`);
CREATE INDEX `employee_project_allocations_project_id_idx` ON `employee_project_allocations` (`project_id`);

CREATE UNIQUE INDEX `employee_project_allocations_unique_active` ON `employee_project_allocations` (`employee_id`, `project_id`) WHERE `deleted_at` IS NULL;

ALTER TABLE `payout_records` ADD COLUMN `source` text DEFAULT 'settlement' NOT NULL;

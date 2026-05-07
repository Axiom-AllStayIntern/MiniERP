DROP TABLE `customers`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_employee_compensation_components` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`label` text NOT NULL,
	`income_type` text NOT NULL,
	`rule_type` text NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`floor` real,
	`cap` real,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`taxable` integer DEFAULT true NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_employee_compensation_components`("id", "employee_id", "label", "income_type", "rule_type", "value", "floor", "cap", "frequency", "taxable", "effective_from", "effective_to", "created_at", "updated_at", "deleted_at") SELECT "id", "employee_id", "label", "income_type", "rule_type", "value", "floor", "cap", "frequency", "taxable", "effective_from", "effective_to", "created_at", "updated_at", "deleted_at" FROM `employee_compensation_components`;--> statement-breakpoint
DROP TABLE `employee_compensation_components`;--> statement-breakpoint
ALTER TABLE `__new_employee_compensation_components` RENAME TO `employee_compensation_components`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_employee_project_allocations` (
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
	FOREIGN KEY (`employee_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_employee_project_allocations`("id", "employee_id", "project_id", "weight_pct", "allocation_mode", "effective_from", "effective_to", "created_at", "updated_at", "deleted_at") SELECT "id", "employee_id", "project_id", "weight_pct", "allocation_mode", "effective_from", "effective_to", "created_at", "updated_at", "deleted_at" FROM `employee_project_allocations`;--> statement-breakpoint
DROP TABLE `employee_project_allocations`;--> statement-breakpoint
ALTER TABLE `__new_employee_project_allocations` RENAME TO `employee_project_allocations`;--> statement-breakpoint
CREATE TABLE `__new_employee_salaries` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`month` text NOT NULL,
	`salary` real DEFAULT 0 NOT NULL,
	`allowance` real DEFAULT 0 NOT NULL,
	`cpf_employee` real DEFAULT 0 NOT NULL,
	`cpf_employer` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_employee_salaries`("id", "employee_id", "month", "salary", "allowance", "cpf_employee", "cpf_employer", "created_at", "updated_at", "deleted_at") SELECT "id", "employee_id", "month", "salary", "allowance", "cpf_employee", "cpf_employer", "created_at", "updated_at", "deleted_at" FROM `employee_salaries`;--> statement-breakpoint
DROP TABLE `employee_salaries`;--> statement-breakpoint
ALTER TABLE `__new_employee_salaries` RENAME TO `employee_salaries`;--> statement-breakpoint
CREATE TABLE `__new_project_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`person_id` text,
	`name` text NOT NULL,
	`role` text,
	`staff_type` text DEFAULT 'fulltime' NOT NULL,
	`date_in` text,
	`date_out` text,
	`cpf_applicable` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_project_employees`("id", "project_id", "person_id", "name", "role", "staff_type", "date_in", "date_out", "cpf_applicable", "created_at", "updated_at", "deleted_at") SELECT "id", "project_id", "person_id", "name", "role", "staff_type", "date_in", "date_out", "cpf_applicable", "created_at", "updated_at", "deleted_at" FROM `project_employees`;--> statement-breakpoint
DROP TABLE `project_employees`;--> statement-breakpoint
ALTER TABLE `__new_project_employees` RENAME TO `project_employees`;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`business_partner_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`type` text,
	`start_date` text,
	`end_date` text,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`business_partner_id`) REFERENCES `business_partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "business_partner_id", "name", "status", "type", "start_date", "end_date", "description", "created_at", "updated_at", "deleted_at") SELECT "id", "business_partner_id", "name", "status", "type", "start_date", "end_date", "description", "created_at", "updated_at", "deleted_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;
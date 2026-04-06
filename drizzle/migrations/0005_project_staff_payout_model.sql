CREATE TABLE `project_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`staff_type` text DEFAULT 'fulltime' NOT NULL,
	`date_in` text,
	`date_out` text,
	`cpf_applicable` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `compensation_components` (
	`id` text PRIMARY KEY NOT NULL,
	`project_employee_id` text NOT NULL,
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
	FOREIGN KEY (`project_employee_id`) REFERENCES `project_employees`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `payout_records` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`project_id` text NOT NULL,
	`period` text NOT NULL,
	`base_value` real DEFAULT 0 NOT NULL,
	`computed_amount` real DEFAULT 0 NOT NULL,
	`cpf_employee` real DEFAULT 0 NOT NULL,
	`cpf_employer` real DEFAULT 0 NOT NULL,
	`taxable_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`component_id`) REFERENCES `compensation_components`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `project_employees_project_id_idx` ON `project_employees` (`project_id`);
CREATE INDEX `compensation_components_project_employee_id_idx` ON `compensation_components` (`project_employee_id`);
CREATE INDEX `payout_records_project_id_idx` ON `payout_records` (`project_id`);
CREATE INDEX `payout_records_component_id_idx` ON `payout_records` (`component_id`);

INSERT INTO `project_employees` (`id`, `project_id`, `employee_id`, `name`, `role`, `staff_type`, `date_in`, `date_out`, `cpf_applicable`, `created_at`, `updated_at`, `deleted_at`)
SELECT
	'pe-' || pc.project_id || '-' || pc.employee_id,
	pc.project_id,
	pc.employee_id,
	e.name,
	NULL,
	CASE e.type
		WHEN 'full_time' THEN 'fulltime'
		WHEN 'part_time' THEN 'parttime'
		WHEN 'freelancer' THEN 'freelancer'
		WHEN 'advisor' THEN 'parttime'
		WHEN 'overseas_staff' THEN 'freelancer'
		ELSE 'fulltime'
	END,
	e.start_date,
	e.end_date,
	1,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP,
	NULL
FROM project_compensations pc
INNER JOIN employees e ON e.id = pc.employee_id AND e.deleted_at IS NULL
WHERE pc.deleted_at IS NULL
GROUP BY pc.project_id, pc.employee_id;

INSERT INTO `compensation_components` (`id`, `project_employee_id`, `label`, `income_type`, `rule_type`, `value`, `floor`, `cap`, `frequency`, `taxable`, `effective_from`, `effective_to`, `created_at`, `updated_at`, `deleted_at`)
SELECT
	'cc-' || pc.id,
	'pe-' || pc.project_id || '-' || pc.employee_id,
	COALESCE(pc.type, 'compensation'),
	CASE pc.type
		WHEN 'bonus' THEN 'bonus'
		WHEN 'freelance_fee' THEN 'allowance'
		ELSE 'bonus'
	END,
	'manual',
	COALESCE(pc.amount, 0),
	NULL,
	NULL,
	'one_off',
	1,
	pc.date,
	NULL,
	pc.created_at,
	pc.updated_at,
	pc.deleted_at
FROM project_compensations pc
WHERE pc.deleted_at IS NULL;

INSERT INTO `payout_records` (`id`, `component_id`, `project_id`, `period`, `base_value`, `computed_amount`, `cpf_employee`, `cpf_employer`, `taxable_amount`, `status`, `note`, `created_at`, `updated_at`, `deleted_at`)
SELECT
	'pay-' || pc.id,
	'cc-' || pc.id,
	pc.project_id,
	pc.date,
	COALESCE(pc.amount, 0),
	COALESCE(pc.amount, 0),
	0,
	0,
	COALESCE(pc.amount, 0),
	'confirmed',
	pc.description,
	pc.created_at,
	pc.updated_at,
	pc.deleted_at
FROM project_compensations pc
WHERE pc.deleted_at IS NULL;

DROP TABLE `project_compensations`;

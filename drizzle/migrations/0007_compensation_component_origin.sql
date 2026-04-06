-- Distinguish user-editable project lines vs system shadow lines for company allocation payouts.
ALTER TABLE `compensation_components` ADD COLUMN `origin` text DEFAULT 'manual' NOT NULL;
ALTER TABLE `compensation_components` ADD COLUMN `employee_compensation_component_id` text REFERENCES `employee_compensation_components`(`id`) ON UPDATE no action ON DELETE no action;

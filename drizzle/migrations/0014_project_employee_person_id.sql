-- Migration 0014: Backfill schema parity columns for person/project models

ALTER TABLE `project_employees` ADD COLUMN `person_id` text;
ALTER TABLE `projects` ADD COLUMN `type` text;
ALTER TABLE `projects` ADD COLUMN `business_partner_id` text;

-- Backfill existing rows. During transition, employees.id == persons.id.
UPDATE `project_employees`
SET `person_id` = `employee_id`
WHERE `person_id` IS NULL;

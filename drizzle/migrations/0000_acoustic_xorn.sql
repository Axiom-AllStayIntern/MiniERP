CREATE TABLE `company_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_url` text NOT NULL,
	`amount` real,
	`currency` text DEFAULT 'SGD',
	`date` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`contact` text,
	`gst_reg_no` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `employee_salaries` (
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
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`start_date` text,
	`end_date` text,
	`contact` text,
	`tax_id` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_system` text DEFAULT 'true' NOT NULL,
	`parent_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_categories_name_unique` ON `expense_categories` (`name`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'SGD' NOT NULL,
	`date` text NOT NULL,
	`staff_name` text,
	`file_url` text,
	`ocr_data` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gst_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`quarter` text NOT NULL,
	`year` text NOT NULL,
	`box_1` real DEFAULT 0 NOT NULL,
	`box_2` real DEFAULT 0 NOT NULL,
	`box_3` real DEFAULT 0 NOT NULL,
	`box_4` real DEFAULT 0 NOT NULL,
	`box_5` real DEFAULT 0 NOT NULL,
	`box_6` real DEFAULT 0 NOT NULL,
	`box_7` real DEFAULT 0 NOT NULL,
	`box_8` real DEFAULT 0 NOT NULL,
	`box_9` real DEFAULT 0 NOT NULL,
	`box_10` real DEFAULT 0 NOT NULL,
	`box_11` real DEFAULT 0 NOT NULL,
	`box_12` real DEFAULT 0 NOT NULL,
	`box_13` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`generated_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `invoices_in` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`po_id` text,
	`supplier_name` text,
	`invoice_date` text,
	`amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'SGD' NOT NULL,
	`gst_amount` real DEFAULT 0 NOT NULL,
	`due_date` text,
	`po_number` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`file_url` text NOT NULL,
	`ocr_confidence` real,
	`raw_ocr` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices_out` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`invoice_no` text NOT NULL,
	`date` text NOT NULL,
	`due_date` text,
	`currency` text DEFAULT 'SGD' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`gst_type` text DEFAULT 'standard' NOT NULL,
	`gst_amount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`pdf_url` text,
	`line_items` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_out_invoice_no_unique` ON `invoices_out` (`invoice_no`);--> statement-breakpoint
CREATE TABLE `project_compensations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`type` text DEFAULT 'bonus' NOT NULL,
	`description` text,
	`date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`start_date` text,
	`end_date` text,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`po_number` text NOT NULL,
	`file_url` text,
	`supplier_name` text,
	`amount` real,
	`currency` text DEFAULT 'SGD',
	`date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_type` text,
	`file_url` text,
	`amount` real,
	`currency` text DEFAULT 'SGD',
	`date` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
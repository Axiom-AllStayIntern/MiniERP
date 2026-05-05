import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { customers } from '../business-partner/schema';
import { employees } from '../person/schema';

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = sqliteTable('projects', {
	id: text('id').primaryKey(),
	customerId: text('customer_id')
		.notNull()
		.references(() => customers.id),
	/** Will be populated once BusinessPartner migration completes */
	businessPartnerId: text('business_partner_id'),
	name: text('name').notNull(),
	status: text('status').notNull().default('active'),
	type: text('type', { enum: ['delivery', 'ongoing', 'internal'] }),
	startDate: text('start_date'),
	endDate: text('end_date'),
	description: text('description'),
	...timeFields
});

// ---------------------------------------------------------------------------
// ProjectMembers (who works on this project)
// Previously named projectEmployees â€?kept as same DB table for compat
// ---------------------------------------------------------------------------

export const projectEmployees = sqliteTable('project_employees', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	employeeId: text('employee_id')
		.notNull()
		.references(() => employees.id),
	/** Will reference persons.id once Person migration completes */
	personId: text('person_id'),
	name: text('name').notNull(),
	role: text('role'),
	staffType: text('staff_type', {
		enum: ['fulltime', 'parttime', 'freelancer', 'director']
	})
		.notNull()
		.default('fulltime'),
	dateIn: text('date_in'),
	dateOut: text('date_out'),
	cpfApplicable: integer('cpf_applicable', { mode: 'boolean' }).notNull().default(true),
	...timeFields
});

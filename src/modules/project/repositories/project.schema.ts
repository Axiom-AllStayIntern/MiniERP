import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { businessPartners } from '$modules/business-partner/repositories/business-partner.schema';
import { persons } from '$modules/hr/repositories/person.schema';

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = sqliteTable('projects', {
	id: text('id').primaryKey(),
	businessPartnerId: text('business_partner_id').references(() => businessPartners.id),
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
// ---------------------------------------------------------------------------

export const projectEmployees = sqliteTable('project_employees', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	personId: text('person_id').references(() => persons.id),
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

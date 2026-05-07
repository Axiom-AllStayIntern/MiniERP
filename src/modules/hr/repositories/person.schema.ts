import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';

// ---------------------------------------------------------------------------
// Person (base identity table �?one row per natural person)
// ---------------------------------------------------------------------------

export const persons = sqliteTable('persons', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email'),
	phone: text('phone'),
	taxId: text('tax_id'),
	metadata: text('metadata'),
	...timeFields
});

// ---------------------------------------------------------------------------
// PersonRole (one person can hold multiple roles simultaneously)
// ---------------------------------------------------------------------------

export const personRoles = sqliteTable('person_roles', {
	id: text('id').primaryKey(),
	personId: text('person_id')
		.notNull()
		.references(() => persons.id),
	roleType: text('role_type', {
		enum: ['employee', 'shareholder', 'freelancer', 'director', 'advisor', 'contact']
	}).notNull(),
	/** Links to external entity, e.g. business_partner for contact roles */
	entityId: text('entity_id'),
	validFrom: text('valid_from'),
	validTo: text('valid_to'),
	...timeFields
});

// ---------------------------------------------------------------------------
// EmployeeProfile (extension for employee role)
// ---------------------------------------------------------------------------

export const employeeProfiles = sqliteTable('employee_profiles', {
	id: text('id').primaryKey(),
	personId: text('person_id')
		.notNull()
		.references(() => persons.id),
	employmentType: text('employment_type', {
		enum: ['full_time', 'part_time', 'freelancer', 'advisor', 'overseas_staff']
	}).notNull(),
	status: text('status').notNull().default('active'),
	startDate: text('start_date'),
	endDate: text('end_date'),
	cpfApplicable: integer('cpf_applicable', { mode: 'boolean' }).notNull().default(true),
	taxResidentLabel: text('tax_resident_label'),
	location: text('location'),
	metadata: text('metadata'),
	...timeFields
});

// ---------------------------------------------------------------------------
// ShareholderProfile (extension for shareholder role)
// ---------------------------------------------------------------------------

export const shareholderProfiles = sqliteTable('shareholder_profiles', {
	id: text('id').primaryKey(),
	personId: text('person_id')
		.notNull()
		.references(() => persons.id),
	sharePercentage: real('share_percentage'),
	dividendAccount: text('dividend_account'),
	...timeFields
});

// ---------------------------------------------------------------------------
// FreelancerProfile (extension for freelancer role)
// ---------------------------------------------------------------------------

export const freelancerProfiles = sqliteTable('freelancer_profiles', {
	id: text('id').primaryKey(),
	personId: text('person_id')
		.notNull()
		.references(() => persons.id),
	rateType: text('rate_type', { enum: ['daily', 'project', 'hourly'] }),
	rateAmount: real('rate_amount'),
	currency: text('currency').default('SGD'),
	paymentTerms: text('payment_terms'),
	businessName: text('business_name'),
	...timeFields
});


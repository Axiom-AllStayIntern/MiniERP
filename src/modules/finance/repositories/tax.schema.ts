import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { persons } from '$modules/hr/repositories/person.schema';
import { projects } from '$modules/project/repositories/project.schema';

// ---------------------------------------------------------------------------
// GST Returns
// ---------------------------------------------------------------------------

export const gstReturns = sqliteTable('gst_returns', {
	id: text('id').primaryKey(),
	quarter: text('quarter').notNull(),
	year: text('year').notNull(),
	box1: real('box_1').notNull().default(0),
	box2: real('box_2').notNull().default(0),
	box3: real('box_3').notNull().default(0),
	box4: real('box_4').notNull().default(0),
	box5: real('box_5').notNull().default(0),
	box6: real('box_6').notNull().default(0),
	box7: real('box_7').notNull().default(0),
	box8: real('box_8').notNull().default(0),
	box9: real('box_9').notNull().default(0),
	box10: real('box_10').notNull().default(0),
	box11: real('box_11').notNull().default(0),
	box12: real('box_12').notNull().default(0),
	box13: real('box_13').notNull().default(0),
	status: text('status').notNull().default('draft'),
	generatedAt: text('generated_at'),
	...timeFields
});

// ---------------------------------------------------------------------------
// PersonIncome (unified income tracking for tax calculations)
// ---------------------------------------------------------------------------

export const personIncome = sqliteTable('person_income', {
	id: text('id').primaryKey(),
	personId: text('person_id')
		.notNull()
		.references(() => persons.id),
	/** Where this income originated */
	source: text('source', {
		enum: ['payout', 'dividend', 'external', 'reimbursement']
	}).notNull(),
	/** Links back to the source record (e.g. payoutRecords.id) */
	sourceId: text('source_id'),
	roleType: text('role_type', {
		enum: ['employee', 'shareholder', 'freelancer', 'director', 'advisor']
	}),
	incomeType: text('income_type', {
		enum: ['salary', 'cpf', 'bonus', 'dividend', 'advisory_fee', 'allowance', 'reimbursement']
	}).notNull(),
	amount: real('amount').notNull(),
	taxableAmount: real('taxable_amount'),
	currency: text('currency').notNull().default('SGD'),
	period: text('period'),
	projectId: text('project_id').references(() => projects.id),
	yearOfAssessment: text('year_of_assessment'),
	taxTreatment: text('tax_treatment', {
		enum: ['taxable', 'exempt', 'withholding']
	})
		.notNull()
		.default('taxable'),
	...timeFields
});

// ---------------------------------------------------------------------------
// TimeLog (work hour tracking for salary allocation)
// ---------------------------------------------------------------------------

export const timeLogs = sqliteTable('time_logs', {
	id: text('id').primaryKey(),
	personId: text('person_id')
		.notNull()
		.references(() => persons.id),
	projectId: text('project_id').references(() => projects.id),
	date: text('date').notNull(),
	hours: real('hours').notNull(),
	description: text('description'),
	billable: integer('billable', { mode: 'boolean' }).notNull().default(true),
	...timeFields
});

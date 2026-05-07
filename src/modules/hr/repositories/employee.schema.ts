import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { persons } from './person.schema';
import { projects, projectEmployees } from '$modules/project/repositories/project.schema';

// ---------------------------------------------------------------------------
// Employee salaries (monthly records)
// ---------------------------------------------------------------------------

export const employeeSalaries = sqliteTable('employee_salaries', {
	id: text('id').primaryKey(),
	employeeId: text('employee_id')
		.notNull()
		.references(() => persons.id),
	month: text('month').notNull(),
	salary: real('salary').notNull().default(0),
	allowance: real('allowance').notNull().default(0),
	cpfEmployee: real('cpf_employee').notNull().default(0),
	cpfEmployer: real('cpf_employer').notNull().default(0),
	...timeFields
});

// ---------------------------------------------------------------------------
// Company-level pay rules (not tied to a single project)
// ---------------------------------------------------------------------------

export const employeeCompensationComponents = sqliteTable('employee_compensation_components', {
	id: text('id').primaryKey(),
	employeeId: text('employee_id')
		.notNull()
		.references(() => persons.id),
	label: text('label').notNull(),
	incomeType: text('income_type', {
		enum: ['salary', 'bonus', 'allowance', 'dividend', 'reimbursement']
	}).notNull(),
	ruleType: text('rule_type', {
		enum: ['fixed', 'profit_pct', 'revenue_pct', 'equity_share', 'hourly', 'manual']
	}).notNull(),
	value: real('value').notNull().default(0),
	floor: real('floor'),
	cap: real('cap'),
	frequency: text('frequency', {
		enum: ['monthly', 'quarterly', 'annual', 'one_off', 'on_project_close']
	})
		.notNull()
		.default('monthly'),
	taxable: integer('taxable', { mode: 'boolean' }).notNull().default(true),
	effectiveFrom: text('effective_from').notNull(),
	effectiveTo: text('effective_to'),
	...timeFields
});

// ---------------------------------------------------------------------------
// Project allocation weights (how company salary distributes to projects)
// ---------------------------------------------------------------------------

export const employeeProjectAllocations = sqliteTable('employee_project_allocations', {
	id: text('id').primaryKey(),
	employeeId: text('employee_id')
		.notNull()
		.references(() => persons.id),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	weightPct: real('weight_pct').notNull(),
	allocationMode: text('allocation_mode', { enum: ['manual', 'timesheet'] })
		.notNull()
		.default('manual'),
	effectiveFrom: text('effective_from').notNull(),
	effectiveTo: text('effective_to'),
	...timeFields
});

// ---------------------------------------------------------------------------
// Project-scoped compensation components (versioned pay rules)
// ---------------------------------------------------------------------------

export const compensationComponents = sqliteTable('compensation_components', {
	id: text('id').primaryKey(),
	projectEmployeeId: text('project_employee_id')
		.notNull()
		.references(() => projectEmployees.id),
	origin: text('origin', { enum: ['manual', 'company_allocated'] })
		.notNull()
		.default('manual'),
	employeeCompensationComponentId: text('employee_compensation_component_id').references(
		() => employeeCompensationComponents.id
	),
	label: text('label').notNull(),
	incomeType: text('income_type', {
		enum: ['salary', 'bonus', 'allowance', 'dividend', 'reimbursement']
	}).notNull(),
	ruleType: text('rule_type', {
		enum: ['fixed', 'profit_pct', 'revenue_pct', 'equity_share', 'hourly', 'manual']
	}).notNull(),
	value: real('value').notNull().default(0),
	floor: real('floor'),
	cap: real('cap'),
	frequency: text('frequency', {
		enum: ['monthly', 'quarterly', 'annual', 'one_off', 'on_project_close']
	})
		.notNull()
		.default('monthly'),
	taxable: integer('taxable', { mode: 'boolean' }).notNull().default(true),
	effectiveFrom: text('effective_from').notNull(),
	effectiveTo: text('effective_to'),
	...timeFields
});

// ---------------------------------------------------------------------------
// Payout records (settlement output)
// ---------------------------------------------------------------------------

export const payoutRecords = sqliteTable('payout_records', {
	id: text('id').primaryKey(),
	componentId: text('component_id')
		.notNull()
		.references(() => compensationComponents.id),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	period: text('period').notNull(),
	baseValue: real('base_value').notNull().default(0),
	computedAmount: real('computed_amount').notNull().default(0),
	cpfEmployee: real('cpf_employee').notNull().default(0),
	cpfEmployer: real('cpf_employer').notNull().default(0),
	taxableAmount: real('taxable_amount').notNull().default(0),
	status: text('status', { enum: ['draft', 'confirmed', 'paid'] })
		.notNull()
		.default('draft'),
	source: text('source', { enum: ['settlement', 'allocated_from_company', 'adjustment'] })
		.notNull()
		.default('settlement'),
	note: text('note'),
	...timeFields
});

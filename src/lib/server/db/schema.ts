import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timeFields = {
	createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	deletedAt: text('deleted_at')
};

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	role: text('role', { enum: ['owner', 'finance', 'project_manager', 'employee'] })
		.notNull()
		.default('employee'),
	...timeFields
});

export const auditLogs = sqliteTable('audit_logs', {
	id: text('id').primaryKey(),
	actorUserId: text('actor_user_id').references(() => users.id),
	actorEmail: text('actor_email'),
	action: text('action').notNull(),
	entityType: text('entity_type').notNull(),
	entityId: text('entity_id'),
	/** When set, this row appears on the project detail activity feed. */
	projectId: text('project_id'),
	metadata: text('metadata'),
	...timeFields
});

export const customers = sqliteTable('customers', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	address: text('address'),
	contact: text('contact'),
	gstRegNo: text('gst_reg_no'),
	metadata: text('metadata'),
	...timeFields
});

export const projects = sqliteTable('projects', {
	id: text('id').primaryKey(),
	customerId: text('customer_id')
		.notNull()
		.references(() => customers.id),
	name: text('name').notNull(),
	status: text('status').notNull().default('active'),
	startDate: text('start_date'),
	endDate: text('end_date'),
	description: text('description'),
	...timeFields
});

export const contracts = sqliteTable('contracts', {
	id: text('id').primaryKey(),
	projectId: text('project_id').references(() => projects.id),
	fileUrl: text('file_url').notNull(),
	amount: real('amount'),
	currency: text('currency').default('SGD'),
	date: text('date'),
	metadata: text('metadata'),
	...timeFields
});

export const quotations = sqliteTable('quotations', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	sourceType: text('source_type'),
	fileUrl: text('file_url'),
	amount: real('amount'),
	currency: text('currency').default('SGD'),
	date: text('date'),
	metadata: text('metadata'),
	...timeFields
});

export const invoicesOut = sqliteTable('invoices_out', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	customerId: text('customer_id')
		.notNull()
		.references(() => customers.id),
	invoiceNo: text('invoice_no').notNull().unique(),
	date: text('date').notNull(),
	dueDate: text('due_date'),
	currency: text('currency').notNull().default('SGD'),
	subtotal: real('subtotal').notNull().default(0),
	gstType: text('gst_type', { enum: ['standard', 'zero', 'exempt'] }).notNull().default('standard'),
	gstAmount: real('gst_amount').notNull().default(0),
	total: real('total').notNull().default(0),
	status: text('status').notNull().default('draft'),
	pdfUrl: text('pdf_url'),
	lineItems: text('line_items'),
	...timeFields
});

export const purchaseOrders = sqliteTable('purchase_orders', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	poNumber: text('po_number').notNull().unique(),
	fileUrl: text('file_url'),
	supplierName: text('supplier_name'),
	amount: real('amount'),
	currency: text('currency').default('SGD'),
	date: text('date'),
	metadata: text('metadata'),
	...timeFields
});

export const invoicesIn = sqliteTable('invoices_in', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	poId: text('po_id').references(() => purchaseOrders.id),
	supplierName: text('supplier_name'),
	invoiceDate: text('invoice_date'),
	amount: real('amount').notNull().default(0),
	currency: text('currency').notNull().default('SGD'),
	gstAmount: real('gst_amount').notNull().default(0),
	dueDate: text('due_date'),
	poNumber: text('po_number'),
	status: text('status').notNull().default('pending_review'),
	fileUrl: text('file_url').notNull(),
	ocrConfidence: real('ocr_confidence'),
	rawOcr: text('raw_ocr'),
	...timeFields
});

export const employees = sqliteTable('employees', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type', { enum: ['full_time', 'part_time', 'freelancer', 'advisor', 'overseas_staff'] }).notNull(),
	status: text('status').notNull().default('active'),
	startDate: text('start_date'),
	endDate: text('end_date'),
	contact: text('contact'),
	taxId: text('tax_id'),
	/** Master switch; project_employee may still override per assignment. */
	cpfApplicable: integer('cpf_applicable', { mode: 'boolean' }).notNull().default(true),
	/** e.g. Singapore citizen, PR — used for payroll / IR8A context. */
	taxResidentLabel: text('tax_resident_label'),
	metadata: text('metadata'),
	...timeFields
});

export const employeeSalaries = sqliteTable('employee_salaries', {
	id: text('id').primaryKey(),
	employeeId: text('employee_id')
		.notNull()
		.references(() => employees.id),
	month: text('month').notNull(),
	salary: real('salary').notNull().default(0),
	allowance: real('allowance').notNull().default(0),
	cpfEmployee: real('cpf_employee').notNull().default(0),
	cpfEmployer: real('cpf_employer').notNull().default(0),
	...timeFields
});

/** Company-level pay rules (Employee module); not tied to a single project. */
export const employeeCompensationComponents = sqliteTable('employee_compensation_components', {
	id: text('id').primaryKey(),
	employeeId: text('employee_id')
		.notNull()
		.references(() => employees.id),
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

/** How much of company-level base cost is attributed to each project (manual or timesheet-derived). Weights should sum to 100 per active set. */
export const employeeProjectAllocations = sqliteTable('employee_project_allocations', {
	id: text('id').primaryKey(),
	employeeId: text('employee_id')
		.notNull()
		.references(() => employees.id),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	/** 0–100 */
	weightPct: real('weight_pct').notNull(),
	allocationMode: text('allocation_mode', { enum: ['manual', 'timesheet'] })
		.notNull()
		.default('manual'),
	effectiveFrom: text('effective_from').notNull(),
	effectiveTo: text('effective_to'),
	...timeFields
});

/** Project-scoped assignment: who is on this project (decoupled from pay rules). */
export const projectEmployees = sqliteTable('project_employees', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	employeeId: text('employee_id')
		.notNull()
		.references(() => employees.id),
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

/** Pay rule line per project employee (versioned via effective_from / effective_to). */
export const compensationComponents = sqliteTable('compensation_components', {
	id: text('id').primaryKey(),
	projectEmployeeId: text('project_employee_id')
		.notNull()
		.references(() => projectEmployees.id),
	/** manual = user-defined project rules; company_allocated = shadow line for payouts tied to employee master components. */
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

/** Settlement output; project Staff Cost sums confirmed/paid rows excluding dividend income_type. */
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
	/** settlement = project rule run; allocated_from_company = base salary split from Employee module; adjustment = manual correction */
	source: text('source', { enum: ['settlement', 'allocated_from_company', 'adjustment'] })
		.notNull()
		.default('settlement'),
	note: text('note'),
	...timeFields
});

export const expenses = sqliteTable('expenses', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	category: text('category').notNull(),
	subcategory: text('subcategory'),
	amount: real('amount').notNull().default(0),
	currency: text('currency').notNull().default('SGD'),
	date: text('date').notNull(),
	staffName: text('staff_name'),
	fileUrl: text('file_url'),
	ocrData: text('ocr_data'),
	metadata: text('metadata'),
	...timeFields
});

export const expenseCategories = sqliteTable('expense_categories', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	isSystem: text('is_system').notNull().default('true'),
	parentId: text('parent_id'),
	...timeFields
});

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

export const companySettings = sqliteTable('company_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	...timeFields
});

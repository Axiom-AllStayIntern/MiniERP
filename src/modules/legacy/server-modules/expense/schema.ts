import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { projects } from '$modules/project/repositories/project.schema';

// ---------------------------------------------------------------------------
// Documents (Layer 1: file storage with OCR results)
// ---------------------------------------------------------------------------

export const documents = sqliteTable('documents', {
	id: text('id').primaryKey(),
	projectId: text('project_id').references(() => projects.id),
	uploadedBy: text('uploaded_by').notNull(),
	entityType: text('entity_type', {
		enum: ['expense', 'revenue', 'contract', 'quotation', 'purchase_order']
	}),
	entityId: text('entity_id'),

	fileKey: text('file_key').notNull(),
	fileName: text('file_name').notNull(),
	fileType: text('file_type').notNull(),

	purpose: text('purpose', { enum: ['financial', 'reference'] }).notNull(),
	docType: text('doc_type', {
		enum: ['invoice', 'receipt', 'contract', 'po', 'bom', 'quotation', 'other']
	}).notNull(),

	ocrStatus: text('ocr_status', {
		enum: ['pending', 'processing', 'done', 'failed']
	})
		.notNull()
		.default('pending'),
	ocrResult: text('ocr_result'),
	ocrConfidence: real('ocr_confidence'),

	notes: text('notes'),
	...timeFields
});

// ---------------------------------------------------------------------------
// Legacy compatibility view: business_trips
// ---------------------------------------------------------------------------
export const businessTrips = sqliteTable('business_trips', {
	id: text('id').primaryKey(),
	employeeId: text('employee_id'),
	projectId: text('project_id').references(() => projects.id),
	destination: text('destination'),
	startDate: text('start_date'),
	endDate: text('end_date'),
	days: integer('days'),
	dailyAllowanceRate: real('daily_allowance_rate'),
	status: text('status'),
	notes: text('notes'),
	...timeFields
});

// ---------------------------------------------------------------------------
// Expenses â€?redesigned per smartfin-expense-revenue-design.md
//
// Key principles:
//   - Record-on-save: no draft/confirmed/void status flow
//   - expense_type: opex | sales_cost (replaces cogs/opex dual columns)
//   - reimbursement & business_trip are boolean tags, not FK relations
//   - Scene-specific fields (tracking_number, po_number, etc.) go in metadata JSON
// ---------------------------------------------------------------------------

export const expenses = sqliteTable('expenses', {
	id: text('id').primaryKey(),
	projectId: text('project_id').references(() => projects.id),

	// Classification
	expenseType: text('expense_type', { enum: ['opex', 'sales_cost'] }).notNull(),
	category: text('category').notNull(),
	docType: text('doc_type', { enum: ['invoice', 'receipt', 'po'] }),

	// Financial data
	date: text('date').notNull(),
	amount: real('amount').notNull(),
	currency: text('currency').notNull().default('SGD'),
	sgdEquivalent: real('sgd_equivalent'),
	gstAmount: real('gst_amount').default(0),

	// Parties
	vendorOrSupplier: text('vendor_or_supplier'),
	staffName: text('staff_name'),

	// Business tags
	reimbursement: integer('reimbursement', { mode: 'boolean' }).notNull().default(false),
	businessTrip: integer('business_trip', { mode: 'boolean' }).notNull().default(false),
	destination: text('destination'),

	// File & scene-specific data
	documentRef: text('document_ref'),
	metadata: text('metadata'),

	notes: text('notes'),
	...timeFields
});

// ---------------------------------------------------------------------------
// Revenue â€?standalone table per design doc section 5 & 6.3
// ---------------------------------------------------------------------------

export const revenue = sqliteTable('revenue', {
	id: text('id').primaryKey(),

	invoiceType: text('invoice_type', {
		enum: ['standard', 'zero_rate', 'tax_invoice']
	}).notNull(),
	invoiceNumber: text('invoice_number'),

	clientName: text('client_name'),
	projectId: text('project_id').references(() => projects.id),

	date: text('date').notNull(),
	amount: real('amount').notNull(),
	currency: text('currency').notNull().default('SGD'),
	sgdEquivalent: real('sgd_equivalent'),
	gstAmount: real('gst_amount').default(0),

	documentRef: text('document_ref'),
	notes: text('notes'),
	...timeFields
});

// ---------------------------------------------------------------------------
// Expense categories (hierarchical, kept for dynamic extension)
// ---------------------------------------------------------------------------

export const expenseCategories = sqliteTable('expense_categories', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	isSystem: text('is_system').notNull().default('true'),
	parentId: text('parent_id'),
	...timeFields
});

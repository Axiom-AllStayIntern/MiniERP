import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { projects } from '$modules/project/repositories/project.schema';
import { purchaseOrders } from '$modules/project/repositories/archive.schema';
import { customers } from '$modules/business-partner/repositories/business-partner.schema';

// ---------------------------------------------------------------------------
// DEPRECATED: legacy compatibility tables for AR invoices and payments.
//
// Per v4 Migration Plan Wave 2 — invoicesIn / invoicesOut / payments are
// being read-paths-only-converged onto expenses / revenue. New code MUST NOT
// write to or read from these tables. Existing finance.billing-repository,
// finance.tax-service, and finance.revenue-service still consume them and
// will be migrated in Wave 2.
// ---------------------------------------------------------------------------

export const invoicesOut = sqliteTable('invoices_out', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	customerId: text('customer_id').references(() => customers.id),
	businessPartnerId: text('business_partner_id'),
	invoiceNo: text('invoice_no').notNull().unique(),
	date: text('date').notNull(),
	dueDate: text('due_date'),
	currency: text('currency').notNull().default('SGD'),
	subtotal: real('subtotal').notNull().default(0),
	gstType: text('gst_type', { enum: ['standard', 'zero', 'exempt'] })
		.notNull()
		.default('standard'),
	gstAmount: real('gst_amount').notNull().default(0),
	total: real('total').notNull().default(0),
	status: text('status').notNull().default('draft'),
	pdfUrl: text('pdf_url'),
	lineItems: text('line_items'),
	...timeFields
});

export const invoicesIn = sqliteTable('invoices_in', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	poId: text('po_id').references(() => purchaseOrders.id),
	businessPartnerId: text('business_partner_id'),
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

export const payments = sqliteTable('payments', {
	id: text('id').primaryKey(),
	direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
	businessPartnerId: text('business_partner_id'),
	projectId: text('project_id').references(() => projects.id),
	invoiceId: text('invoice_id'),
	invoiceType: text('invoice_type', { enum: ['customer', 'supplier'] }),
	amount: real('amount').notNull(),
	currency: text('currency').notNull().default('SGD'),
	paymentDate: text('payment_date').notNull(),
	method: text('method', { enum: ['bank_transfer', 'cheque', 'cash', 'credit_card', 'other'] }),
	reference: text('reference'),
	status: text('status', { enum: ['pending', 'completed', 'failed'] })
		.notNull()
		.default('pending'),
	note: text('note'),
	...timeFields
});

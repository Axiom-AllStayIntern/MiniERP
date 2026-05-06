import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { projects } from './project.schema';

// ---------------------------------------------------------------------------
// Project archive documents — contracts / quotations / purchase orders.
// Per v4 Migration Plan Wave 1.8: file artifacts stay in document-intake;
// these tables hold the structured business records (project FK, dates,
// terms, amounts) referenced via documentArtifactId / fileUrl.
// ---------------------------------------------------------------------------

export const contracts = sqliteTable('contracts', {
	id: text('id').primaryKey(),
	projectId: text('project_id').references(() => projects.id),
	businessPartnerId: text('business_partner_id'),
	clientName: text('client_name'),
	contractNumber: text('contract_number'),
	effectiveDate: text('effective_date'),
	expiryDate: text('expiry_date'),
	scope: text('scope'),
	type: text('type', { enum: ['customer_contract', 'supplier_contract'] }),
	fileUrl: text('file_url').notNull(),
	amount: real('amount'),
	currency: text('currency').default('SGD'),
	status: text('status', {
		enum: ['draft', 'active', 'completed', 'terminated']
	}),
	paymentTerms: text('payment_terms'),
	metadata: text('metadata'),
	notes: text('notes'),
	...timeFields
});

export const quotations = sqliteTable('quotations', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	businessPartnerId: text('business_partner_id'),
	clientName: text('client_name'),
	quotationNumber: text('quotation_number'),
	fileUrl: text('file_url'),
	amount: real('amount'),
	currency: text('currency').default('SGD'),
	date: text('date'),
	status: text('status', {
		enum: ['draft', 'sent', 'accepted', 'rejected', 'expired']
	}),
	validUntil: text('valid_until'),
	lineItems: text('line_items'),
	metadata: text('metadata'),
	notes: text('notes'),
	...timeFields
});

export const purchaseOrders = sqliteTable('purchase_orders', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id),
	businessPartnerId: text('business_partner_id'),
	clientName: text('client_name'),
	poNumber: text('po_number').notNull().unique(),
	fileUrl: text('file_url'),
	supplierName: text('supplier_name'),
	amount: real('amount'),
	currency: text('currency').default('SGD'),
	date: text('date'),
	description: text('description'),
	status: text('status', {
		enum: ['draft', 'sent', 'confirmed', 'fulfilled']
	}),
	lineItems: text('line_items'),
	metadata: text('metadata'),
	notes: text('notes'),
	...timeFields
});

// Flexible document-to-document linking (quotation→contract, contract→revenue,
// po→expense, etc.). Lives with archives because it primarily describes how
// project archive documents relate to one another and to finance facts.
export const arDocumentLinks = sqliteTable('ar_document_links', {
	id: text('id').primaryKey(),
	fromType: text('from_type', {
		enum: ['quotation', 'contract', 'purchase_order', 'expense', 'revenue']
	}).notNull(),
	fromId: text('from_id').notNull(),
	toType: text('to_type', {
		enum: ['quotation', 'contract', 'purchase_order', 'expense', 'revenue']
	}).notNull(),
	toId: text('to_id').notNull(),
	linkType: text('link_type', {
		enum: ['quotation_to_contract', 'contract_to_revenue', 'po_to_expense', 'derived_from', 'replaces']
	}).notNull(),
	...timeFields
});

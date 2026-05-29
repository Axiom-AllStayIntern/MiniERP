import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { businessPartners } from '$modules/sales-crm/repositories/customer.schema';

export const partnerContacts = sqliteTable('partner_contacts', {
	id: text('id').primaryKey(),
	partnerId: text('partner_id')
		.notNull()
		.references(() => businessPartners.id),
	name: text('name').notNull(),
	phoneEmail: text('phone_email'),
	wechat: text('wechat'),
	position: text('position'),
	...timeFields
});

export const partnerSupplierProfiles = sqliteTable('partner_supplier_profiles', {
	id: text('id').primaryKey(),
	partnerId: text('partner_id')
		.notNull()
		.references(() => businessPartners.id),
	supplierType: text('supplier_type', {
		enum: ['individual', 'corporate_local', 'corporate_international']
	})
		.notNull()
		.default('corporate_local'),
	supplierStatus: text('supplier_status', {
		enum: ['approved', 'preferred', 'on_hold', 'blacklisted']
	})
		.notNull()
		.default('approved'),
	acraUen: text('acra_uen'),
	businessRegistrationNo: text('business_registration_no'),
	gstRegistrationStatus: text('gst_registration_status', {
		enum: ['registered', 'not_registered', 'exempt', 'unknown']
	})
		.notNull()
		.default('unknown'),
	taxCode: text('tax_code', { enum: ['SR', 'ZR', 'ES', 'OP'] }),
	billingAddress: text('billing_address'),
	shippingAddress: text('shipping_address'),
	bankName: text('bank_name'),
	bankAccountNo: text('bank_account_no'),
	swiftCode: text('swift_code'),
	creditTerms: text('credit_terms'),
	paymentTerms: text('payment_terms'),
	preferredCurrency: text('preferred_currency').default('SGD'),
	supplierCategory: text('supplier_category'),
	...timeFields
});

export const partnerSupplierComplianceRecords = sqliteTable('partner_supplier_compliance_records', {
	id: text('id').primaryKey(),
	partnerId: text('partner_id')
		.notNull()
		.references(() => businessPartners.id),
	recordType: text('record_type', {
		enum: ['licence', 'permit', 'insurance', 'certificate', 'other']
	}).notNull(),
	title: text('title').notNull(),
	issuer: text('issuer'),
	referenceNo: text('reference_no'),
	issueDate: text('issue_date'),
	expiryDate: text('expiry_date'),
	status: text('status', { enum: ['valid', 'expiring', 'expired', 'pending_review'] })
		.notNull()
		.default('pending_review'),
	notes: text('notes'),
	...timeFields
});

export const partnerSupplierAttachments = sqliteTable('partner_supplier_attachments', {
	id: text('id').primaryKey(),
	partnerId: text('partner_id')
		.notNull()
		.references(() => businessPartners.id),
	attachmentType: text('attachment_type', {
		enum: ['mou', 'nda', 'contract', 'certificate', 'licence', 'permit', 'insurance', 'other']
	}).notNull(),
	title: text('title').notNull(),
	fileName: text('file_name'),
	fileUrl: text('file_url'),
	expiryDate: text('expiry_date'),
	notes: text('notes'),
	...timeFields
});

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';

// ---------------------------------------------------------------------------
// BusinessPartner (unified supplier + customer entity)
// ---------------------------------------------------------------------------

export const businessPartners = sqliteTable('business_partners', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type', { enum: ['customer', 'supplier', 'both'] })
		.notNull()
		.default('customer'),
	registrationNo: text('registration_no'),
	country: text('country'),
	address: text('address'),
	contact: text('contact'),
	itemDescription: text('item_description'),
	dateCreate: text('date_create'),
	projectRelated: text('project_related'),
	currency: text('currency').default('SGD'),
	gstRegNo: text('gst_reg_no'),
	metadata: text('metadata'),
	...timeFields
});

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

// ---------------------------------------------------------------------------
// PartnerSupplierProfile (supplier extension)
// ---------------------------------------------------------------------------

export const partnerSupplierProfiles = sqliteTable('partner_supplier_profiles', {
	id: text('id').primaryKey(),
	partnerId: text('partner_id')
		.notNull()
		.references(() => businessPartners.id),
	paymentTerms: text('payment_terms'),
	preferredCurrency: text('preferred_currency').default('SGD'),
	supplierCategory: text('supplier_category'),
	...timeFields
});

// ---------------------------------------------------------------------------
// PartnerCustomerProfile (customer extension)
// ---------------------------------------------------------------------------

export const partnerCustomerProfiles = sqliteTable('partner_customer_profiles', {
	id: text('id').primaryKey(),
	partnerId: text('partner_id')
		.notNull()
		.references(() => businessPartners.id),
	creditLimit: text('credit_limit'),
	billingTerms: text('billing_terms'),
	customerTier: text('customer_tier'),
	...timeFields
});


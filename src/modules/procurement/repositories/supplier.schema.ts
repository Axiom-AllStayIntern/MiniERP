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
	paymentTerms: text('payment_terms'),
	preferredCurrency: text('preferred_currency').default('SGD'),
	supplierCategory: text('supplier_category'),
	...timeFields
});

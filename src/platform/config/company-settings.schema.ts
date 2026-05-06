import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';

/** Key-value store for global company configuration (modules.enabled, GST manual boxes, etc). */
export const companySettings = sqliteTable('company_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	...timeFields
});

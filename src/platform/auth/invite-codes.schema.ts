import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.schema';

export const inviteCodes = sqliteTable('invite_codes', {
	id: text('id').primaryKey(),
	code: text('code').notNull().unique(),
	roles: text('roles').notNull(),
	createdBy: text('created_by')
		.notNull()
		.references(() => users.id),
	usedBy: text('used_by').references(() => users.id),
	usedAt: text('used_at'),
	expiresAt: text('expires_at').notNull(),
	maxUses: integer('max_uses').notNull().default(1),
	useCount: integer('use_count').notNull().default(0),
	label: text('label'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	deletedAt: text('deleted_at')
});

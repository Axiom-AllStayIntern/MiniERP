import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Use millis timestamps so better-auth `Date` fields map cleanly via Drizzle + SQLite. */
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	/** better-auth email verification */
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	role: text('role', { enum: ['owner', 'finance', 'project_manager', 'hr', 'employee'] })
		.notNull()
		.default('owner'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
	deletedAt: text('deleted_at')
});

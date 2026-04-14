import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '../schema-helpers';

// ---------------------------------------------------------------------------
// Users (authentication & role assignment)
// ---------------------------------------------------------------------------

/** Use millis timestamps so better-auth `Date` fields map cleanly via Drizzle + SQLite. */
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	/** better-auth email verification */
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	role: text('role', { enum: ['owner', 'finance', 'project_manager', 'employee'] })
		.notNull()
		.default('owner'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
	deletedAt: text('deleted_at')
});

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Company settings (key-value store)
// ---------------------------------------------------------------------------

export const companySettings = sqliteTable('company_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	...timeFields
});

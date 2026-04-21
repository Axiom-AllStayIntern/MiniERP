import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
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

// ---------------------------------------------------------------------------
// Upload safeguards (idempotency + file hash dedupe)
// ---------------------------------------------------------------------------

export const uploadIdempotency = sqliteTable(
	'upload_idempotency',
	{
		id: text('id').primaryKey(),
		idempotencyKey: text('idempotency_key').notNull(),
		endpoint: text('endpoint').notNull(),
		userId: text('user_id'),
		projectScope: text('project_scope').notNull(),
		status: text('status', { enum: ['processing', 'completed', 'failed'] })
			.notNull()
			.default('processing'),
		responseBody: text('response_body'),
		errorMessage: text('error_message'),
		...timeFields
	},
	(table) => ({
		keyUnique: uniqueIndex('upload_idempotency_key_unique').on(table.idempotencyKey)
	})
);

export const uploadFileDedup = sqliteTable(
	'upload_file_dedup',
	{
		id: text('id').primaryKey(),
		domain: text('domain', { enum: ['expense', 'revenue'] }).notNull(),
		projectScope: text('project_scope').notNull(),
		fileHash: text('file_hash').notNull(),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		createdBy: text('created_by'),
		...timeFields
	},
	(table) => ({
		hashUnique: uniqueIndex('upload_file_dedup_hash_unique').on(
			table.domain,
			table.projectScope,
			table.fileHash
		)
	})
);

import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';

/** Idempotency keys for client-driven upload retries. */
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

/** Server-side dedupe of identical file uploads within (domain, project_scope, file_hash). */
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

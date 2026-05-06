import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';
import { users } from '$platform/auth/users.schema';

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

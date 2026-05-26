import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from '$platform/auth/users.schema';

/**
 * Centralised audit trail — append-only, no soft-delete.
 * Hash-chained for tamper evidence (AUD001 §7).
 */
export const auditLogs = sqliteTable('audit_logs', {
	id: text('id').primaryKey(),
	actorUserId: text('actor_user_id').references(() => users.id),
	actorEmail: text('actor_email'),
	ipAddress: text('ip_address'),
	module: text('module'),
	actionType: text('action_type'),
	action: text('action').notNull(),
	entityType: text('entity_type').notNull(),
	entityId: text('entity_id'),
	projectId: text('project_id'),
	oldValue: text('old_value'),
	newValue: text('new_value'),
	metadata: text('metadata'),
	/** SHA-256 hash of (prevHash + row content) for tamper-evidence chain */
	hashChain: text('hash_chain'),
	/** Monotonic sequence within this table, used for chain ordering */
	seq: integer('seq'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
}, (table) => [
	index('idx_audit_actor').on(table.actorUserId),
	index('idx_audit_module').on(table.module),
	index('idx_audit_action_type').on(table.actionType),
	index('idx_audit_created').on(table.createdAt),
	index('idx_audit_project').on(table.projectId, table.createdAt),
	index('idx_audit_entity').on(table.entityType, table.entityId),
	index('idx_audit_seq').on(table.seq)
]);

export type AuditActionType = 'view' | 'create' | 'update' | 'delete' | 'export' | 'login' | 'permission_change' | 'system';

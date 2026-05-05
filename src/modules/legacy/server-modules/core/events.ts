/** Core module event declarations */

export const CORE_EVENTS = {
	/** Emitted when an audit log entry is created */
	AUDIT_ENTRY_CREATED: 'audit.entry.created'
} as const;

export type AuditEntryCreatedPayload = {
	logId: string;
	action: string;
	entityType: string;
	entityId?: string | null;
	projectId?: string | null;
};

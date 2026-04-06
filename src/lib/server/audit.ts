import { getDb, schema } from '$lib/server/db';

type AuditInput = {
	action: string;
	entityType: string;
	entityId?: string | null;
	/** Scope to a project for the detail-page activity timeline (optional). */
	projectId?: string | null;
	metadata?: Record<string, unknown>;
};

export async function writeAuditLog(
	platform: App.Platform | undefined,
	actor: App.Locals['user'],
	input: AuditInput
) {
	if (!platform) return;
	const db = getDb(platform.env);
	const now = new Date().toISOString();
	await db.insert(schema.auditLogs).values({
		id: crypto.randomUUID(),
		actorUserId: actor?.id ?? null,
		actorEmail: actor?.email ?? null,
		action: input.action,
		entityType: input.entityType,
		entityId: input.entityId ?? null,
		projectId: input.projectId ?? null,
		metadata: input.metadata ? JSON.stringify(input.metadata) : null,
		createdAt: now,
		updatedAt: now
	});
}

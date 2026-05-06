import { desc, eq } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { auditLogs } from './audit-log.schema';

export class AuditRepository {
	constructor(private db: DBClient) {}

	async writeLog(
		actor: App.Locals['user'],
		input: {
			action: string;
			entityType: string;
			entityId?: string | null;
			projectId?: string | null;
			metadata?: Record<string, unknown>;
		}
	) {
		const now = new Date().toISOString();
		await this.db.insert(auditLogs).values({
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

	async getProjectActivity(projectId: string, limit = 20) {
		return this.db
			.select()
			.from(auditLogs)
			.where(eq(auditLogs.projectId, projectId))
			.orderBy(desc(auditLogs.createdAt))
			.limit(limit);
	}
}

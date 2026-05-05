import { eq, desc, isNull, and } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { users, auditLogs, companySettings } from './schema';
import { BaseRepository } from '$platform/modules/base-repository';

// ---------------------------------------------------------------------------
// UserRepository
// ---------------------------------------------------------------------------

export class UserRepository extends BaseRepository<typeof users> {
	constructor(db: DBClient) {
		super(db, users);
	}

	async findByEmail(email: string) {
		const rows = await this.db
			.select()
			.from(users)
			.where(and(eq(users.email, email), isNull(users.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}
}

// ---------------------------------------------------------------------------
// AuditRepository
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CompanySettingsRepository
// ---------------------------------------------------------------------------

export class CompanySettingsRepository {
	constructor(private db: DBClient) {}

	async get<T = string>(key: string): Promise<T | null> {
		const rows = await this.db
			.select()
			.from(companySettings)
			.where(eq(companySettings.key, key))
			.limit(1);
		if (!rows[0]) return null;
		try {
			return JSON.parse(rows[0].value) as T;
		} catch {
			return rows[0].value as unknown as T;
		}
	}

	async set(key: string, value: unknown) {
		const now = new Date().toISOString();
		const serialized = typeof value === 'string' ? value : JSON.stringify(value);
		// Upsert via INSERT OR REPLACE
		await this.db
			.insert(companySettings)
			.values({ key, value: serialized, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: companySettings.key,
				set: { value: serialized, updatedAt: now }
			});
	}
}

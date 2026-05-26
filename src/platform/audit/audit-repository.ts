import { desc, eq, and, gte, lte, like, sql } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { auditLogs, type AuditActionType } from './audit-log.schema';

export interface AuditWriteInput {
	action: string;
	entityType: string;
	entityId?: string | null;
	projectId?: string | null;
	module?: string | null;
	actionType?: AuditActionType | null;
	ipAddress?: string | null;
	oldValue?: Record<string, unknown> | null;
	newValue?: Record<string, unknown> | null;
	metadata?: Record<string, unknown>;
}

export interface AuditSearchParams {
	actorUserId?: string;
	actorEmail?: string;
	module?: string;
	actionType?: AuditActionType;
	entityType?: string;
	entityId?: string;
	projectId?: string;
	action?: string;
	dateFrom?: string;
	dateTo?: string;
	query?: string;
	page?: number;
	pageSize?: number;
}

export interface AuditSearchResult {
	items: (typeof auditLogs.$inferSelect)[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export class AuditRepository {
	constructor(private db: DBClient) {}

	async writeLog(
		actor: App.Locals['user'],
		input: AuditWriteInput
	): Promise<{ id: string; seq: number }> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const nextSeq = await this.getNextSeq();
		const prevHash = await this.getLastHash();

		const rowContent = JSON.stringify({
			id, seq: nextSeq,
			actorUserId: actor?.id ?? null,
			actorEmail: actor?.email ?? null,
			action: input.action,
			entityType: input.entityType,
			entityId: input.entityId ?? null,
			createdAt: now
		});

		const hashChain = await computeHash(prevHash + rowContent);

		await this.db.insert(auditLogs).values({
			id,
			actorUserId: actor?.id ?? null,
			actorEmail: actor?.email ?? null,
			ipAddress: input.ipAddress ?? null,
			module: input.module ?? null,
			actionType: input.actionType ?? null,
			action: input.action,
			entityType: input.entityType,
			entityId: input.entityId ?? null,
			projectId: input.projectId ?? null,
			oldValue: input.oldValue ? JSON.stringify(input.oldValue) : null,
			newValue: input.newValue ? JSON.stringify(input.newValue) : null,
			metadata: input.metadata ? JSON.stringify(input.metadata) : null,
			hashChain,
			seq: nextSeq,
			createdAt: now,
			updatedAt: now
		});

		return { id, seq: nextSeq };
	}

	async search(params: AuditSearchParams): Promise<AuditSearchResult> {
		const page = Math.max(1, params.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
		const offset = (page - 1) * pageSize;

		const conditions = this.buildConditions(params);

		const countResult = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(auditLogs)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		const total = countResult[0]?.count ?? 0;

		const items = await this.db
			.select()
			.from(auditLogs)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(auditLogs.createdAt))
			.limit(pageSize)
			.offset(offset);

		return {
			items,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize)
		};
	}

	async getProjectActivity(projectId: string, limit = 20) {
		return this.db
			.select()
			.from(auditLogs)
			.where(eq(auditLogs.projectId, projectId))
			.orderBy(desc(auditLogs.createdAt))
			.limit(limit);
	}

	async verifyIntegrity(fromSeq?: number, toSeq?: number): Promise<{
		valid: boolean;
		checkedCount: number;
		firstInvalidSeq: number | null;
		lastVerifiedSeq: number;
	}> {
		const conditions = [];
		if (fromSeq !== undefined) conditions.push(gte(auditLogs.seq, fromSeq));
		if (toSeq !== undefined) conditions.push(lte(auditLogs.seq, toSeq));

		const rows = await this.db
			.select()
			.from(auditLogs)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(auditLogs.seq);

		if (rows.length === 0) {
			return { valid: true, checkedCount: 0, firstInvalidSeq: null, lastVerifiedSeq: 0 };
		}

		let prevHash = '';
		if (rows[0].seq && rows[0].seq > 1) {
			const prev = await this.db
				.select({ hashChain: auditLogs.hashChain })
				.from(auditLogs)
				.where(eq(auditLogs.seq, rows[0].seq! - 1))
				.limit(1);
			prevHash = prev[0]?.hashChain ?? '';
		}

		let lastVerifiedSeq = 0;
		for (const row of rows) {
			const rowContent = JSON.stringify({
				id: row.id, seq: row.seq,
				actorUserId: row.actorUserId,
				actorEmail: row.actorEmail,
				action: row.action,
				entityType: row.entityType,
				entityId: row.entityId,
				createdAt: row.createdAt
			});

			const expectedHash = await computeHash(prevHash + rowContent);
			if (row.hashChain !== expectedHash) {
				return {
					valid: false,
					checkedCount: rows.indexOf(row) + 1,
					firstInvalidSeq: row.seq,
					lastVerifiedSeq
				};
			}
			prevHash = row.hashChain!;
			lastVerifiedSeq = row.seq ?? 0;
		}

		return { valid: true, checkedCount: rows.length, firstInvalidSeq: null, lastVerifiedSeq };
	}

	async getRetentionStats(): Promise<{
		totalCount: number;
		oldestEntry: string | null;
		newestEntry: string | null;
	}> {
		const [stats] = await this.db
			.select({
				totalCount: sql<number>`count(*)`,
				oldestEntry: sql<string>`min(created_at)`,
				newestEntry: sql<string>`max(created_at)`
			})
			.from(auditLogs);

		return {
			totalCount: stats?.totalCount ?? 0,
			oldestEntry: stats?.oldestEntry ?? null,
			newestEntry: stats?.newestEntry ?? null
		};
	}

	async archiveBeforeDate(cutoffDate: string): Promise<number> {
		const countResult = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(auditLogs)
			.where(lte(auditLogs.createdAt, cutoffDate));
		return countResult[0]?.count ?? 0;
	}

	private buildConditions(params: AuditSearchParams) {
		const conditions = [];
		if (params.actorUserId) conditions.push(eq(auditLogs.actorUserId, params.actorUserId));
		if (params.actorEmail) conditions.push(like(auditLogs.actorEmail, `%${params.actorEmail}%`));
		if (params.module) conditions.push(eq(auditLogs.module, params.module));
		if (params.actionType) conditions.push(eq(auditLogs.actionType, params.actionType));
		if (params.entityType) conditions.push(eq(auditLogs.entityType, params.entityType));
		if (params.entityId) conditions.push(eq(auditLogs.entityId, params.entityId));
		if (params.projectId) conditions.push(eq(auditLogs.projectId, params.projectId));
		if (params.action) conditions.push(like(auditLogs.action, `%${params.action}%`));
		if (params.dateFrom) conditions.push(gte(auditLogs.createdAt, params.dateFrom));
		if (params.dateTo) conditions.push(lte(auditLogs.createdAt, params.dateTo));
		if (params.query) {
			conditions.push(sql`(
				${auditLogs.action} LIKE ${'%' + params.query + '%'}
				OR ${auditLogs.actorEmail} LIKE ${'%' + params.query + '%'}
				OR ${auditLogs.entityType} LIKE ${'%' + params.query + '%'}
				OR ${auditLogs.entityId} LIKE ${'%' + params.query + '%'}
				OR ${auditLogs.metadata} LIKE ${'%' + params.query + '%'}
			)`);
		}
		return conditions;
	}

	private async getNextSeq(): Promise<number> {
		const [result] = await this.db
			.select({ maxSeq: sql<number>`COALESCE(MAX(seq), 0)` })
			.from(auditLogs);
		return (result?.maxSeq ?? 0) + 1;
	}

	private async getLastHash(): Promise<string> {
		const [result] = await this.db
			.select({ hashChain: auditLogs.hashChain })
			.from(auditLogs)
			.orderBy(desc(auditLogs.seq))
			.limit(1);
		return result?.hashChain ?? '';
	}
}

async function computeHash(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

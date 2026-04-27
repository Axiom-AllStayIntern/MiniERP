import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { revenue } from '../../../infrastructure/db/schema';

export const revenueSgdAmountExpr = (): SQL =>
	sql`CASE WHEN coalesce(${revenue.currency}, 'SGD') = 'SGD' THEN coalesce(nullif(${revenue.sgdEquivalent}, 0), ${revenue.amount}) ELSE coalesce(nullif(${revenue.sgdEquivalent}, 0), 0) END`;

export const projectRevenueTotalSumExpr = () =>
	sql<number>`coalesce(sum(${revenueSgdAmountExpr()}), 0)`;

export class RevenueRepository {
	constructor(private db: DBClient) {}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(revenue)
			.where(and(eq(revenue.projectId, projectId), isNull(revenue.deletedAt)))
			.orderBy(desc(revenue.date));
	}

	async getProjectRevenueTotal(projectId: string) {
		const rows = await this.db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(revenue)
			.where(and(eq(revenue.projectId, projectId), isNull(revenue.deletedAt)));

		return rows[0]?.total ?? 0;
	}

	async create(data: Record<string, unknown>) {
		const now = new Date().toISOString();
		const id = (data.id as string) ?? crypto.randomUUID();
		const row = {
			...data,
			id,
			createdAt: now,
			updatedAt: now
		};

		await this.db.insert(revenue).values(row as any);
		return row;
	}
}

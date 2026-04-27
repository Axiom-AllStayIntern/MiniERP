import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { contracts, invoicesIn, invoicesOut, revenue } from '../../../infrastructure/db/schema';
import { projectRevenueTotalSumExpr } from './revenue-repository';

export class BillingRepository {
	constructor(private db: DBClient) {}

	async findCustomerInvoicesByProject(projectId: string) {
		return this.db
			.select()
			.from(invoicesOut)
			.where(and(eq(invoicesOut.projectId, projectId), isNull(invoicesOut.deletedAt)))
			.orderBy(desc(invoicesOut.createdAt));
	}

	async findSupplierInvoicesByProject(projectId: string) {
		return this.db
			.select()
			.from(invoicesIn)
			.where(and(eq(invoicesIn.projectId, projectId), isNull(invoicesIn.deletedAt)))
			.orderBy(desc(invoicesIn.createdAt));
	}

	async getProjectRevenue(projectId: string) {
		const rows = await this.db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(revenue)
			.where(and(eq(revenue.projectId, projectId), isNull(revenue.deletedAt)));
		return rows[0]?.total ?? 0;
	}

	async getProjectPurchaseCost(projectId: string) {
		const rows = await this.db
			.select({ total: sql<number>`coalesce(sum(${invoicesIn.amount}), 0)` })
			.from(invoicesIn)
			.where(and(eq(invoicesIn.projectId, projectId), isNull(invoicesIn.deletedAt)));
		return rows[0]?.total ?? 0;
	}

	async findByInvoiceNo(invoiceNo: string) {
		const rows = await this.db.select().from(invoicesOut).where(eq(invoicesOut.invoiceNo, invoiceNo)).limit(1);
		return rows[0] ?? null;
	}

	async findById(id: string) {
		const rows = await this.db.select().from(invoicesOut).where(eq(invoicesOut.id, id)).limit(1);
		return rows[0] ?? null;
	}

	async findContractByProject(projectId: string) {
		const rows = await this.db
			.select()
			.from(contracts)
			.where(and(eq(contracts.projectId, projectId), isNull(contracts.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}
}

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { contracts, expenses, revenue } from '../../../infrastructure/db/schema';
import { projectRevenueTotalSumExpr } from './revenue-repository';

export class BillingRepository {
	constructor(private db: DBClient) {}

	async findCustomerInvoicesByProject(projectId: string) {
		return this.db
			.select()
			.from(revenue)
			.where(and(eq(revenue.projectId, projectId), isNull(revenue.deletedAt)))
			.orderBy(desc(revenue.createdAt));
	}

	async findSupplierInvoicesByProject(projectId: string) {
		return this.db
			.select()
			.from(expenses)
			.where(and(eq(expenses.projectId, projectId), isNull(expenses.deletedAt)))
			.orderBy(desc(expenses.createdAt));
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
			.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
			.from(expenses)
			.where(
				and(
					eq(expenses.projectId, projectId),
					eq(expenses.expenseType, 'sales_cost'),
					isNull(expenses.deletedAt)
				)
			);
		return rows[0]?.total ?? 0;
	}

	async findByInvoiceNo(invoiceNumber: string) {
		const rows = await this.db
			.select()
			.from(revenue)
			.where(eq(revenue.invoiceNumber, invoiceNumber))
			.limit(1);
		return rows[0] ?? null;
	}

	async findById(id: string) {
		const rows = await this.db.select().from(revenue).where(eq(revenue.id, id)).limit(1);
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

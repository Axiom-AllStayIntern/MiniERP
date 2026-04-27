import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { expenseCategories, expenses } from '../../../infrastructure/db/schema';

export const expenseSgdAmountExpr = (): SQL =>
	sql`CASE WHEN coalesce(${expenses.currency}, 'SGD') = 'SGD' THEN coalesce(nullif(${expenses.sgdEquivalent}, 0), ${expenses.amount}) ELSE coalesce(nullif(${expenses.sgdEquivalent}, 0), 0) END`;

export const projectExpenseOpexSumExpr = () =>
	sql<number>`coalesce(sum(case when ${expenses.expenseType} = 'opex' then ${expenseSgdAmountExpr()} else 0 end), 0)`;

export const projectExpenseSalesCostSumExpr = () =>
	sql<number>`coalesce(sum(case when ${expenses.expenseType} = 'sales_cost' then ${expenseSgdAmountExpr()} else 0 end), 0)`;

export const projectExpenseTotalSumExpr = () =>
	sql<number>`coalesce(sum(${expenseSgdAmountExpr()}), 0)`;

export class ExpenseRepository {
	constructor(private db: DBClient) {}

	async findById(expenseId: string) {
		const rows = await this.db
			.select()
			.from(expenses)
			.where(and(eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
			.limit(1);

		return rows[0] ?? null;
	}

	async findProjectExpenseById(projectId: string, expenseId: string) {
		const rows = await this.db
			.select()
			.from(expenses)
			.where(
				and(
					eq(expenses.id, expenseId),
					eq(expenses.projectId, projectId),
					isNull(expenses.deletedAt)
				)
			)
			.limit(1);

		return rows[0] ?? null;
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(expenses)
			.where(and(eq(expenses.projectId, projectId), isNull(expenses.deletedAt)))
			.orderBy(desc(expenses.date));
	}

	async getProjectExpenseSums(projectId: string) {
		const rows = await this.db
			.select({
				opex: projectExpenseOpexSumExpr(),
				salesCost: projectExpenseSalesCostSumExpr(),
				total: projectExpenseTotalSumExpr()
			})
			.from(expenses)
			.where(and(eq(expenses.projectId, projectId), isNull(expenses.deletedAt)));

		return {
			opex: rows[0]?.opex ?? 0,
			salesCost: rows[0]?.salesCost ?? 0,
			total: rows[0]?.total ?? 0
		};
	}

	async listCategories() {
		return this.db.select().from(expenseCategories).where(isNull(expenseCategories.deletedAt));
	}
}

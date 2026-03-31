import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const [income] = await db.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)` }).from(
		schema.invoicesOut
	);
	const [supplierCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
		.from(schema.invoicesIn);
	const [staffCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.projectCompensations.amount}), 0)` })
		.from(schema.projectCompensations);
	const [expenseCost] = await db.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` }).from(
		schema.expenses
	);

	const revenue = income?.total ?? 0;
	const totalExpense = (supplierCost?.total ?? 0) + (staffCost?.total ?? 0) + (expenseCost?.total ?? 0);

	return ok({
		revenue,
		expense: totalExpense,
		netProfit: revenue - totalExpense,
		pendingReceivable: 0,
		pendingPayable: 0
	});
};

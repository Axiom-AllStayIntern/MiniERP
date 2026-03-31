import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const rows = await db
		.select({
			projectId: schema.projects.id,
			projectName: schema.projects.name,
			revenue: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)`,
			purchaseCost: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)`,
			staffCost: sql<number>`coalesce(sum(${schema.projectCompensations.amount}), 0)`,
			expenseCost: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`
		})
		.from(schema.projects)
		.leftJoin(schema.invoicesOut, sql`${schema.invoicesOut.projectId} = ${schema.projects.id}`)
		.leftJoin(schema.invoicesIn, sql`${schema.invoicesIn.projectId} = ${schema.projects.id}`)
		.leftJoin(
			schema.projectCompensations,
			sql`${schema.projectCompensations.projectId} = ${schema.projects.id}`
		)
		.leftJoin(schema.expenses, sql`${schema.expenses.projectId} = ${schema.projects.id}`)
		.groupBy(schema.projects.id, schema.projects.name);

	return ok(
		rows.map((row) => {
			const cost = row.purchaseCost + row.staffCost + row.expenseCost;
			return {
				projectId: row.projectId,
				projectName: row.projectName,
				revenue: row.revenue,
				cost,
				profit: row.revenue - cost,
				profitMargin: row.revenue > 0 ? (row.revenue - cost) / row.revenue : 0
			};
		})
	);
};

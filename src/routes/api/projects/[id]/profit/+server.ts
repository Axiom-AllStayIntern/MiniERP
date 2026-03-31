import { and, eq, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const [project] = await db
		.select({ id: schema.projects.id })
		.from(schema.projects)
		.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)))
		.limit(1);

	if (!project) {
		return fail('Project not found', 404);
	}

	const [revenue] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)` })
		.from(schema.invoicesOut)
		.where(eq(schema.invoicesOut.projectId, params.id));
	const [purchaseCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
		.from(schema.invoicesIn)
		.where(eq(schema.invoicesIn.projectId, params.id));
	const [staffCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.projectCompensations.amount}), 0)` })
		.from(schema.projectCompensations)
		.where(eq(schema.projectCompensations.projectId, params.id));
	const [expenseCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
		.from(schema.expenses)
		.where(eq(schema.expenses.projectId, params.id));

	const result = {
		revenue: revenue?.total ?? 0,
		purchaseCost: purchaseCost?.total ?? 0,
		staffCost: staffCost?.total ?? 0,
		expenseCost: expenseCost?.total ?? 0
	};

	return ok({
		...result,
		profit: result.revenue - result.purchaseCost - result.staffCost - result.expenseCost
	});
};

import { and, eq, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';
import {
	staffCostPayoutJoinConditions,
	staffCostSumExpr
} from '$lib/server/project-staff-cost';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const [project] = await db
		.select()
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
	const [purchase] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
		.from(schema.invoicesIn)
		.where(eq(schema.invoicesIn.projectId, params.id));
	const [staff] = await db
		.select({ total: staffCostSumExpr() })
		.from(schema.payoutRecords)
		.innerJoin(
			schema.compensationComponents,
			eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
		)
		.where(and(eq(schema.payoutRecords.projectId, params.id), staffCostPayoutJoinConditions()));
	const [expense] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
		.from(schema.expenses)
		.where(eq(schema.expenses.projectId, params.id));

	const revenueTotal = revenue?.total ?? 0;
	const cost = (purchase?.total ?? 0) + (staff?.total ?? 0) + (expense?.total ?? 0);

	return ok({
		...project,
		profit: {
			revenue: revenueTotal,
			cost,
			net: revenueTotal - cost
		}
	});
};

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		name?: string;
		status?: string;
		description?: string | null;
		startDate?: string | null;
		endDate?: string | null;
	};

	const updates: Partial<typeof schema.projects.$inferInsert> = {
		updatedAt: new Date().toISOString()
	};

	if (body.name !== undefined) updates.name = body.name;
	if (body.status !== undefined) updates.status = body.status;
	if (body.description !== undefined) updates.description = body.description;
	if (body.startDate !== undefined) updates.startDate = body.startDate;
	if (body.endDate !== undefined) updates.endDate = body.endDate;

	const db = getDb(platform.env);
	const [project] = await db
		.select({ id: schema.projects.id })
		.from(schema.projects)
		.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)))
		.limit(1);

	if (!project) {
		return fail('Project not found', 404);
	}

	await db.update(schema.projects).set(updates).where(eq(schema.projects.id, params.id));

	return ok({ id: params.id, updated: true });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const now = new Date().toISOString();
	await db
		.update(schema.projects)
		.set({ deletedAt: now, updatedAt: now, status: 'archived' })
		.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)));

	return ok({ id: params.id, deleted: true });
};

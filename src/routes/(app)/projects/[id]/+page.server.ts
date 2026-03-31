import { and, eq, isNull, sql } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform) {
		throw error(500, 'Cloudflare platform bindings are required');
	}

	const db = getDb(platform.env);
	const [project] = await db
		.select()
		.from(schema.projects)
		.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)))
		.limit(1);

	if (!project) {
		throw error(404, 'Project not found');
	}

	const [customer] = await db
		.select({ id: schema.customers.id, name: schema.customers.name })
		.from(schema.customers)
		.where(eq(schema.customers.id, project.customerId))
		.limit(1);

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

	const breakdown = {
		revenue: revenue?.total ?? 0,
		purchaseCost: purchaseCost?.total ?? 0,
		staffCost: staffCost?.total ?? 0,
		expenseCost: expenseCost?.total ?? 0
	};

	return {
		project,
		customerName: customer?.name ?? project.customerId,
		breakdown,
		profit:
			breakdown.revenue - breakdown.purchaseCost - breakdown.staffCost - breakdown.expenseCost
	};
};

export const actions: Actions = {
	update: async ({ params, request, platform }) => {
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const status = String(form.get('status') ?? '');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const description = String(form.get('description') ?? '').trim();

		if (!name) {
			return fail(400, { message: '项目名称不能为空。' });
		}

		const db = getDb(platform.env);
		await db
			.update(schema.projects)
			.set({
				name,
				status: status || 'active',
				startDate: startDate || null,
				endDate: endDate || null,
				description: description || null,
				updatedAt: new Date().toISOString()
			})
			.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)));

		return { ok: true };
	},
	delete: async ({ params, platform }) => {
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.projects)
			.set({
				status: 'archived',
				deletedAt: now,
				updatedAt: now
			})
			.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)));

		throw redirect(303, '/projects');
	}
};

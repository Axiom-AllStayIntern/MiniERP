import { and, eq, isNull, sql } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { getDb, schema } from '$lib/server/modules/legacy-db';
import { effectiveAmountSgd } from '$lib/server/fx/effective-amount-sgd';
import {
	projectExpenseOpexSumExpr,
	projectExpenseSalesCostSumExpr,
	projectRevenueTotalSumExpr,
	revenueSgdAmountExpr
} from '$lib/server/modules/expense/repository';
import {
	staffCostPayoutJoinConditions,
	staffCostSumExpr
} from '$lib/server/project-staff-cost';

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	await parent();
	if (!platform) {
		throw error(500, 'Cloudflare platform bindings are required');
	}

	const db = getDb(platform.env);

	const [revenue] = await db
		.select({ total: projectRevenueTotalSumExpr() })
		.from(schema.revenue)
		.where(and(eq(schema.revenue.projectId, params.id), isNull(schema.revenue.deletedAt)));
	const [purchaseCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
		.from(schema.invoicesIn)
		.where(and(eq(schema.invoicesIn.projectId, params.id), isNull(schema.invoicesIn.deletedAt)));
	const staffPayoutWhere = and(eq(schema.payoutRecords.projectId, params.id), staffCostPayoutJoinConditions());
	const [staffCost] = await db
		.select({ total: staffCostSumExpr() })
		.from(schema.payoutRecords)
		.innerJoin(
			schema.compensationComponents,
			eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
		)
		.where(staffPayoutWhere);
	const expenseWhere = and(eq(schema.expenses.projectId, params.id), isNull(schema.expenses.deletedAt));
	const [expenseOpexRow, expenseSalesCostRow] = await Promise.all([
		db.select({ total: projectExpenseOpexSumExpr() }).from(schema.expenses).where(expenseWhere),
		db.select({ total: projectExpenseSalesCostSumExpr() }).from(schema.expenses).where(expenseWhere)
	]);
	const expenseOpexCost = expenseOpexRow[0]?.total ?? 0;
	const expenseSalesCost = expenseSalesCostRow[0]?.total ?? 0;
	const expenseCost = expenseOpexCost + expenseSalesCost;

	const [revenueItemsRaw, purchaseItems, staffItems, expenseRows] = await Promise.all([
		db
			.select({
				id: schema.revenue.id,
				label: sql<string>`coalesce(${schema.revenue.invoiceNumber}, ${schema.revenue.id})`,
				date: schema.revenue.date,
				status: sql<string>`'completed'`,
				amount: revenueSgdAmountExpr()
			})
			.from(schema.revenue)
			.where(and(eq(schema.revenue.projectId, params.id), isNull(schema.revenue.deletedAt)))
			.orderBy(sql`${schema.revenue.date} desc`, sql`${schema.revenue.createdAt} desc`),
		db
			.select({
				id: schema.invoicesIn.id,
				label: schema.invoicesIn.poNumber,
				date: schema.invoicesIn.invoiceDate,
				status: schema.invoicesIn.status,
				amount: schema.invoicesIn.amount
			})
			.from(schema.invoicesIn)
			.where(and(eq(schema.invoicesIn.projectId, params.id), isNull(schema.invoicesIn.deletedAt)))
			.orderBy(sql`${schema.invoicesIn.invoiceDate} desc`, sql`${schema.invoicesIn.createdAt} desc`),
		db
			.select({
				id: schema.payoutRecords.id,
				label: schema.compensationComponents.label,
				date: schema.payoutRecords.period,
				status: schema.payoutRecords.status,
				amount: schema.payoutRecords.computedAmount
			})
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(staffPayoutWhere)
			.orderBy(sql`${schema.payoutRecords.period} desc`, sql`${schema.payoutRecords.createdAt} desc`),
		db
			.select({
				id: schema.expenses.id,
				category: schema.expenses.category,
				date: schema.expenses.date,
				amount: schema.expenses.amount,
				sgdEquivalent: schema.expenses.sgdEquivalent,
				currency: schema.expenses.currency,
				expenseType: schema.expenses.expenseType
			})
			.from(schema.expenses)
			.where(and(eq(schema.expenses.projectId, params.id), isNull(schema.expenses.deletedAt)))
			.orderBy(sql`${schema.expenses.date} desc`, sql`${schema.expenses.createdAt} desc`)
	]);

	const revenueItems = revenueItemsRaw.map((r) => ({
		...r,
		amount: Number(r.amount ?? 0)
	}));

	const expenseItems = expenseRows.map((row) => ({
		id: row.id,
		label: row.category,
		date: row.date,
		status: row.expenseType === 'sales_cost' ? 'Sales Cost' : 'OpEx',
		amount: effectiveAmountSgd(row.currency, row.sgdEquivalent, row.amount)
	}));

	const breakdown = {
		revenue: revenue?.total ?? 0,
		purchaseCost: purchaseCost?.total ?? 0,
		staffCost: staffCost?.total ?? 0,
		expenseCost,
		expenseSalesCost,
		expenseOpexCost
	};

	const grossProfit =
		breakdown.revenue - breakdown.purchaseCost - breakdown.staffCost - breakdown.expenseSalesCost;
	const profit = grossProfit - breakdown.expenseOpexCost;

	return {
		breakdown,
		details: {
			revenueItems,
			purchaseItems,
			staffItems,
			expenseItems
		},
		grossProfit,
		profit,
		metricDocCounts: {
			revenue: revenueItems.length,
			purchase: purchaseItems.length,
			staff: staffItems.length,
			expense: expenseItems.length
		}
	};
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
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
			return fail(400, { message: 'Project name cannot be empty.' });
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

		await writeAuditLog(platform, locals.user, {
			action: 'project.update',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id,
			metadata: { status: status || 'active', name }
		});

		return { ok: true };
	},
	archive: async ({ params, platform, locals }) => {
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const db = getDb(platform.env);
		await db
			.update(schema.projects)
			.set({
				status: 'archived',
				updatedAt: new Date().toISOString()
			})
			.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)));

		await writeAuditLog(platform, locals.user, {
			action: 'project.archive',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id
		});

		return { ok: true };
	},
	remove: async ({ params, platform, locals }) => {
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.projects)
			.set({
				deletedAt: now,
				updatedAt: now
			})
			.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)));

		await writeAuditLog(platform, locals.user, {
			action: 'project.remove',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id
		});

		throw redirect(303, '/projects');
	}
};

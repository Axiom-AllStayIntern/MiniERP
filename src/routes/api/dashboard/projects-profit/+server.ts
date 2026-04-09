import { and, eq, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';
import {
	staffCostPayoutJoinConditions,
	staffCostPeriodBetween,
	staffCostSumExpr
} from '$lib/server/project-staff-cost';

function isIsoDate(value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const projectId = url.searchParams.get('projectId') ?? '';
	const projectStatus = url.searchParams.get('projectStatus') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const hasRange = isIsoDate(from) && isIsoDate(to) && from <= to;
	const db = getDb(platform.env);
	const projectConditions = [isNull(schema.projects.deletedAt)];
	if (projectId) projectConditions.push(eq(schema.projects.id, projectId));
	if (projectStatus) projectConditions.push(eq(schema.projects.status, projectStatus));

	const projects = await db
		.select({
			projectId: schema.projects.id,
			projectName: schema.projects.name,
			projectStatus: schema.projects.status
		})
		.from(schema.projects)
		.where(and(...projectConditions));

	if (projects.length === 0) {
		return ok([]);
	}

	const revenueConditions = [isNull(schema.invoicesOut.deletedAt)];
	if (hasRange) revenueConditions.push(sql`${schema.invoicesOut.date} between ${from} and ${to}`);
	const revenueRows = await db
		.select({
			projectId: schema.invoicesOut.projectId,
			total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)`
		})
		.from(schema.invoicesOut)
		.where(and(...revenueConditions))
		.groupBy(schema.invoicesOut.projectId);

	const purchaseConditions = [isNull(schema.invoicesIn.deletedAt)];
	if (hasRange) purchaseConditions.push(sql`${schema.invoicesIn.invoiceDate} between ${from} and ${to}`);
	const purchaseRows = await db
		.select({
			projectId: schema.invoicesIn.projectId,
			total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)`
		})
		.from(schema.invoicesIn)
		.where(and(...purchaseConditions))
		.groupBy(schema.invoicesIn.projectId);

	const staffConditions = [isNull(schema.payoutRecords.deletedAt), staffCostPayoutJoinConditions()];
	if (hasRange) staffConditions.push(staffCostPeriodBetween(from, to));
	const staffRows = await db
		.select({
			projectId: schema.payoutRecords.projectId,
			total: staffCostSumExpr()
		})
		.from(schema.payoutRecords)
		.innerJoin(
			schema.compensationComponents,
			eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
		)
		.where(and(...staffConditions))
		.groupBy(schema.payoutRecords.projectId);

	const expenseConditions = [isNull(schema.expenses.deletedAt)];
	if (hasRange) expenseConditions.push(sql`${schema.expenses.date} between ${from} and ${to}`);
	const expenseRows = await db
		.select({
			projectId: schema.expenses.projectId,
			total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`
		})
		.from(schema.expenses)
		.where(and(...expenseConditions))
		.groupBy(schema.expenses.projectId);

	const revenueMap = new Map(revenueRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
	const purchaseMap = new Map(purchaseRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
	const staffMap = new Map(staffRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
	const expenseMap = new Map(expenseRows.map((row) => [row.projectId, Number(row.total ?? 0)]));

	const ranking = projects
		.map((project) => {
			const revenue = revenueMap.get(project.projectId) ?? 0;
			const purchaseCost = purchaseMap.get(project.projectId) ?? 0;
			const staffCost = staffMap.get(project.projectId) ?? 0;
			const expenseCost = expenseMap.get(project.projectId) ?? 0;
			const cost = purchaseCost + staffCost + expenseCost;
			const profit = revenue - cost;
			return {
				projectId: project.projectId,
				projectName: project.projectName,
				projectStatus: project.projectStatus,
				revenue,
				cost,
				profit,
				profitMargin: revenue > 0 ? profit / revenue : 0
			};
		})
		.sort((a, b) => b.profit - a.profit);

	return ok(ranking);
};

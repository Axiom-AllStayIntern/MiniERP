import { and, between, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';
import {
	staffCostPayoutJoinConditions,
	staffCostPeriodBetween,
	staffCostSumExpr
} from '$lib/server/project-staff-cost';

function isIsoDate(value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pad(value: number) {
	return value.toString().padStart(2, '0');
}

function quarterRange(year: number, quarter: number) {
	const startMonth = (quarter - 1) * 3;
	const start = new Date(Date.UTC(year, startMonth, 1));
	const end = new Date(Date.UTC(year, startMonth + 3, 0));
	return {
		start: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
		end: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`
	};
}

function shiftQuarter(year: number, quarter: number, delta: number) {
	let y = year;
	let q = quarter + delta;
	while (q <= 0) {
		q += 4;
		y -= 1;
	}
	while (q > 4) {
		q -= 4;
		y += 1;
	}
	return { year: y, quarter: q };
}

function getQuarterKey(dateIso: string) {
	if (!isIsoDate(dateIso)) return '';
	const dt = new Date(`${dateIso}T00:00:00Z`);
	const q = Math.floor(dt.getUTCMonth() / 3) + 1;
	return `${dt.getUTCFullYear()}-Q${q}`;
}

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const projectStatus = url.searchParams.get('projectStatus') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';

	const now = new Date();
	const defaultEnd = now.toISOString().slice(0, 10);
	const defaultStartDt = new Date(now);
	defaultStartDt.setUTCDate(defaultStartDt.getUTCDate() - 29);
	const defaultStart = defaultStartDt.toISOString().slice(0, 10);
	const hasRange = isIsoDate(from) && isIsoDate(to) && from <= to;
	const current = hasRange ? { start: from, end: to } : { start: defaultStart, end: defaultEnd };

	const projectConditions = [isNull(schema.projects.deletedAt)];
	if (projectStatus) projectConditions.push(eq(schema.projects.status, projectStatus));
	const projects = await db
		.select({ id: schema.projects.id, name: schema.projects.name })
		.from(schema.projects)
		.where(and(...projectConditions));
	const projectIds = projects.map((item) => item.id);

	if (projectIds.length === 0) {
		return ok({
			pie: { supplierCost: 0, staffCost: 0, expenseCost: 0 },
			quarterly: [],
			projectBars: []
		});
	}

	const baseRevenueRange = [isNull(schema.invoicesOut.deletedAt), inArray(schema.invoicesOut.projectId, projectIds)];
	const baseSupplierRange = [isNull(schema.invoicesIn.deletedAt), inArray(schema.invoicesIn.projectId, projectIds)];
	const baseStaffRange = [
		isNull(schema.payoutRecords.deletedAt),
		inArray(schema.payoutRecords.projectId, projectIds),
		staffCostPayoutJoinConditions()
	];
	const baseExpenseRange = [isNull(schema.expenses.deletedAt), inArray(schema.expenses.projectId, projectIds)];

	const [supplierCostSum, staffCostSum, expenseCostSum] = await Promise.all([
		db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
			.from(schema.invoicesIn)
			.where(and(...baseSupplierRange, between(schema.invoicesIn.invoiceDate, current.start, current.end))),
		db
			.select({ total: staffCostSumExpr() })
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(
				and(...baseStaffRange, staffCostPeriodBetween(current.start, current.end))
			),
		db
			.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
			.from(schema.expenses)
			.where(and(...baseExpenseRange, between(schema.expenses.date, current.start, current.end)))
	]);

	const anchorDate = hasRange ? new Date(`${to}T00:00:00Z`) : now;
	const anchorYear = anchorDate.getUTCFullYear();
	const anchorQuarter = Math.floor(anchorDate.getUTCMonth() / 3) + 1;
	const quarterPoints = [3, 2, 1, 0].map((shift) => {
		const q = shiftQuarter(anchorYear, anchorQuarter, -shift);
		const range = quarterRange(q.year, q.quarter);
		return {
			key: `${q.year}-Q${q.quarter}`,
			label: `${q.year} Q${q.quarter}`,
			start: range.start,
			end: range.end,
			revenue: 0,
			expense: 0
		};
	});

	const quarterMap = new Map(quarterPoints.map((item) => [item.key, item]));
	const quarterStart = quarterPoints[0]?.start ?? current.start;
	const quarterEnd = quarterPoints[quarterPoints.length - 1]?.end ?? current.end;

	const [revenueRows, supplierRows, staffRows, expenseRows] = await Promise.all([
		db
			.select({
				date: schema.invoicesOut.date,
				projectId: schema.invoicesOut.projectId,
				amount: schema.invoicesOut.total
			})
			.from(schema.invoicesOut)
			.where(and(...baseRevenueRange, between(schema.invoicesOut.date, quarterStart, quarterEnd))),
		db
			.select({
				date: schema.invoicesIn.invoiceDate,
				projectId: schema.invoicesIn.projectId,
				amount: schema.invoicesIn.amount
			})
			.from(schema.invoicesIn)
			.where(and(...baseSupplierRange, between(schema.invoicesIn.invoiceDate, quarterStart, quarterEnd))),
		db
			.select({
				date: schema.payoutRecords.period,
				projectId: schema.payoutRecords.projectId,
				amount: schema.payoutRecords.computedAmount
			})
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(and(...baseStaffRange, staffCostPeriodBetween(quarterStart, quarterEnd))),
		db
			.select({
				date: schema.expenses.date,
				projectId: schema.expenses.projectId,
				amount: schema.expenses.amount
			})
			.from(schema.expenses)
			.where(and(...baseExpenseRange, between(schema.expenses.date, quarterStart, quarterEnd)))
	]);

	for (const row of revenueRows) {
		const key = getQuarterKey(row.date ?? '');
		const item = quarterMap.get(key);
		if (item) item.revenue += Number(row.amount ?? 0);
	}
	for (const row of supplierRows) {
		const key = getQuarterKey(row.date ?? '');
		const item = quarterMap.get(key);
		if (item) item.expense += Number(row.amount ?? 0);
	}
	for (const row of staffRows) {
		const key = getQuarterKey(row.date ?? '');
		const item = quarterMap.get(key);
		if (item) item.expense += Number(row.amount ?? 0);
	}
	for (const row of expenseRows) {
		const key = getQuarterKey(row.date ?? '');
		const item = quarterMap.get(key);
		if (item) item.expense += Number(row.amount ?? 0);
	}

	const projectRevenue = new Map<string, number>();
	const projectCost = new Map<string, number>();

	const [rangeRevenueRows, rangeSupplierRows, rangeStaffRows, rangeExpenseRows] = await Promise.all([
		db
			.select({
				projectId: schema.invoicesOut.projectId,
				total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)`
			})
			.from(schema.invoicesOut)
			.where(and(...baseRevenueRange, between(schema.invoicesOut.date, current.start, current.end)))
			.groupBy(schema.invoicesOut.projectId),
		db
			.select({
				projectId: schema.invoicesIn.projectId,
				total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)`
			})
			.from(schema.invoicesIn)
			.where(and(...baseSupplierRange, between(schema.invoicesIn.invoiceDate, current.start, current.end)))
			.groupBy(schema.invoicesIn.projectId),
		db
			.select({
				projectId: schema.payoutRecords.projectId,
				total: staffCostSumExpr()
			})
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(and(...baseStaffRange, staffCostPeriodBetween(current.start, current.end)))
			.groupBy(schema.payoutRecords.projectId),
		db
			.select({
				projectId: schema.expenses.projectId,
				total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`
			})
			.from(schema.expenses)
			.where(and(...baseExpenseRange, between(schema.expenses.date, current.start, current.end)))
			.groupBy(schema.expenses.projectId)
	]);

	for (const row of rangeRevenueRows) {
		projectRevenue.set(row.projectId, Number(row.total ?? 0));
	}
	for (const row of rangeSupplierRows) {
		projectCost.set(row.projectId, (projectCost.get(row.projectId) ?? 0) + Number(row.total ?? 0));
	}
	for (const row of rangeStaffRows) {
		projectCost.set(row.projectId, (projectCost.get(row.projectId) ?? 0) + Number(row.total ?? 0));
	}
	for (const row of rangeExpenseRows) {
		projectCost.set(row.projectId, (projectCost.get(row.projectId) ?? 0) + Number(row.total ?? 0));
	}

	const projectBars = projects
		.map((project) => ({
			projectId: project.id,
			projectName: project.name,
			revenue: projectRevenue.get(project.id) ?? 0,
			expense: projectCost.get(project.id) ?? 0
		}))
		.filter((item) => item.revenue > 0 || item.expense > 0)
		.sort((a, b) => b.revenue - a.revenue)
		.slice(0, 8);

	return ok({
		pie: {
			supplierCost: Number(supplierCostSum[0]?.total ?? 0),
			staffCost: Number(staffCostSum[0]?.total ?? 0),
			expenseCost: Number(expenseCostSum[0]?.total ?? 0)
		},
		quarterly: quarterPoints.map((item) => ({
			label: item.label,
			revenue: item.revenue,
			expense: item.expense
		})),
		projectBars
	});
};

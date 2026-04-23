import { and, between, desc, eq, inArray, isNull, not, or, sql } from 'drizzle-orm';
import type { ModuleContext } from '../types';
import { schema } from '../../db';
import {
	expenseSgdAmountExpr,
	projectExpenseOpexSumExpr,
	projectExpenseSalesCostSumExpr,
	projectExpenseTotalSumExpr,
	projectRevenueTotalSumExpr,
	revenueSgdAmountExpr
} from '../expense/repository';
import { effectiveAmountSgd } from '$lib/server/fx/effective-amount-sgd';
import {
	staffCostPayoutJoinConditions,
	staffCostPeriodBetween,
	staffCostSumExpr
} from '../employee/repository';
import { parseDocumentMetadata } from '$lib/server/document-metadata';

function isIsoDate(value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface DashboardOverviewRangeInput {
	from?: string | null;
	to?: string | null;
	now?: Date;
}

export interface DashboardChartsInput extends DashboardOverviewRangeInput {
	projectStatus?: string | null;
}

export interface ProjectsProfitInput extends DashboardOverviewRangeInput {
	projectId?: string | null;
	projectStatus?: string | null;
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

function csvEscape(value: string | number): string {
	const text = String(value ?? '');
	if (text.includes(',') || text.includes('"') || text.includes('\n')) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

function referenceFileLabel(fileUrl: string | null | undefined, metadata: string | null | undefined): string {
	const parsed = parseDocumentMetadata(metadata ?? null);
	if (parsed.upload?.fileName?.trim()) return parsed.upload.fileName.trim();
	if (!fileUrl) return '-';
	const pathOnly = fileUrl.split('?')[0];
	const tail = pathOnly.split('/').pop() ?? '';
	try {
		const decoded = decodeURIComponent(tail);
		if (decoded) return decoded;
	} catch {
		/* ignore malformed URL encoding */
	}
	return tail || fileUrl;
}

function friendlyDocNumber(primary: string | null | undefined, id: string): string {
	const trimmed = primary?.trim();
	if (trimmed) return trimmed;
	return id.length > 14 ? `${id.slice(0, 8)}...` : id;
}

function referenceNameFromDocumentRef(documentRef: string | null): string | null {
	if (!documentRef || documentRef.startsWith('manual://')) return null;
	const tail = documentRef.split('/').pop() ?? documentRef;
	try {
		return decodeURIComponent(tail) || tail;
	} catch {
		return tail;
	}
}

/**
 * DashboardService provides company-wide financial overview.
 * It reads from other module APIs to aggregate data.
 */
export class DashboardService {
	constructor(private ctx: ModuleContext) {}

	/**
	 * Get dashboard overview. Accepts pre-computed module data
	 * to avoid circular imports.
	 */
	async getOverview(deps: {
		getProjectsList: () => Promise<{ id: string; name: string; customerId: string }[]>;
		getProjectFinancials: (projectId: string) => Promise<{
			revenue: number;
			purchaseCost: number;
			staffCost: number;
			expenseCogs: number;
			expenseOpex: number;
			grossProfit: number;
			netProfit: number;
		}>;
	}) {
		const projects = await deps.getProjectsList();
		const financials = await Promise.all(
			projects.map(async (p) => ({
				projectId: p.id,
				projectName: p.name,
				...(await deps.getProjectFinancials(p.id))
			}))
		);

		const totals = financials.reduce(
			(acc, f) => ({
				totalRevenue: acc.totalRevenue + f.revenue,
				totalCost: acc.totalCost + f.purchaseCost + f.staffCost + f.expenseCogs + f.expenseOpex,
				totalGrossProfit: acc.totalGrossProfit + f.grossProfit,
				totalNetProfit: acc.totalNetProfit + f.netProfit
			}),
			{ totalRevenue: 0, totalCost: 0, totalGrossProfit: 0, totalNetProfit: 0 }
		);

		return { projects: financials, ...totals };
	}

	/**
	 * Read model for GET /api/dashboard/overview.
	 *
	 * This preserves the existing SQL and response shape while moving the
	 * route behind the reporting module public API.
	 */
	async getCompanyFinancialOverview(input: DashboardOverviewRangeInput = {}) {
		const db = this.ctx.db;
		const from = input.from ?? '';
		const to = input.to ?? '';

		const end = input.now ? new Date(input.now) : new Date();
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - 29);

		const hasCustomRange = isIsoDate(from) && isIsoDate(to) && from <= to;
		const current = hasCustomRange
			? { start: from, end: to }
			: {
					start: start.toISOString().slice(0, 10),
					end: end.toISOString().slice(0, 10)
				};

		const currentStart = new Date(`${current.start}T00:00:00Z`);
		const currentEnd = new Date(`${current.end}T00:00:00Z`);
		const spanDays =
			Math.max(
				1,
				Math.floor((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
			) || 30;

		const prevStart = new Date(currentStart);
		prevStart.setUTCDate(prevStart.getUTCDate() - spanDays);
		const prevEnd = new Date(currentStart);
		prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

		const previous = {
			start: prevStart.toISOString().slice(0, 10),
			end: prevEnd.toISOString().slice(0, 10)
		};

		const [income] = await db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(schema.revenue)
			.where(and(between(schema.revenue.date, current.start, current.end), isNull(schema.revenue.deletedAt)));
		const [supplierCost] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
			.from(schema.invoicesIn)
			.where(
				and(
					between(schema.invoicesIn.invoiceDate, current.start, current.end),
					isNull(schema.invoicesIn.deletedAt)
				)
			);
		const [staffCost] = await db
			.select({ total: staffCostSumExpr() })
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(and(staffCostPeriodBetween(current.start, current.end), staffCostPayoutJoinConditions()));
		const [expenseCost] = await db
			.select({ total: projectExpenseTotalSumExpr() })
			.from(schema.expenses)
			.where(and(between(schema.expenses.date, current.start, current.end), isNull(schema.expenses.deletedAt)));

		const [prevIncome] = await db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(schema.revenue)
			.where(
				and(between(schema.revenue.date, previous.start, previous.end), isNull(schema.revenue.deletedAt))
			);
		const [prevSupplierCost] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
			.from(schema.invoicesIn)
			.where(
				and(
					between(schema.invoicesIn.invoiceDate, previous.start, previous.end),
					isNull(schema.invoicesIn.deletedAt)
				)
			);
		const [prevStaffCost] = await db
			.select({ total: staffCostSumExpr() })
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(and(staffCostPeriodBetween(previous.start, previous.end), staffCostPayoutJoinConditions()));
		const [prevExpenseCost] = await db
			.select({ total: projectExpenseTotalSumExpr() })
			.from(schema.expenses)
			.where(and(between(schema.expenses.date, previous.start, previous.end), isNull(schema.expenses.deletedAt)));

		const [revenueItems, supplierItems, staffItems, expenseItems] = await Promise.all([
			db
				.select({
					id: schema.revenue.id,
					date: schema.revenue.date,
					ref: sql<string>`coalesce(${schema.revenue.invoiceNumber}, ${schema.revenue.id})`,
					note: sql<string>`'completed'`,
					amount: revenueSgdAmountExpr()
				})
				.from(schema.revenue)
				.where(
					and(between(schema.revenue.date, current.start, current.end), isNull(schema.revenue.deletedAt))
				)
				.orderBy(desc(schema.revenue.date), desc(schema.revenue.createdAt)),
			db
				.select({
					id: schema.invoicesIn.id,
					date: schema.invoicesIn.invoiceDate,
					ref: schema.invoicesIn.poNumber,
					note: schema.invoicesIn.status,
					amount: schema.invoicesIn.amount
				})
				.from(schema.invoicesIn)
				.where(
					and(
						between(schema.invoicesIn.invoiceDate, current.start, current.end),
						isNull(schema.invoicesIn.deletedAt)
					)
				)
				.orderBy(desc(schema.invoicesIn.invoiceDate), desc(schema.invoicesIn.createdAt)),
			db
				.select({
					id: schema.payoutRecords.id,
					date: schema.payoutRecords.period,
					ref: schema.compensationComponents.incomeType,
					note: schema.payoutRecords.note,
					amount: schema.payoutRecords.computedAmount
				})
				.from(schema.payoutRecords)
				.innerJoin(
					schema.compensationComponents,
					eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
				)
				.where(and(staffCostPeriodBetween(current.start, current.end), staffCostPayoutJoinConditions()))
				.orderBy(desc(schema.payoutRecords.period), desc(schema.payoutRecords.createdAt)),
			db
				.select({
					id: schema.expenses.id,
					date: schema.expenses.date,
					ref: schema.expenses.category,
					note: schema.expenses.notes,
					amount: expenseSgdAmountExpr()
				})
				.from(schema.expenses)
				.where(and(between(schema.expenses.date, current.start, current.end), isNull(schema.expenses.deletedAt)))
				.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt))
		]);

		const revenue = income?.total ?? 0;
		const totalExpense = (supplierCost?.total ?? 0) + (staffCost?.total ?? 0) + (expenseCost?.total ?? 0);
		const prevRevenue = prevIncome?.total ?? 0;
		const prevExpense =
			(prevSupplierCost?.total ?? 0) + (prevStaffCost?.total ?? 0) + (prevExpenseCost?.total ?? 0);
		const prevNetProfit = prevRevenue - prevExpense;
		const netProfit = revenue - totalExpense;
		const normalizedRevenueItems = revenueItems.map((item) => ({
			...item,
			date: item.date ?? '',
			ref: item.ref ?? item.id,
			note: item.note ?? '',
			amount: Number(item.amount ?? 0)
		}));
		const normalizedExpenseItems = [
			...supplierItems.map((item) => ({
				...item,
				source: 'supplier_invoice',
				date: item.date ?? '',
				ref: item.ref ?? item.id,
				note: item.note ?? '',
				amount: Number(item.amount ?? 0)
			})),
			...staffItems.map((item) => ({
				...item,
				source: 'staff_cost',
				date: item.date ?? '',
				ref: item.ref ?? item.id,
				note: item.note ?? '',
				amount: Number(item.amount ?? 0)
			})),
			...expenseItems.map((item) => ({
				...item,
				source: 'expense',
				date: item.date ?? '',
				ref: item.ref ?? item.id,
				note: item.note ?? '',
				amount: Number(item.amount ?? 0)
			}))
		].sort((a, b) => b.date.localeCompare(a.date));

		return {
			revenue,
			expense: totalExpense,
			netProfit,
			pendingReceivable: 0,
			pendingPayable: 0,
			range: current,
			previousRange: previous,
			trend: {
				revenueDelta: revenue - prevRevenue,
				expenseDelta: totalExpense - prevExpense,
				netProfitDelta: netProfit - prevNetProfit
			},
			details: {
				revenueItems: normalizedRevenueItems,
				expenseItems: normalizedExpenseItems
			}
		};
	}

	async getDashboardCharts(input: DashboardChartsInput = {}) {
		const db = this.ctx.db;
		const projectStatus = input.projectStatus ?? '';
		const from = input.from ?? '';
		const to = input.to ?? '';

		const now = input.now ? new Date(input.now) : new Date();
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
			return {
				pie: { supplierCost: 0, staffCost: 0, expenseCost: 0 },
				quarterly: [],
				projectBars: []
			};
		}

		const baseRevenueRange = [isNull(schema.revenue.deletedAt), inArray(schema.revenue.projectId, projectIds)];
		const baseSupplierRange = [
			isNull(schema.invoicesIn.deletedAt),
			inArray(schema.invoicesIn.projectId, projectIds)
		];
		const baseStaffRange = [
			isNull(schema.payoutRecords.deletedAt),
			inArray(schema.payoutRecords.projectId, projectIds),
			staffCostPayoutJoinConditions()
		];
		const baseExpenseRange = [
			isNull(schema.expenses.deletedAt),
			inArray(schema.expenses.projectId, projectIds)
		];

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
				.where(and(...baseStaffRange, staffCostPeriodBetween(current.start, current.end))),
			db
				.select({ total: projectExpenseTotalSumExpr() })
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
					date: schema.revenue.date,
					projectId: schema.revenue.projectId,
					amount: revenueSgdAmountExpr()
				})
				.from(schema.revenue)
				.where(and(...baseRevenueRange, between(schema.revenue.date, quarterStart, quarterEnd))),
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
					amount: expenseSgdAmountExpr()
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
					projectId: schema.revenue.projectId,
					total: projectRevenueTotalSumExpr()
				})
				.from(schema.revenue)
				.where(and(...baseRevenueRange, between(schema.revenue.date, current.start, current.end)))
				.groupBy(schema.revenue.projectId),
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
					total: projectExpenseTotalSumExpr()
				})
				.from(schema.expenses)
				.where(and(...baseExpenseRange, between(schema.expenses.date, current.start, current.end)))
				.groupBy(schema.expenses.projectId)
		]);

		for (const row of rangeRevenueRows) {
			if (!row.projectId) continue;
			projectRevenue.set(row.projectId, Number(row.total ?? 0));
		}
		for (const row of rangeSupplierRows) {
			if (!row.projectId) continue;
			projectCost.set(row.projectId, (projectCost.get(row.projectId) ?? 0) + Number(row.total ?? 0));
		}
		for (const row of rangeStaffRows) {
			if (!row.projectId) continue;
			projectCost.set(row.projectId, (projectCost.get(row.projectId) ?? 0) + Number(row.total ?? 0));
		}
		for (const row of rangeExpenseRows) {
			if (!row.projectId) continue;
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

		return {
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
		};
	}

	async getProjectsProfitRanking(input: ProjectsProfitInput = {}) {
		const db = this.ctx.db;
		const projectId = input.projectId ?? '';
		const projectStatus = input.projectStatus ?? '';
		const from = input.from ?? '';
		const to = input.to ?? '';
		const hasRange = isIsoDate(from) && isIsoDate(to) && from <= to;
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
			return [];
		}

		const revenueConditions = [isNull(schema.revenue.deletedAt)];
		if (hasRange) revenueConditions.push(sql`${schema.revenue.date} between ${from} and ${to}`);
		const revenueRows = await db
			.select({
				projectId: schema.revenue.projectId,
				total: projectRevenueTotalSumExpr()
			})
			.from(schema.revenue)
			.where(and(...revenueConditions))
			.groupBy(schema.revenue.projectId);

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
				total: projectExpenseTotalSumExpr()
			})
			.from(schema.expenses)
			.where(and(...expenseConditions))
			.groupBy(schema.expenses.projectId);

		const revenueMap = new Map(revenueRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
		const purchaseMap = new Map(purchaseRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
		const staffMap = new Map(staffRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
		const expenseMap = new Map(expenseRows.map((row) => [row.projectId, Number(row.total ?? 0)]));

		return projects
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
	}

	async getProjectsProfitCsv(input: ProjectsProfitInput = {}) {
		const db = this.ctx.db;
		const projectId = input.projectId ?? '';
		const projectStatus = input.projectStatus ?? '';
		const from = input.from ?? '';
		const to = input.to ?? '';
		const hasRange = isIsoDate(from) && isIsoDate(to) && from <= to;
		const dateOutClause = hasRange ? sql` and io.date between ${from} and ${to}` : sql``;
		const dateInClause = hasRange ? sql` and ii.invoice_date between ${from} and ${to}` : sql``;
		const datePrClause = hasRange ? sql` and pr.period between ${from} and ${to}` : sql``;
		const dateExClause = hasRange ? sql` and ex.date between ${from} and ${to}` : sql``;

		const projectConditions = [isNull(schema.projects.deletedAt)];
		if (projectId) projectConditions.push(eq(schema.projects.id, projectId));
		if (projectStatus) projectConditions.push(eq(schema.projects.status, projectStatus));

		const rows = await db
			.select({
				projectId: schema.projects.id,
				projectName: schema.projects.name,
				projectStatus: schema.projects.status,
				revenue: sql<number>`coalesce((select sum(io.total) from invoices_out io where io.project_id = ${schema.projects.id} and io.deleted_at is null ${dateOutClause}), 0)`,
				purchaseCost: sql<number>`coalesce((select sum(ii.amount) from invoices_in ii where ii.project_id = ${schema.projects.id} and ii.deleted_at is null ${dateInClause}), 0)`,
				staffCost: sql<number>`coalesce((select sum(pr.computed_amount) from payout_records pr inner join compensation_components cc on cc.id = pr.component_id and cc.deleted_at is null where pr.project_id = ${schema.projects.id} and pr.deleted_at is null and pr.status in ('confirmed','paid') and cc.income_type != 'dividend' ${datePrClause}), 0)`,
				expenseCost: sql<number>`coalesce((select sum(ex.amount) from expenses ex where ex.project_id = ${schema.projects.id} and ex.deleted_at is null ${dateExClause}), 0)`
			})
			.from(schema.projects)
			.where(and(...projectConditions));

		const header = ['project_id', 'project_name', 'status', 'revenue', 'cost', 'profit', 'profit_margin'];
		const lines = rows.map((row) => {
			const revenue = Number(row.revenue ?? 0);
			const cost =
				Number(row.purchaseCost ?? 0) + Number(row.staffCost ?? 0) + Number(row.expenseCost ?? 0);
			const profit = revenue - cost;
			const margin = revenue > 0 ? profit / revenue : 0;
			return [
				csvEscape(row.projectId),
				csvEscape(row.projectName),
				csvEscape(row.projectStatus),
				csvEscape(revenue.toFixed(2)),
				csvEscape(cost.toFixed(2)),
				csvEscape(profit.toFixed(2)),
				csvEscape(margin.toFixed(6))
			].join(',');
		});

		return [header.join(','), ...lines].join('\n');
	}

	async getProjectDocumentsSummary(projectId: string) {
		const db = this.ctx.db;

		const documents = await db
			.select({
				id: schema.documents.id,
				fileName: schema.documents.fileName,
				fileType: schema.documents.fileType,
				fileKey: schema.documents.fileKey,
				docType: schema.documents.docType,
				purpose: schema.documents.purpose,
				ocrStatus: schema.documents.ocrStatus,
				ocrResult: schema.documents.ocrResult,
				notes: schema.documents.notes,
				createdAt: schema.documents.createdAt
			})
			.from(schema.documents)
			.where(
				and(
					eq(schema.documents.projectId, projectId),
					eq(schema.documents.purpose, 'reference'),
					isNull(schema.documents.deletedAt),
					or(
						isNull(schema.documents.entityId),
						not(inArray(schema.documents.entityType, ['contract', 'quotation', 'purchase_order']))
					)
				)
			)
			.orderBy(desc(schema.documents.createdAt));

		const contractRows = await db
			.select({
				id: schema.contracts.id,
				contractNumber: schema.contracts.contractNumber,
				fileUrl: schema.contracts.fileUrl,
				amount: schema.contracts.amount,
				currency: schema.contracts.currency,
				date: schema.contracts.effectiveDate,
				status: schema.contracts.status,
				metadata: schema.contracts.metadata,
				createdAt: schema.contracts.createdAt
			})
			.from(schema.contracts)
			.where(and(eq(schema.contracts.projectId, projectId), isNull(schema.contracts.deletedAt)))
			.orderBy(desc(schema.contracts.createdAt));

		const quotationRows = await db
			.select({
				id: schema.quotations.id,
				quotationNumber: schema.quotations.quotationNumber,
				fileUrl: schema.quotations.fileUrl,
				amount: schema.quotations.amount,
				currency: schema.quotations.currency,
				date: schema.quotations.date,
				status: schema.quotations.status,
				metadata: schema.quotations.metadata,
				createdAt: schema.quotations.createdAt
			})
			.from(schema.quotations)
			.where(and(eq(schema.quotations.projectId, projectId), isNull(schema.quotations.deletedAt)))
			.orderBy(desc(schema.quotations.createdAt));

		const purchaseOrderRows = await db
			.select({
				id: schema.purchaseOrders.id,
				poNumber: schema.purchaseOrders.poNumber,
				fileUrl: schema.purchaseOrders.fileUrl,
				supplierName: schema.purchaseOrders.supplierName,
				amount: schema.purchaseOrders.amount,
				currency: schema.purchaseOrders.currency,
				date: schema.purchaseOrders.date,
				status: schema.purchaseOrders.status,
				metadata: schema.purchaseOrders.metadata,
				createdAt: schema.purchaseOrders.createdAt
			})
			.from(schema.purchaseOrders)
			.where(and(eq(schema.purchaseOrders.projectId, projectId), isNull(schema.purchaseOrders.deletedAt)))
			.orderBy(desc(schema.purchaseOrders.createdAt));

		const expenseRows = await db
			.select({
				id: schema.expenses.id,
				category: schema.expenses.category,
				expenseType: schema.expenses.expenseType,
				docType: schema.expenses.docType,
				date: schema.expenses.date,
				amount: schema.expenses.amount,
				currency: schema.expenses.currency,
				documentRef: schema.expenses.documentRef,
				metadata: schema.expenses.metadata,
				createdAt: schema.expenses.createdAt
			})
			.from(schema.expenses)
			.where(and(eq(schema.expenses.projectId, projectId), isNull(schema.expenses.deletedAt)))
			.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt));

		const revenueRows = await db
			.select({
				id: schema.revenue.id,
				invoiceType: schema.revenue.invoiceType,
				invoiceNumber: schema.revenue.invoiceNumber,
				clientName: schema.revenue.clientName,
				date: schema.revenue.date,
				amount: schema.revenue.amount,
				currency: schema.revenue.currency,
				documentRef: schema.revenue.documentRef,
				notes: schema.revenue.notes,
				createdAt: schema.revenue.createdAt
			})
			.from(schema.revenue)
			.where(and(eq(schema.revenue.projectId, projectId), isNull(schema.revenue.deletedAt)))
			.orderBy(desc(schema.revenue.date), desc(schema.revenue.createdAt));

		const contracts = contractRows.map((contract) => ({
			...contract,
			displayNumber: friendlyDocNumber(contract.contractNumber, contract.id),
			displayFileName: referenceFileLabel(contract.fileUrl, contract.metadata)
		}));

		const quotations = quotationRows.map((quotation) => ({
			...quotation,
			displayNumber: friendlyDocNumber(quotation.quotationNumber, quotation.id),
			displayFileName: referenceFileLabel(quotation.fileUrl, quotation.metadata)
		}));

		const purchaseOrders = purchaseOrderRows.map((purchaseOrder) => ({
			...purchaseOrder,
			displayNumber: friendlyDocNumber(purchaseOrder.poNumber, purchaseOrder.id),
			displayFileName: referenceFileLabel(purchaseOrder.fileUrl, purchaseOrder.metadata)
		}));

		const expenseDocuments = expenseRows.map((expense) => {
			const metadata = parseDocumentMetadata(expense.metadata ?? null);
			const uploadName = metadata.upload?.fileName?.trim();
			const refName = referenceNameFromDocumentRef(expense.documentRef);
			return {
				...expense,
				displayNumber: friendlyDocNumber(null, expense.id),
				displayFileName: uploadName || refName || expense.category || 'Expense',
				statusLabel: expense.expenseType === 'sales_cost' ? 'Sales Cost' : 'OpEx'
			};
		});

		const revenueDocuments = revenueRows.map((revenue) => {
			const refName = referenceNameFromDocumentRef(revenue.documentRef);
			return {
				...revenue,
				displayNumber: friendlyDocNumber(revenue.invoiceNumber, revenue.id),
				displayFileName: refName || revenue.clientName || 'Revenue Invoice',
				statusLabel:
					revenue.invoiceType === 'zero_rate'
						? 'Zero Rate'
						: revenue.invoiceType === 'tax_invoice'
							? 'Tax Invoice'
							: 'Standard'
			};
		});

		return { documents, contracts, quotations, purchaseOrders, expenseDocuments, revenueDocuments };
	}

	async getProjectFinancialDetail(projectId: string) {
		const db = this.ctx.db;

		const [revenue] = await db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(schema.revenue)
			.where(and(eq(schema.revenue.projectId, projectId), isNull(schema.revenue.deletedAt)));
		const [purchaseCost] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
			.from(schema.invoicesIn)
			.where(and(eq(schema.invoicesIn.projectId, projectId), isNull(schema.invoicesIn.deletedAt)));
		const staffPayoutWhere = and(
			eq(schema.payoutRecords.projectId, projectId),
			staffCostPayoutJoinConditions()
		);
		const [staffCost] = await db
			.select({ total: staffCostSumExpr() })
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(staffPayoutWhere);
		const expenseWhere = and(eq(schema.expenses.projectId, projectId), isNull(schema.expenses.deletedAt));
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
				.where(and(eq(schema.revenue.projectId, projectId), isNull(schema.revenue.deletedAt)))
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
				.where(and(eq(schema.invoicesIn.projectId, projectId), isNull(schema.invoicesIn.deletedAt)))
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
				.where(and(eq(schema.expenses.projectId, projectId), isNull(schema.expenses.deletedAt)))
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
	}
}

/**
 * ProfitReportService generates profit reports.
 */
export class ProfitReportService {
	constructor(private ctx: ModuleContext) {}
	// Will be populated when route handlers are refactored
}

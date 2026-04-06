import { and, between, desc, eq, isNull, sql } from 'drizzle-orm';
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

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';

	const end = new Date();
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
		Math.max(1, Math.floor((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)) + 1) || 30;

	const prevStart = new Date(currentStart);
	prevStart.setUTCDate(prevStart.getUTCDate() - spanDays);
	const prevEnd = new Date(currentStart);
	prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

	const previous = {
		start: prevStart.toISOString().slice(0, 10),
		end: prevEnd.toISOString().slice(0, 10)
	};

	const [income] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(between(schema.invoicesOut.date, current.start, current.end), isNull(schema.invoicesOut.deletedAt))
		);
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
		.where(
			and(staffCostPeriodBetween(current.start, current.end), staffCostPayoutJoinConditions())
		);
	const [expenseCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
		.from(schema.expenses)
		.where(and(between(schema.expenses.date, current.start, current.end), isNull(schema.expenses.deletedAt)));

	const [prevIncome] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(
				between(schema.invoicesOut.date, previous.start, previous.end),
				isNull(schema.invoicesOut.deletedAt)
			)
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
		.where(
			and(staffCostPeriodBetween(previous.start, previous.end), staffCostPayoutJoinConditions())
		);
	const [prevExpenseCost] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
		.from(schema.expenses)
		.where(and(between(schema.expenses.date, previous.start, previous.end), isNull(schema.expenses.deletedAt)));

	const [revenueItems, supplierItems, staffItems, expenseItems] = await Promise.all([
		db
			.select({
				id: schema.invoicesOut.id,
				date: schema.invoicesOut.date,
				ref: schema.invoicesOut.invoiceNo,
				note: schema.invoicesOut.status,
				amount: schema.invoicesOut.total
			})
			.from(schema.invoicesOut)
			.where(
				and(between(schema.invoicesOut.date, current.start, current.end), isNull(schema.invoicesOut.deletedAt))
			)
			.orderBy(desc(schema.invoicesOut.date), desc(schema.invoicesOut.createdAt)),
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
			.where(
				and(staffCostPeriodBetween(current.start, current.end), staffCostPayoutJoinConditions())
			)
			.orderBy(desc(schema.payoutRecords.period), desc(schema.payoutRecords.createdAt)),
		db
			.select({
				id: schema.expenses.id,
				date: schema.expenses.date,
				ref: schema.expenses.category,
				note: schema.expenses.subcategory,
				amount: schema.expenses.amount
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

	return ok({
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
	});
};

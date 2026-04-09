import { and, between, eq, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';
import {
	staffCostPayoutJoinConditions,
	staffCostPeriodBetween,
	staffCostSumExpr
} from '$lib/server/project-staff-cost';

function calcCorporateTax(taxableIncome: number) {
	const firstBand = Math.min(taxableIncome, 10000) * 0.0425;
	const secondBand = Math.min(Math.max(taxableIncome - 10000, 0), 190000) * 0.085;
	const thirdBand = Math.max(taxableIncome - 200000, 0) * 0.17;
	return firstBand + secondBand + thirdBand;
}

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const year = Number.parseInt(params.year, 10);
	if (!Number.isFinite(year)) {
		return fail('Invalid year');
	}
	const start = `${year}-01-01`;
	const end = `${year}-12-31`;

	const db = getDb(platform.env);
	const [revenue] = await db.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)` }).from(
		schema.invoicesOut
	).where(and(between(schema.invoicesOut.date, start, end), isNull(schema.invoicesOut.deletedAt)));
	const [purchase] = await db.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` }).from(
		schema.invoicesIn
	).where(and(between(schema.invoicesIn.invoiceDate, start, end), isNull(schema.invoicesIn.deletedAt)));
	const [staff] = await db
		.select({ total: staffCostSumExpr() })
		.from(schema.payoutRecords)
		.innerJoin(
			schema.compensationComponents,
			eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
		)
		.where(
			and(staffCostPeriodBetween(start, end), staffCostPayoutJoinConditions())
		);
	const [expense] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
		.from(schema.expenses)
		.where(and(between(schema.expenses.date, start, end), isNull(schema.expenses.deletedAt)));

	const taxableIncome =
		(revenue?.total ?? 0) - (purchase?.total ?? 0) - (staff?.total ?? 0) - (expense?.total ?? 0);
	const taxPayable = calcCorporateTax(Math.max(taxableIncome, 0));

	return ok({
		year,
		range: { start, end },
		revenue: revenue?.total ?? 0,
		costBreakdown: {
			purchase: purchase?.total ?? 0,
			staff: staff?.total ?? 0,
			expense: expense?.total ?? 0
		},
		taxableIncome,
		taxPayable,
		effectiveRate: taxableIncome > 0 ? taxPayable / taxableIncome : 0,
		bands: {
			first10k: 0.0425,
			next190k: 0.085,
			above200k: 0.17
		}
	});
};

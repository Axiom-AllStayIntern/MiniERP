import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

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

	const db = getDb(platform.env);
	const [revenue] = await db.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)` }).from(
		schema.invoicesOut
	);
	const [purchase] = await db.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` }).from(
		schema.invoicesIn
	);
	const [staff] = await db.select({ total: sql<number>`coalesce(sum(${schema.projectCompensations.amount}), 0)` }).from(
		schema.projectCompensations
	);
	const [expense] = await db.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` }).from(
		schema.expenses
	);

	const taxableIncome =
		(revenue?.total ?? 0) - (purchase?.total ?? 0) - (staff?.total ?? 0) - (expense?.total ?? 0);
	const taxPayable = calcCorporateTax(Math.max(taxableIncome, 0));

	return ok({
		year,
		taxableIncome,
		taxPayable,
		bands: {
			first10k: 0.0425,
			next190k: 0.085,
			above200k: 0.17
		}
	});
};

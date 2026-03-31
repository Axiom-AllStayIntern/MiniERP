import { and, between, eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

function getQuarterRange(year: string, quarter: string) {
	const y = Number.parseInt(year, 10);
	const q = Number.parseInt(quarter, 10);
	if (!Number.isFinite(y) || ![1, 2, 3, 4].includes(q)) {
		return null;
	}
	const startMonth = (q - 1) * 3 + 1;
	const start = new Date(Date.UTC(y, startMonth - 1, 1));
	const end = new Date(Date.UTC(y, startMonth + 2, 0));
	return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const range = getQuarterRange(params.year, params.quarter);
	if (!range) {
		return fail('Invalid year or quarter');
	}

	const boxNo = Number.parseInt(params.n, 10);
	const db = getDb(platform.env);

	if ([1, 2, 3, 6].includes(boxNo)) {
		const gstType = boxNo === 1 ? 'standard' : boxNo === 2 ? 'zero' : 'exempt';
		const invoices = await db
			.select({
				id: schema.invoicesOut.id,
				invoiceNo: schema.invoicesOut.invoiceNo,
				date: schema.invoicesOut.date,
				amount: schema.invoicesOut.subtotal,
				gstAmount: schema.invoicesOut.gstAmount
			})
			.from(schema.invoicesOut)
			.where(
				and(
					eq(schema.invoicesOut.gstType, gstType as 'standard' | 'zero' | 'exempt'),
					between(schema.invoicesOut.date, range.start, range.end)
				)
			);
		return ok({ box: boxNo, invoices });
	}

	if (boxNo === 7) {
		const invoices = await db
			.select({
				id: schema.invoicesIn.id,
				invoiceDate: schema.invoicesIn.invoiceDate,
				supplierName: schema.invoicesIn.supplierName,
				gstAmount: schema.invoicesIn.gstAmount
			})
			.from(schema.invoicesIn)
			.where(between(schema.invoicesIn.invoiceDate, range.start, range.end));
		return ok({ box: boxNo, invoices });
	}

	if (boxNo === 8) {
		const [box6] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.gstAmount}), 0)` })
			.from(schema.invoicesOut)
			.where(between(schema.invoicesOut.date, range.start, range.end));
		const [box7] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.gstAmount}), 0)` })
			.from(schema.invoicesIn)
			.where(between(schema.invoicesIn.invoiceDate, range.start, range.end));
		return ok({
			box: 8,
			breakdown: {
				box6: box6?.total ?? 0,
				box7: box7?.total ?? 0,
				net: (box6?.total ?? 0) - (box7?.total ?? 0)
			}
		});
	}

	return ok({ box: boxNo, invoices: [] });
};

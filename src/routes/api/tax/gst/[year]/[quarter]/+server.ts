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

	return {
		start: start.toISOString().slice(0, 10),
		end: end.toISOString().slice(0, 10)
	};
}

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const range = getQuarterRange(params.year, params.quarter);
	if (!range) {
		return fail('Invalid year or quarter');
	}

	const db = getDb(platform.env);
	const [box1] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(
				eq(schema.invoicesOut.gstType, 'standard'),
				between(schema.invoicesOut.date, range.start, range.end)
			)
		);
	const [box2] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(eq(schema.invoicesOut.gstType, 'zero'), between(schema.invoicesOut.date, range.start, range.end))
		);
	const [box3] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(eq(schema.invoicesOut.gstType, 'exempt'), between(schema.invoicesOut.date, range.start, range.end))
		);
	const [box7] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.gstAmount}), 0)` })
		.from(schema.invoicesIn)
		.where(between(schema.invoicesIn.invoiceDate, range.start, range.end));

	const b1 = box1?.total ?? 0;
	const b2 = box2?.total ?? 0;
	const b3 = box3?.total ?? 0;
	const b4 = b1 + b2 + b3;
	const b6 = b1 * 0.09;
	const b7 = box7?.total ?? 0;

	return ok({
		year: params.year,
		quarter: params.quarter,
		range,
		boxes: {
			box1: b1,
			box2: b2,
			box3: b3,
			box4: b4,
			box5: 0,
			box6: b6,
			box7: b7,
			box8: b6 - b7,
			box9: 0,
			box10: 0,
			box11: 0,
			box12: 0,
			box13: 0
		}
	});
};

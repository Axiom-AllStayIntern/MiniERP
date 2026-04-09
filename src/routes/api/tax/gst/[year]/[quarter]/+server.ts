import { and, between, eq, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
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
				between(schema.invoicesOut.date, range.start, range.end),
				isNull(schema.invoicesOut.deletedAt)
			)
		);
	const [box2] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(
				eq(schema.invoicesOut.gstType, 'zero'),
				between(schema.invoicesOut.date, range.start, range.end),
				isNull(schema.invoicesOut.deletedAt)
			)
		);
	const [box3] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(
				eq(schema.invoicesOut.gstType, 'exempt'),
				between(schema.invoicesOut.date, range.start, range.end),
				isNull(schema.invoicesOut.deletedAt)
			)
		);
	const [purchases] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
		.from(schema.invoicesIn)
		.where(
			and(between(schema.invoicesIn.invoiceDate, range.start, range.end), isNull(schema.invoicesIn.deletedAt))
		);
	const [expenses] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
		.from(schema.expenses)
		.where(and(between(schema.expenses.date, range.start, range.end), isNull(schema.expenses.deletedAt)));
	/** Output tax (IRAS Box 6): GST on standard-rated sales only; zero/exempt should carry 0 output tax. */
	const [box6] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.gstAmount}), 0)` })
		.from(schema.invoicesOut)
		.where(
			and(
				eq(schema.invoicesOut.gstType, 'standard'),
				between(schema.invoicesOut.date, range.start, range.end),
				isNull(schema.invoicesOut.deletedAt)
			)
		);
	const [box7] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.gstAmount}), 0)` })
		.from(schema.invoicesIn)
		.where(
			and(between(schema.invoicesIn.invoiceDate, range.start, range.end), isNull(schema.invoicesIn.deletedAt))
		);
	const [box13] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.total}), 0)` })
		.from(schema.invoicesOut)
		.where(and(between(schema.invoicesOut.date, range.start, range.end), isNull(schema.invoicesOut.deletedAt)));

	const manualRows = await db
		.select({ key: schema.companySettings.key, value: schema.companySettings.value })
		.from(schema.companySettings)
		.where(
			and(
				isNull(schema.companySettings.deletedAt),
				sql`${schema.companySettings.key} in ('gst_box9_manual','gst_box10_manual','gst_box11_manual','gst_box12_manual')`
			)
		);
	const manualMap = new Map(manualRows.map((item) => [item.key, Number.parseFloat(item.value)]));

	const b1 = box1?.total ?? 0;
	const b2 = box2?.total ?? 0;
	const b3 = box3?.total ?? 0;
	const b4 = b1 + b2 + b3;
	const b5 = (purchases?.total ?? 0) + (expenses?.total ?? 0);
	const b6 = box6?.total ?? 0;
	const b7 = box7?.total ?? 0;
	const b9 = Number.isFinite(manualMap.get('gst_box9_manual')) ? (manualMap.get('gst_box9_manual') ?? 0) : 0;
	const b10 = Number.isFinite(manualMap.get('gst_box10_manual'))
		? (manualMap.get('gst_box10_manual') ?? 0)
		: 0;
	const b11 = Number.isFinite(manualMap.get('gst_box11_manual'))
		? (manualMap.get('gst_box11_manual') ?? 0)
		: 0;
	const b12 = Number.isFinite(manualMap.get('gst_box12_manual'))
		? (manualMap.get('gst_box12_manual') ?? 0)
		: 0;
	const b13 = box13?.total ?? 0;

	return ok({
		year: params.year,
		quarter: params.quarter,
		range,
		boxes: {
			box1: b1,
			box2: b2,
			box3: b3,
			box4: b4,
			box5: b5,
			box6: b6,
			box7: b7,
			box8: b6 - b7,
			box9: b9,
			box10: b10,
			box11: b11,
			box12: b12,
			box13: b13
		},
		meta: {
			manualBoxes: ['box9', 'box10', 'box11', 'box12'],
			notes: [
				'Box 1–3: value of supplies (subtotal excl. GST) from customer invoices by gst_type.',
				'Box 4: sum of boxes 1–3',
				'Box 5: supplier invoice amounts (invoices_in.amount) plus expenses (expenses.amount). Expenses rows usually lack a split-out GST field — see Box 7 note.',
				'Box 6: output GST from standard-rated sales only (invoices_out.gst_amount where gst_type = standard).',
				'Box 7: input GST from supplier tax invoices only (invoices_in.gst_amount). Expense records do not currently store GST; their tax is not in Box 7 until modeled.',
				'Box 8 = Box 6 − Box 7 (simplified). IRAS net payable can also involve Boxes 9–12 — maintain manually where applicable.',
				'Box 9–12: company_settings keys gst_box9_manual … gst_box12_manual.',
				'Box 13: sum of invoices_out.total (typically subtotal + GST) for the quarter — not the same as Box 4.'
			]
		}
	});
};

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

	if ([1, 2, 3].includes(boxNo)) {
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
					between(schema.invoicesOut.date, range.start, range.end),
					isNull(schema.invoicesOut.deletedAt)
				)
			);
		return ok({ box: boxNo, invoices });
	}

	if (boxNo === 6) {
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
					eq(schema.invoicesOut.gstType, 'standard'),
					between(schema.invoicesOut.date, range.start, range.end),
					isNull(schema.invoicesOut.deletedAt)
				)
			);
		return ok({ box: boxNo, invoices });
	}

	if (boxNo === 5) {
		const purchases = await db
			.select({
				id: schema.invoicesIn.id,
				date: schema.invoicesIn.invoiceDate,
				counterparty: schema.invoicesIn.supplierName,
				amount: schema.invoicesIn.amount,
				type: sql<string>`'supplier_invoice'`
			})
			.from(schema.invoicesIn)
			.where(
				and(between(schema.invoicesIn.invoiceDate, range.start, range.end), isNull(schema.invoicesIn.deletedAt))
			);
		const expenses = await db
			.select({
				id: schema.expenses.id,
				date: schema.expenses.date,
				counterparty: sql<string>`coalesce(${schema.expenses.category}, ${schema.expenses.staffName}, 'Expense')`,
				amount: schema.expenses.amount,
				type: sql<string>`'expense'`
			})
			.from(schema.expenses)
			.where(and(between(schema.expenses.date, range.start, range.end), isNull(schema.expenses.deletedAt)));

		return ok({ box: boxNo, records: [...purchases, ...expenses] });
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
			.where(
				and(between(schema.invoicesIn.invoiceDate, range.start, range.end), isNull(schema.invoicesIn.deletedAt))
			);
		return ok({ box: boxNo, invoices });
	}

	if (boxNo === 8) {
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
		return ok({
			box: 8,
			breakdown: {
				box6: box6?.total ?? 0,
				box7: box7?.total ?? 0,
				net: (box6?.total ?? 0) - (box7?.total ?? 0)
			}
		});
	}

	if ([9, 10, 11, 12].includes(boxNo)) {
		const key = `gst_box${boxNo}_manual`;
		const [setting] = await db
			.select({ value: schema.companySettings.value })
			.from(schema.companySettings)
			.where(and(eq(schema.companySettings.key, key), isNull(schema.companySettings.deletedAt)))
			.limit(1);
		return ok({
			box: boxNo,
			manualValue: setting ? Number.parseFloat(setting.value) : 0,
			source: 'company_settings',
			key
		});
	}

	if (boxNo === 4) {
		const invoices = await db
			.select({
				id: schema.invoicesOut.id,
				invoiceNo: schema.invoicesOut.invoiceNo,
				date: schema.invoicesOut.date,
				amount: schema.invoicesOut.subtotal,
				gstType: schema.invoicesOut.gstType,
				gstAmount: schema.invoicesOut.gstAmount
			})
			.from(schema.invoicesOut)
			.where(and(between(schema.invoicesOut.date, range.start, range.end), isNull(schema.invoicesOut.deletedAt)));
		return ok({
			box: boxNo,
			invoices,
			note: 'Box 4 equals Box 1 + 2 + 3 (supply values excl. GST). One row per invoice for reconciliation.'
		});
	}

	if (boxNo === 13) {
		const invoices = await db
			.select({
				id: schema.invoicesOut.id,
				invoiceNo: schema.invoicesOut.invoiceNo,
				date: schema.invoicesOut.date,
				amount: schema.invoicesOut.total,
				gstAmount: schema.invoicesOut.gstAmount
			})
			.from(schema.invoicesOut)
			.where(and(between(schema.invoicesOut.date, range.start, range.end), isNull(schema.invoicesOut.deletedAt)));
		return ok({ box: boxNo, invoices });
	}

	return ok({ box: boxNo, invoices: [] });
};

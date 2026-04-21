import { desc, isNull, eq, and } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';
import { projectRevenueTotalSumExpr } from '$lib/server/modules/expense/repository';

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	const { project } = await parent();

	if (!platform) {
		return {
			revenueRecords: [],
			invoices: [],
			totals: { total: 0, revenue: 0, invoiced: 0 },
			project
		};
	}

	const db = getDb(platform.env);
	const projectId = params.id;

	// Revenue records from new standalone table
	const revenueRecords = await db
		.select({
			id: schema.revenue.id,
			invoiceType: schema.revenue.invoiceType,
			invoiceNumber: schema.revenue.invoiceNumber,
			clientName: schema.revenue.clientName,
			date: schema.revenue.date,
			amount: schema.revenue.amount,
			currency: schema.revenue.currency,
			sgdEquivalent: schema.revenue.sgdEquivalent,
			gstAmount: schema.revenue.gstAmount,
			notes: schema.revenue.notes,
			createdAt: schema.revenue.createdAt
		})
		.from(schema.revenue)
		.where(and(eq(schema.revenue.projectId, projectId), isNull(schema.revenue.deletedAt)))
		.orderBy(desc(schema.revenue.date), desc(schema.revenue.createdAt));

	// Also load existing invoices_out for backward compatibility
	let invoices: Array<{
		id: string;
		invoiceNo: string;
		date: string | null;
		dueDate: string | null;
		currency: string;
		subtotal: number | null;
		gstType: string | null;
		gstAmount: number | null;
		total: number | null;
		status: string | null;
	}> = [];
	try {
		invoices = await db
			.select({
				id: schema.invoicesOut.id,
				invoiceNo: schema.invoicesOut.invoiceNo,
				date: schema.invoicesOut.date,
				dueDate: schema.invoicesOut.dueDate,
				currency: schema.invoicesOut.currency,
				subtotal: schema.invoicesOut.subtotal,
				gstType: schema.invoicesOut.gstType,
				gstAmount: schema.invoicesOut.gstAmount,
				total: schema.invoicesOut.total,
				status: schema.invoicesOut.status
			})
			.from(schema.invoicesOut)
			.where(and(eq(schema.invoicesOut.projectId, projectId), isNull(schema.invoicesOut.deletedAt)))
			.orderBy(desc(schema.invoicesOut.date));
	} catch {
		invoices = [];
	}

	const [sumRow] = await db
		.select({ total: projectRevenueTotalSumExpr() })
		.from(schema.revenue)
		.where(and(eq(schema.revenue.projectId, projectId), isNull(schema.revenue.deletedAt)));
	const revenueTotal = sumRow?.total ?? 0;

	return {
		revenueRecords,
		invoices,
		totals: {
			// `invoices_out` is a view of `revenue` — do not double-count; all figures are SGD-equivalent.
			total: revenueTotal,
			revenue: revenueTotal,
			invoiced: revenueTotal
		},
		project
	};
};

export const actions: Actions = {
	createRevenue: async ({ request, platform, params }) => {
		if (!platform) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const db = getDb(platform.env);
		const now = new Date().toISOString();

		const id = crypto.randomUUID();
		const invoiceType = (formData.get('invoiceType') as string) || 'standard';
		const invoiceNumber = String(formData.get('invoiceNumber') || '') || null;
		const clientName = String(formData.get('clientName') || '') || null;
		const date = String(formData.get('date') || now.slice(0, 10));
		const amount = Number(formData.get('amount') || 0);
		const currency = String(formData.get('currency') || 'SGD').trim().toUpperCase();
		const gstAmount = Number(formData.get('gstAmount') || 0);
		const notes = String(formData.get('notes') || '') || null;

		const sgdEq = await resolveSgdEquivalentForWrite({ amount, currency, dateYmd: date });
		await db.insert(schema.revenue).values({
			id,
			invoiceType: invoiceType as 'standard' | 'zero_rate' | 'tax_invoice',
			invoiceNumber,
			clientName,
			projectId: params.id,
			date,
			amount,
			currency,
			sgdEquivalent: sgdEq,
			gstAmount,
			notes,
			createdAt: now,
			updatedAt: now
		});

		return { success: true };
	}
};

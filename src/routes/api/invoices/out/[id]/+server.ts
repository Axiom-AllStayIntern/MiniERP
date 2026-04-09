import { and, eq, isNull, ne } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';

type InvoicePayload = {
	projectId?: string;
	customerId?: string;
	date?: string;
	dueDate?: string;
	currency?: string;
	gstType?: 'standard' | 'zero' | 'exempt';
	lineItems?: Array<{ desc: string; qty: number; price: number } & Record<string, unknown>>;
	invoiceNo?: string;
	generatorMeta?: Record<string, unknown>;
};

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const body = (await request.json()) as InvoicePayload;
	if (!body.projectId || !body.customerId || !body.date) {
		return fail('Missing required fields: projectId, customerId, date');
	}

	const db = getDb(platform.env);
	const [existing] = await db
		.select({ id: schema.invoicesOut.id })
		.from(schema.invoicesOut)
		.where(and(eq(schema.invoicesOut.id, params.id), isNull(schema.invoicesOut.deletedAt)))
		.limit(1);
	if (!existing) return fail('Invoice not found', 404);

	const desiredNo = typeof body.invoiceNo === 'string' ? body.invoiceNo.trim() : '';
	if (desiredNo) {
		const [collision] = await db
			.select({ id: schema.invoicesOut.id })
			.from(schema.invoicesOut)
			.where(
				and(
					eq(schema.invoicesOut.invoiceNo, desiredNo),
					isNull(schema.invoicesOut.deletedAt),
					ne(schema.invoicesOut.id, params.id)
				)
			)
			.limit(1);
		if (collision) return fail('This invoice number is already in use.', 409);
	}

	const lineItems = body.lineItems ?? [];
	const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
	const gstRate = body.gstType === 'standard' || !body.gstType ? 0.09 : 0;
	const gstAmount = subtotal * gstRate;
	const total = subtotal + gstAmount;

	const storedLineItems =
		body.generatorMeta && typeof body.generatorMeta === 'object'
			? JSON.stringify({ version: 2, lines: lineItems, generator: body.generatorMeta })
			: JSON.stringify(lineItems);

	await db
		.update(schema.invoicesOut)
		.set({
			projectId: body.projectId,
			customerId: body.customerId,
			invoiceNo: desiredNo || undefined,
			date: body.date,
			dueDate: body.dueDate,
			currency: body.currency ?? 'SGD',
			gstType: body.gstType ?? 'standard',
			subtotal,
			gstAmount,
			total,
			lineItems: storedLineItems,
			updatedAt: new Date().toISOString()
		})
		.where(eq(schema.invoicesOut.id, params.id));

	return ok({ id: params.id, invoiceNo: desiredNo || null });
};


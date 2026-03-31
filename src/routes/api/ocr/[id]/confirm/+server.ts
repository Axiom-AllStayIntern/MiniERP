import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const payload = (await request.json()) as {
		supplierName?: string;
		invoiceDate?: string;
		amount?: number;
		currency?: string;
		gstAmount?: number;
		dueDate?: string;
		poNumber?: string;
	};

	const db = getDb(platform.env);
	await db
		.update(schema.invoicesIn)
		.set({
			supplierName: payload.supplierName,
			invoiceDate: payload.invoiceDate,
			amount: payload.amount,
			currency: payload.currency,
			gstAmount: payload.gstAmount,
			dueDate: payload.dueDate,
			poNumber: payload.poNumber,
			status: 'confirmed',
			updatedAt: new Date().toISOString()
		})
		.where(eq(schema.invoicesIn.id, params.id));

	return ok({ id: params.id, status: 'confirmed' });
};

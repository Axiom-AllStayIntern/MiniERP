import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const [invoice] = await db
		.select()
		.from(schema.invoicesOut)
		.where(eq(schema.invoicesOut.id, params.id))
		.limit(1);
	if (!invoice) {
		return fail('Invoice not found', 404);
	}

	const payload = JSON.stringify({
		invoiceNo: invoice.invoiceNo,
		total: invoice.total,
		currency: invoice.currency,
		generatedAt: new Date().toISOString()
	});
	const key = `invoices/out/${invoice.id}.json`;
	await platform.env.R2.put(key, payload, {
		httpMetadata: { contentType: 'application/json' }
	});

	await db
		.update(schema.invoicesOut)
		.set({ pdfUrl: key, status: 'issued', updatedAt: new Date().toISOString() })
		.where(eq(schema.invoicesOut.id, invoice.id));

	return ok({ id: invoice.id, pdfUrl: key });
};

import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';
import { parseStoredInvoiceLineItems } from '$lib/invoice-line-items';

export const GET: RequestHandler = async ({ params, platform }) => {
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

	const parsed = parseStoredInvoiceLineItems(invoice.lineItems);

	return ok({
		id: invoice.id,
		invoiceNo: invoice.invoiceNo,
		date: invoice.date,
		dueDate: invoice.dueDate,
		currency: invoice.currency,
		gstType: invoice.gstType,
		subtotal: invoice.subtotal,
		gstAmount: invoice.gstAmount,
		total: invoice.total,
		lineItems: parsed.lines,
		generatorMeta: parsed.generator ?? null
	});
};

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

	const [contract] = await db
		.select()
		.from(schema.contracts)
		.where(eq(schema.contracts.projectId, invoice.projectId))
		.limit(1);
	if (!contract) {
		return ok({ imported: 0, lineItems: [] });
	}

	const lineItems = [
		{
			desc: 'Imported from contract',
			qty: 1,
			price: contract.amount ?? 0
		}
	];
	const subtotal = lineItems.reduce((sum, line) => sum + line.qty * line.price, 0);
	const gstAmount = invoice.gstType === 'standard' ? subtotal * 0.09 : 0;
	await db
		.update(schema.invoicesOut)
		.set({
			lineItems: JSON.stringify(lineItems),
			subtotal,
			gstAmount,
			total: subtotal + gstAmount,
			updatedAt: new Date().toISOString()
		})
		.where(eq(schema.invoicesOut.id, invoice.id));

	return ok({ imported: lineItems.length, lineItems });
};

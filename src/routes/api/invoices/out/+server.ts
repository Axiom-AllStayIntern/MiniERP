import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';
import { ConflictError } from '$lib/server/modules/errors';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { billing } = createFinanceApi(ctx);

		const body = (await event.request.json()) as {
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

		if (!body.projectId || !body.customerId || !body.date) {
			return fail('Missing required fields: projectId, customerId, date');
		}

		const lineItems = body.lineItems ?? [];
		const subtotal = lineItems.reduce(
			(sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0),
			0
		);

		let invoiceNo = typeof body.invoiceNo === 'string' ? body.invoiceNo.trim() : '';
		if (!invoiceNo) {
			invoiceNo = `INV-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}`;
		}

		const storedLineItems =
			body.generatorMeta && typeof body.generatorMeta === 'object'
				? JSON.stringify({ version: 2, lines: lineItems, generator: body.generatorMeta })
				: JSON.stringify(lineItems);

		const result = await billing.createCustomerInvoice({
			projectId: body.projectId,
			customerId: body.customerId,
			invoiceNo,
			date: body.date,
			dueDate: body.dueDate,
			currency: body.currency,
			subtotal,
			gstType: body.gstType,
			lineItems: storedLineItems
		});

		return ok({ id: result.id, invoiceNo }, 201);
	} catch (e) {
		if (e instanceof ConflictError) {
			return fail(e.message, 409);
		}
		return fail((e as Error).message, 500);
	}
};


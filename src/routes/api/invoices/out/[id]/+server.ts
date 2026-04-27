import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '../../../../../modules/finance';
import { ConflictError, NotFoundError } from '$lib/server/modules/errors';
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

export const PUT: RequestHandler = async (event) => {
	try {
		const { params, request } = event;
		const ctx = await createModuleContext(event);
		const { billing } = createFinanceApi(ctx);
		const body = (await request.json()) as InvoicePayload;
		if (!body.projectId || !body.customerId || !body.date) {
			return fail('Missing required fields: projectId, customerId, date');
		}

		return ok(await billing.updateCustomerInvoiceDraft(params.id, body));
	} catch (e) {
		if (e instanceof NotFoundError) return fail(e.message, 404);
		if (e instanceof ConflictError) return fail(e.message, 409);
		return fail((e as Error).message, 500);
	}
};


import type { RequestEvent } from '@sveltejs/kit';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '$modules/finance';
import { fail, ok } from '$platform/http';

export const POST = async (event: RequestEvent) => {
	const { platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const ctx = await createModuleContext(event);
	const { einvoice } = createFinanceApi(ctx);

	const body = (await event.request.json()) as {
		revenueId?: string;
		dueDate?: string;
		paymentTerms?: string;
	};

	if (!body.revenueId || typeof body.revenueId !== 'string') {
		return fail('revenueId is required');
	}

	const result = await einvoice.generateEInvoice({
		revenueId: body.revenueId,
		dueDate: body.dueDate || null,
		paymentTerms: body.paymentTerms || null
	});

	if (!result) {
		return fail('Revenue record not found', 404);
	}

	return ok(result);
};

import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '../../../../../../modules/finance';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await requestJsonSafe(event.request)) as { key?: string };
		const uploadedKey = typeof body?.key === 'string' ? body.key.trim() : '';
		const ctx = await createModuleContext(event);
		const { billing } = createFinanceApi(ctx);
		const result = await billing.issueCustomerInvoicePdf(event.params.id, uploadedKey);

		if (result.status === 'invoice-not-found') {
			return fail('Invoice not found', 404);
		}
		if (result.status === 'uploaded-pdf-not-found') {
			return fail('Uploaded PDF not found in storage', 404);
		}

		return ok({ id: result.id, pdfUrl: result.pdfUrl });
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

async function requestJsonSafe(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createDocumentIntakeApi } from '../../../../../modules/document-intake';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	const { params, request, platform } = event;
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

	const ctx = await createModuleContext(event);
	const intake = createDocumentIntakeApi(ctx);
	const result = await intake.confirmSupplierInvoiceOcr(params.id, payload);

	return ok(result);
};

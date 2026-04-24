import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createDocumentIntakeApi } from '../../../../../modules/document-intake';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	const { params, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const ctx = await createModuleContext(event);
	const intake = createDocumentIntakeApi(ctx);
	const status = await intake.getSupplierInvoiceOcrStatus(params.id);

	if (!status) {
		return fail('OCR entity not found', 404);
	}

	return ok(status);
};

import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createDocumentIntakeApi } from '../../../../../modules/document-intake';
import { fail, ok } from '$lib/server/http';

/**
 * GET /api/documents/[id]/status
 *
 * Poll the OCR status of a document.
 * Returns the current status and OCR result if completed.
 */
export const GET: RequestHandler = async (event) => {
	const { params, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const { id } = params;
	if (!id) {
		return fail('Document ID is required');
	}

	const ctx = await createModuleContext(event);
	const intake = createDocumentIntakeApi(ctx);
	const status = await intake.getDocumentStatus(id);

	if (!status) {
		return fail('Document not found', 404);
	}

	return ok(status);
};

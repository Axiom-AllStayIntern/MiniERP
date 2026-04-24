import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createDocumentIntakeApi } from '../../../../modules/document-intake';
import { fail, ok } from '$lib/server/http';

/**
 * POST /api/documents/upload
 *
 * Creates a document record for reference documents (no financial impact).
 * Optionally runs OCR for metadata extraction.
 */
export const POST: RequestHandler = async (event) => {
	const { request, platform, locals } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		key?: string;
		fileName?: string;
		fileType?: string;
		projectId?: string;
		docType?: 'contract' | 'po' | 'bom' | 'quotation' | 'other';
		notes?: string;
		triggerOcr?: boolean;
	};

	if (!body.key || !body.fileName || !body.fileType || !body.projectId || !body.docType) {
		return fail('Missing required fields: key, fileName, fileType, projectId, docType');
	}

	const validDocTypes = ['contract', 'po', 'bom', 'quotation', 'other'];
	if (!validDocTypes.includes(body.docType)) {
		return fail(`Invalid docType. Must be one of: ${validDocTypes.join(', ')}`);
	}

	const ctx = await createModuleContext(event);
	const intake = createDocumentIntakeApi(ctx);
	const result = await intake.uploadReferenceDocument({
		key: body.key,
		fileName: body.fileName,
		fileType: body.fileType,
		projectId: body.projectId,
		docType: body.docType,
		notes: body.notes || null,
		triggerOcr: body.triggerOcr,
		uploadedBy: locals.user?.id || 'system'
	});

	if (!result.ok) {
		return fail(result.message, result.status);
	}

	return ok(
		{
			documentId: result.documentId,
			status: result.status,
			message: result.message
		},
		201
	);
};

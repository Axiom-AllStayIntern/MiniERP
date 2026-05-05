import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createDocumentIntakeApi } from '../../../../modules/document-intake';
import { fail, ok } from '$platform/http';

type UploadPayload = {
	key?: string;
	fileName?: string;
	fileType?: string;
	projectId?: string | null;
	docType?: 'contract' | 'quotation' | 'purchase_order';
	status?: string | null;
	notes?: string | null;
	extracted?: Record<string, unknown> | null;
};

export const POST: RequestHandler = async (event) => {
	const { request, platform, locals } = event;
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const body = (await request.json()) as UploadPayload;
	const ctx = await createModuleContext(event);
	const intake = createDocumentIntakeApi(ctx);
	const result = await intake.saveDocHubUpload({
		...body,
		uploadedBy: locals.user?.id || 'system'
	});

	if (!result.ok) {
		return fail(result.message, result.status);
	}

	return ok(
		{
			entityType: result.entityType,
			entityId: result.entityId,
			documentId: result.documentId
		},
		201
	);
};


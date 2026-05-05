import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createDocumentIntakeApi } from '../../../../modules/document-intake';
import { fail, ok } from '$platform/http';
import type { OcrQueueMessage } from '$platform/ai/ocr/types';

export const POST: RequestHandler = async (event) => {
	const { request, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		key?: string;
		fileType?: string;
		projectId?: string;
		entityType?: OcrQueueMessage['entityType'];
		entityId?: string;
		triggerOcr?: boolean;
		skipObjectCheck?: boolean;
	};

	if (!body.key || !body.fileType || !body.projectId || !body.entityType) {
		return fail('Missing required fields: key, fileType, projectId, entityType');
	}

	const ctx = await createModuleContext(event);
	const intake = createDocumentIntakeApi(ctx);
	const result = await intake.confirmUploadedObject({
		key: body.key,
		fileType: body.fileType,
		projectId: body.projectId,
		entityType: body.entityType,
		entityId: body.entityId,
		triggerOcr: body.triggerOcr,
		skipObjectCheck: body.skipObjectCheck
	});

	if (!result.ok) {
		return fail(result.message, result.status);
	}

	return ok({ entityId: result.entityId, status: result.status }, 201);
};


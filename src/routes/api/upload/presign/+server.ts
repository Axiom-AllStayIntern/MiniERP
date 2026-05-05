import type { RequestHandler } from './$types';

import { createUploadTarget } from '$infrastructure/storage/r2';
import { fail, ok } from '$platform/http';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		fileName?: string;
		contentType?: string;
		projectId?: string;
		entityType?: string;
		entityId?: string;
	};

	if (!body.fileName || !body.contentType || !body.projectId || !body.entityType || !body.entityId) {
		return fail('Missing required fields: fileName, contentType, projectId, entityType, entityId');
	}

	const target = await createUploadTarget(platform.env, {
		projectId: body.projectId,
		fileName: body.fileName,
		contentType: body.contentType,
		entityType: body.entityType,
		entityId: body.entityId
	});

	return ok(target, 201);
};


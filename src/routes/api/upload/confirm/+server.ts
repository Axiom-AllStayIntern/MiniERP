import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';
import type { OcrQueueMessage } from '$lib/server/ocr/types';
import { objectExists } from '$lib/server/r2';

export const POST: RequestHandler = async ({ request, platform }) => {
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

	const exists = body.skipObjectCheck ? true : await objectExists(platform.env, body.key);
	if (!exists) {
		return fail('Uploaded object was not found in R2', 404);
	}

	const db = getDb(platform.env);
	const entityId = body.entityId ?? crypto.randomUUID();

	if (body.entityType === 'invoice_in') {
		await db.insert(schema.invoicesIn).values({
			id: entityId,
			projectId: body.projectId,
			fileUrl: body.key,
			status: 'processing',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
	}

	const shouldQueue = body.triggerOcr ?? body.entityType === 'invoice_in';
	if (shouldQueue) {
		const message: OcrQueueMessage = {
			id: crypto.randomUUID(),
			fileKey: body.key,
			fileType: body.fileType,
			entityType: body.entityType,
			entityId,
			projectId: body.projectId
		};
		await platform.env.OCR_QUEUE.send(message);
	}

	return ok({ entityId, status: shouldQueue ? 'queued' : 'saved' }, 201);
};

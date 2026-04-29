import type { RequestHandler } from './$types';

import { fail, ok } from '$lib/server/http';
import { createDocumentIntakeService } from '../../../modules/document-intake';

/**
 * Manual upload endpoint (Phase 2). Accepts multipart/form-data with a single
 * `file` field plus optional `uploadedFrom` (default `ai_panel`). Stores the
 * file via the platform FileService, creates a Document Artifact, runs the
 * synchronous extract → classify pipeline, and returns the artifact view.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	let form: FormData;
	try {
		form = await event.request.formData();
	} catch {
		return fail('Expected multipart/form-data with a `file` field', 400);
	}

	const file = form.get('file');
	if (!(file instanceof File)) {
		return fail('Missing required field: file', 400);
	}
	const uploadedFromRaw = form.get('uploadedFrom');
	const uploadedFrom =
		uploadedFromRaw === 'finance_workspace' || uploadedFromRaw === 'task_mode'
			? uploadedFromRaw
			: 'ai_panel';

	const service = createDocumentIntakeService({
		db: (await import('../../../infrastructure/db')).getDb(event.platform.env),
		env: event.platform.env,
		user
	});

	let artifact;
	try {
		const body = new Uint8Array(await file.arrayBuffer());
		artifact = await service.createDocumentFromUpload({
			tenantId: 'default',
			uploadedBy: user.id,
			uploadedFrom,
			fileName: file.name,
			mimeType: file.type || 'application/octet-stream',
			body,
			sizeBytes: body.byteLength
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Upload failed';
		return fail(message, 400);
	}

	let processed;
	try {
		processed = await service.processDocument({
			tenantId: 'default',
			documentId: artifact.id,
			mode: 'sync'
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Processing failed';
		return fail(message, 500, { documentId: artifact.id });
	}

	return ok(service.toView(processed), 201);
};

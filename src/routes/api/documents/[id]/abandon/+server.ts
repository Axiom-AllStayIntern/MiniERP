import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { createDocumentIntakeService } from '$modules/document-intake';
import { getDb } from '../../../../../infrastructure/db';

interface AbandonBody {
	reason?: string | null;
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const id = event.params.id;
	if (!id) return fail('Document id is required', 400);

	const body = (await event.request.json().catch(() => null)) as AbandonBody | null;
	const env = event.platform.env;
	const db = getDb(env);
	const service = createDocumentIntakeService({ db, env, user });

	const result = await service.abandonIntake({
		tenantId: 'default',
		documentId: id,
		reason: body?.reason ?? null
	});

	if (!result.ok) {
		if (result.status === 'not_found') return fail(result.message, 404);
		return fail(result.message, 409, {
			processingStatus: result.artifact?.processingStatus
		});
	}

	return ok(service.toView(result.artifact));
};

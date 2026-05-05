import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { createDocumentIntakeService } from '../../../../modules/document-intake';
import { getDb } from '../../../../infrastructure/db';

export const GET: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const id = event.params.id;
	if (!id) return fail('Document id is required', 400);

	const service = createDocumentIntakeService({
		db: getDb(event.platform.env),
		env: event.platform.env,
		user
	});

	const artifact = await service.getDocumentArtifact({ tenantId: 'default', documentId: id });
	if (!artifact) return fail('Document not found', 404);

	return ok(service.toView(artifact));
};


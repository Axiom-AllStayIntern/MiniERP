import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import {
	createDocumentIntakeApi,
	createDocumentIntakeService
} from '$modules/document-intake';
import { getDb } from '../../../../../infrastructure/db';
import { fail, ok } from '$platform/http';

/**
 * GET /api/documents/[id]/status
 *
 * Poll status for a Document Intake artifact (Phase 2 onwards). Falls back to
 * the legacy `documents`-table OCR status if the id doesn't resolve to an
 * artifact, so old callers (doc-hub upload polls) still work.
 */
export const GET: RequestHandler = async (event) => {
	const { params, platform, locals } = event;
	if (!platform) return fail('Cloudflare platform bindings are required', 500);
	if (!locals.user) return fail('Unauthorized', 401);

	const { id } = params;
	if (!id) return fail('Document ID is required', 400);

	// Phase 2 path: artifact-backed status (lean response for the AI panel poll).
	const service = createDocumentIntakeService({
		db: getDb(platform.env),
		env: platform.env,
		user: locals.user
	});
	const artifact = await service.getDocumentArtifact({ tenantId: 'default', documentId: id });
	if (artifact) {
		return ok({
			documentId: artifact.id,
			processingStatus: artifact.processingStatus,
			documentType: artifact.documentType,
			classification: artifact.classification,
			suggestedFields: artifact.suggestedFields,
			suggestedCategoryId: artifact.suggestedCategoryId,
			securityFlags: artifact.securityFlags ?? [],
			updatedAt: artifact.updatedAt
		});
	}

	// Legacy fallback for the old doc-hub upload polling shape.
	const ctx = await createModuleContext(event);
	const legacy = createDocumentIntakeApi(ctx);
	const legacyStatus = await legacy.getDocumentStatus(id);
	if (legacyStatus) return ok(legacyStatus);

	return fail('Document not found', 404);
};


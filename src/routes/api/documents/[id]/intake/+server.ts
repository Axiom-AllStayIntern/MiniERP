import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { createDocumentIntakeService } from '$modules/document-intake';
import { getDb } from '../../../../../infrastructure/db';

/**
 * GET /api/documents/[id]/intake
 *
 * Authenticated diagnostic view for the document-intake stage. Unlike the
 * generic document view, this intentionally includes the extracted raw text so
 * operators can evaluate extraction quality before finance analysis/review.
 */
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

	const text = artifact.textExtraction?.text ?? '';
	return ok({
		id: artifact.id,
		processingStatus: artifact.processingStatus,
		documentType: artifact.documentType ?? 'unknown',
		originalFile: {
			fileName: artifact.originalFile.fileName,
			mimeType: artifact.originalFile.mimeType,
			sizeBytes: artifact.originalFile.sizeBytes
		},
		textExtraction: artifact.textExtraction
			? {
					method: artifact.textExtraction.method,
					status: artifact.textExtraction.status,
					confidence: artifact.textExtraction.confidence,
					language: artifact.textExtraction.language,
					provider: artifact.textExtraction.provider,
					pageCount: artifact.textExtraction.pages?.length ?? null,
					textLength: text.length,
					rawText: text,
					error: artifact.textExtraction.error
				}
			: null,
		classification: artifact.classification ?? null,
		securityFlags: artifact.securityFlags ?? [],
		updatedAt: artifact.updatedAt
	});
};

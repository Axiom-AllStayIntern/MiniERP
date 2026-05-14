import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { getDb } from '../../../../infrastructure/db';
import { DocumentArtifactRepository } from '$modules/document-intake';
import { createDocumentIntakeService } from '$modules/document-intake';
import type { DocumentProcessingStatus } from '$modules/document-intake';

/**
 * GET /api/documents/inbox
 *
 * List artifacts in the active inbox (Ship 2). Default returns
 * `ready_for_review` artifacts (the user's queue of "pending review"
 * documents). Optional `?status=<csv>` overrides the filter (e.g.
 * `?status=ready_for_review,confirmed,failed` for a multi-tab inbox).
 *
 * Pagination: `?limit=` (default 100, max 200), `?offset=` (default 0).
 *
 * Returns: `{ items: DocumentArtifactView[], total: number }`. `total` is
 * the unfiltered count for the chosen status set so the UI can render
 * "showing 25 of 137" without an extra round trip.
 */

const ALLOWED_STATUSES: DocumentProcessingStatus[] = [
	'received',
	'stored',
	'text_extraction_pending',
	'text_extracted',
	'ocr_pending',
	'ocr_completed',
	'classification_pending',
	'classified',
	'fields_extraction_pending',
	'ready_for_review',
	'ready_for_workflow',
	'confirmed',
	'abandoned',
	'needs_manual_review',
	'failed'
];

const DEFAULT_INBOX_STATUSES: DocumentProcessingStatus[] = [
	// Active inbox = anything still moving + ready for user action. We
	// include the in-flight statuses so the UI can show a "processing"
	// row while the worker is still running.
	'received',
	'stored',
	'text_extraction_pending',
	'text_extracted',
	'classification_pending',
	'classified',
	'fields_extraction_pending',
	'ready_for_review'
];

function parseStatuses(raw: string | null): DocumentProcessingStatus[] {
	if (!raw) return DEFAULT_INBOX_STATUSES;
	const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
	const valid = parts.filter((s): s is DocumentProcessingStatus =>
		(ALLOWED_STATUSES as string[]).includes(s)
	);
	return valid.length > 0 ? valid : DEFAULT_INBOX_STATUSES;
}

export const GET: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const url = event.url;
	const statuses = parseStatuses(url.searchParams.get('status'));
	const limit = Math.min(
		Math.max(Number(url.searchParams.get('limit') ?? '100') || 100, 1),
		200
	);
	const offset = Math.max(Number(url.searchParams.get('offset') ?? '0') || 0, 0);

	const env = event.platform.env;
	const db = getDb(env);
	const repo = new DocumentArtifactRepository(db);
	const service = createDocumentIntakeService({ db, env, user });

	const tenantId = 'default';
	const [items, total] = await Promise.all([
		repo.listByStatuses(tenantId, statuses, { limit, offset }),
		repo.countByStatuses(tenantId, statuses)
	]);

	return ok({
		items: items.map((a) => service.toView(a)),
		total,
		limit,
		offset,
		statuses
	});
};

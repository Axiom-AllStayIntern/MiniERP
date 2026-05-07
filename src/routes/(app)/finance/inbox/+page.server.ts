import type { PageServerLoad } from './$types';

import type { DocumentArtifactView } from '$modules/document-intake';

interface InboxResponse {
	items: DocumentArtifactView[];
	total: number;
	limit: number;
	offset: number;
	statuses: string[];
}

interface InboxPayload {
	data: InboxResponse | null;
}

/**
 * /finance/inbox — server loader for the document inbox list (Ship 2B).
 *
 * Calls the canonical /api/documents/inbox endpoint via event.fetch so the
 * page and the API share one source of truth (filtering, pagination, view
 * shape). On Cloudflare this is an in-process call — same Worker — so the
 * extra hop is free.
 *
 * Tab semantics:
 *  - default tab = `ready_for_review` only
 *  - other tabs (in-flight / failed / confirmed) selected via ?tab= URL param
 *
 * The page handles tab switching client-side via fetch; the SSR load only
 * needs to render the initial tab.
 */
export const load: PageServerLoad = async (event) => {
	const tabRaw = event.url.searchParams.get('tab');
	const statusParam = resolveStatusParam(tabRaw);

	const params = new URLSearchParams();
	if (statusParam) params.set('status', statusParam);
	params.set('limit', '50');

	const res = await event.fetch(`/api/documents/inbox?${params.toString()}`, {
		headers: { accept: 'application/json' }
	});

	if (!res.ok) {
		return { initialTab: tabRaw ?? 'review', payload: { data: null } } as const;
	}

	const json = (await res.json()) as { data?: InboxResponse } | InboxResponse;
	// $platform/http `ok()` wraps payload as `{ data: ... }`; if the API
	// changes to return raw, this still works.
	const data: InboxResponse | null =
		'data' in json && json.data ? json.data : (json as InboxResponse);

	return {
		initialTab: tabRaw ?? 'review',
		payload: { data } as InboxPayload
	};
};

/**
 * Map UI tab id → comma-separated status filter for the API.
 *
 * `review` (default) is the user's primary work queue: ready_for_review only.
 * `processing` is "still moving through the worker". Useful when the user
 *   just uploaded and wants to watch the chain progress.
 * `confirmed` is the audit trail of recently-confirmed artifacts (kept 30d).
 * `failed` includes both auto-failed and needs_manual_review for triage.
 */
function resolveStatusParam(tab: string | null): string | null {
	switch (tab) {
		case 'processing':
			return [
				'received',
				'stored',
				'text_extraction_pending',
				'text_extracted',
				'classification_pending',
				'classified',
				'fields_extraction_pending'
			].join(',');
		case 'confirmed':
			return 'confirmed';
		case 'failed':
			return ['failed', 'needs_manual_review'].join(',');
		case 'review':
		case null:
			return 'ready_for_review';
		default:
			return 'ready_for_review';
	}
}

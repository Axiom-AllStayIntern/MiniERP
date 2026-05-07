import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import {
	FINANCE_CATEGORY_CATALOG,
	type CategoryDefinition
} from '$modules/finance';
import type { DocumentArtifactView } from '$modules/document-intake';

interface CategoryChoice {
	id: string;
	label: string;
	sublabel: string | undefined;
	bucket: CategoryDefinition['bucket'];
	expenseType: CategoryDefinition['expenseType'];
	persistTarget: CategoryDefinition['persistTarget'];
	llmFields: readonly string[];
	userFields: readonly string[];
	requiresProject: boolean;
}

/**
 * /finance/inbox/[id] — review & confirm page for a single document artifact.
 *
 * Loads:
 *  - The artifact view (via /api/documents/[id]) so the page renders its
 *    suggestedFields, suggestedCategoryId, classification, etc.
 *  - The full category catalog (clientside-friendly shape) so the user can
 *    change the category dropdown which triggers POST /reclassify.
 *
 * The page is the single place where the user decides "yes, persist this
 * to expenses/revenue/archive" — clicking Confirm posts to /confirm with a
 * tamper-guarded payload hash.
 */
export const load: PageServerLoad = async (event) => {
	const id = event.params.id;
	if (!id) throw error(400, 'Missing document id');

	const res = await event.fetch(`/api/documents/${encodeURIComponent(id)}`, {
		headers: { accept: 'application/json' }
	});
	if (res.status === 404) throw error(404, 'Document not found');
	if (!res.ok) throw error(res.status, 'Could not load document');
	const json = (await res.json()) as { data?: DocumentArtifactView } | DocumentArtifactView;
	const artifact: DocumentArtifactView | null =
		'data' in json && json.data ? json.data : (json as DocumentArtifactView);
	if (!artifact) throw error(500, 'Empty response from documents API');

	// Project a lean category list to the client. Includes ALL categories so
	// the user can switch from any starting point — including from
	// document_only categories back into expense/revenue.
	const categories: CategoryChoice[] = FINANCE_CATEGORY_CATALOG.map((c) => ({
		id: c.id,
		label: c.label,
		sublabel: c.sublabel,
		bucket: c.bucket,
		expenseType: c.expenseType,
		persistTarget: c.persistTarget,
		llmFields: c.llmFields,
		userFields: c.userFields,
		requiresProject: c.requiresProject
	}));

	return { artifact, categories };
};

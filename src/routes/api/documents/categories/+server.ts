import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { FINANCE_CATEGORY_CATALOG } from '$modules/finance';

/**
 * GET /api/documents/categories
 *
 * Client-safe projection of the financial-document-intake category catalog.
 * AI Panel Inbox uses this to render the same reclassify/confirm form as the
 * standalone /finance/inbox/[id] page without deep-importing finance internals.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return fail('Unauthorized', 401);

	return ok({
		categories: FINANCE_CATEGORY_CATALOG.map((c) => ({
			id: c.id,
			label: c.label,
			sublabel: c.sublabel,
			bucket: c.bucket,
			expenseType: c.expenseType,
			persistTarget: c.persistTarget,
			llmFields: c.llmFields,
			userFields: c.userFields,
			requiresProject: c.requiresProject
		}))
	});
};

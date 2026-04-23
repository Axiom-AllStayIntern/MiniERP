import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createExpenseApi } from '$lib/server/modules/expense/api';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent } = event;
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const expense = createExpenseApi(ctx);
	const detail = await expense.getProjectRevenueDocumentDetail(params.id, params.revenueId);
	if (!detail) throw error(404, 'Revenue record not found');

	return detail;
};

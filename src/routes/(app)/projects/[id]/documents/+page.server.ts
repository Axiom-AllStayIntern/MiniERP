import type { PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../../modules/finance';

const emptySummary = {
	documents: [],
	contracts: [],
	quotations: [],
	purchaseOrders: [],
	expenseDocuments: [],
	revenueDocuments: []
};

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent } = event;
	const { project } = await parent();

	if (!platform) {
		return { ...emptySummary, project };
	}

	const ctx = await createModuleContext(event);
	const { insights } = createFinanceApi(ctx);
	const summary = await insights.getProjectDocumentsSummary(params.id);

	return { ...summary, project };
};


import type { PageServerLoad } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createReportingApi } from '$lib/server/modules/reporting/api';

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
	const reporting = createReportingApi(ctx);
	const summary = await reporting.getProjectDocumentsSummary(params.id);

	return { ...summary, project };
};

import type { PageServerLoad } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '../../../../../modules/finance';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) {
		return {
			invoices: [],
			projects: [],
			selectedProject: null,
			filters: {
				projectId: '',
				q: '',
				status: '',
				startedAfter: '',
				page: 1,
				supplierQ: '',
				listMode: 'all',
				supplierField: 'all'
			},
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const ctx = await createModuleContext(event);
	const { documents } = createFinanceApi(ctx);
	return documents.getSupplierInvoiceDocHubPage(event.url.searchParams);
};


import type { PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
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
				invoiceQ: '',
				listMode: 'all',
				invoiceField: 'all'
			},
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const ctx = await createModuleContext(event);
	const { billing } = createFinanceApi(ctx);
	return billing.getCustomerInvoiceDocHubPage(event.url.searchParams);
};



import type { PageServerLoad } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';

export const load: PageServerLoad = async (event) => {
	const preselectProjectId = event.url.searchParams.get('projectId')?.trim() ?? '';

	if (!event.platform) {
		return { projects: [] as const, preselectProjectId, editingInvoice: null };
	}

	const ctx = await createModuleContext(event);
	const { billing } = createFinanceApi(ctx);
	return billing.getCustomerInvoiceGeneratePage(event.url.searchParams);
};


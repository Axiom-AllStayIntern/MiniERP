import type { PageServerLoad } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) {
		return { reimbursements: [], total: 0 };
	}

	try {
		const ctx = await createModuleContext(event);
		const { expenses } = createFinanceApi(ctx);
		return expenses.getReimbursementsPage();
	} catch (err) {
		console.error('[expenses/reimbursements] load failed', err);
		return { reimbursements: [], total: 0 };
	}
};


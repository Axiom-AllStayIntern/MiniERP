import type { PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../modules/finance';

export const load: PageServerLoad = async (event) => {
	const projectIdParam = event.url.searchParams.get('projectId')?.trim() ?? '';
	const empty = { employees: [], preselectedProject: null };

	if (!event.platform) {
		return empty;
	}

	try {
		const ctx = await createModuleContext(event);
		const { expenses } = createFinanceApi(ctx);
		return expenses.getExpenseUploadPage(projectIdParam);
	} catch (error) {
		console.error('[expenses/upload] failed to load employees:', error);
		return empty;
	}
};



import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json()) as Parameters<
		ReturnType<typeof createFinanceApi>['expenses']['uploadExpense']
	>[0];
	const ctx = await createModuleContext(event);
	const { expenses } = createFinanceApi(ctx);
	const result = await expenses.uploadExpense(body);

	if (!result.ok) {
		return fail(result.message, result.status, result.details);
	}

	return ok(result.data, result.status);
};


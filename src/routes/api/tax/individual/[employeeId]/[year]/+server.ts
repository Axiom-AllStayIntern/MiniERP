import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	const { params, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const year = Number.parseInt(params.year, 10);
	if (!Number.isFinite(year)) {
		return fail('Invalid year');
	}

	const employeeId = params.employeeId?.trim();
	if (!employeeId) {
		return fail('Invalid employee id');
	}

	const ctx = await createModuleContext(event);
	const { taxes } = createFinanceApi(ctx);
	const summary = await taxes.getEmployeeTaxSummary(employeeId, year);

	if (!summary) {
		return fail('Employee not found', 404);
	}

	return ok(summary);
};

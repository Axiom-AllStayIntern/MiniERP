import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../../../modules/finance';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	const { params, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const ctx = await createModuleContext(event);
	const { taxes } = createFinanceApi(ctx);
	const result = await taxes.getGstReturnEstimate(params.year, params.quarter);
	if (!result) {
		return fail('Invalid year or quarter');
	}

	return ok(result);
};


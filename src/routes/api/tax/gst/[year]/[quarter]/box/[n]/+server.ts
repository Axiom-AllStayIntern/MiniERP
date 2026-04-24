import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	const { params, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const boxNo = Number.parseInt(params.n, 10);
	const ctx = await createModuleContext(event);
	const { taxes } = createFinanceApi(ctx);
	const detail = await taxes.getGstBoxDetail(params.year, params.quarter, boxNo);
	if (!detail) {
		return fail('Invalid year or quarter');
	}

	return ok(detail);
};

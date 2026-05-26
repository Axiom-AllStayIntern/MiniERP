import type { RequestEvent } from '@sveltejs/kit';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '$modules/finance';
import { fail, ok } from '$platform/http';

export const GET = async (event: RequestEvent) => {
	const { params, platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const ctx = await createModuleContext(event);
	const { taxes } = createFinanceApi(ctx);
	const result = await taxes.getGstF5Report(params.year, params.quarter);
	if (!result) {
		return fail('Invalid year or quarter');
	}

	return ok(result);
};

import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createTaxApi } from '$lib/server/modules/tax/api';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	try {
		const year = Number.parseInt(event.params.year, 10);
		if (!Number.isFinite(year)) {
			return fail('Invalid year');
		}

		const ctx = await createModuleContext(event);
		const tax = createTaxApi(ctx);
		return ok(await tax.getCorporateTaxEstimate(year));
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

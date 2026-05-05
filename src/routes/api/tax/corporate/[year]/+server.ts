import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../../modules/finance';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const year = Number.parseInt(event.params.year, 10);
		if (!Number.isFinite(year)) {
			return fail('Invalid year');
		}

		const ctx = await createModuleContext(event);
		const { taxes } = createFinanceApi(ctx);
		return ok(await taxes.getCorporateTaxEstimate(year));
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};


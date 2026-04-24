import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { insights } = createFinanceApi(ctx);
		const ranking = await insights.getProjectsProfitRanking({
			projectId: event.url.searchParams.get('projectId'),
			projectStatus: event.url.searchParams.get('projectStatus'),
			from: event.url.searchParams.get('from'),
			to: event.url.searchParams.get('to')
		});

		return ok(ranking);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};


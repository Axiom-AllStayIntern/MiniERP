import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '$modules/finance';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { insights } = createFinanceApi(ctx);
		const breakdown = await insights.getCategoryBreakdown({
			from: event.url.searchParams.get('from'),
			to: event.url.searchParams.get('to')
		});
		return ok(breakdown);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

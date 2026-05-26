import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '$modules/finance';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { insights } = createFinanceApi(ctx);
		const report = await insights.getTrialBalance({
			from: event.url.searchParams.get('from'),
			to: event.url.searchParams.get('to')
		});
		return ok(report);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createReportingApi } from '$lib/server/modules/reporting/api';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const reporting = createReportingApi(ctx);
		const charts = await reporting.getDashboardCharts({
			projectStatus: event.url.searchParams.get('projectStatus'),
			from: event.url.searchParams.get('from'),
			to: event.url.searchParams.get('to')
		});

		return ok(charts);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

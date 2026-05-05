import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../../modules/finance';
import { fail } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { insights } = createFinanceApi(ctx);
		const csv = await insights.getProjectsProfitCsv({
			projectId: event.url.searchParams.get('projectId'),
			projectStatus: event.url.searchParams.get('projectStatus'),
			from: event.url.searchParams.get('from'),
			to: event.url.searchParams.get('to')
		});

		return new Response(csv, {
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': 'attachment; filename="projects-profit-report.csv"'
			}
		});
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};



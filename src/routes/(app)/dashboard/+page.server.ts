import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ url }) => {
	const projectStatus = url.searchParams.get('status') ?? '';
	const now = new Date();
	const defaultTo = now.toISOString().slice(0, 10);
	const defaultFromDate = new Date(now);
	defaultFromDate.setUTCMonth(defaultFromDate.getUTCMonth() - 3);
	const defaultFrom = defaultFromDate.toISOString().slice(0, 10);
	const rawFrom = url.searchParams.get('from') ?? '';
	const rawTo = url.searchParams.get('to') ?? '';
	const from = rawFrom.trim() || defaultFrom;
	const to = rawTo.trim() || defaultTo;

	return {
		filters: { status: projectStatus, from, to }
	};
};


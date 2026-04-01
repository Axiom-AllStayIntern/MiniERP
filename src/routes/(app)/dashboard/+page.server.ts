import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ url }) => {
	const projectStatus = url.searchParams.get('status') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';

	return {
		filters: { status: projectStatus, from, to }
	};
};

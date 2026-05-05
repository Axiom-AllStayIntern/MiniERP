import type { PageServerLoad } from './$types';

type ApiResult<T> = {
	ok: boolean;
	data: T;
	error?: string;
};

export const load: PageServerLoad = async ({ fetch, url }) => {
	const projectId = url.searchParams.get('projectId') ?? '';
	const projectStatus = url.searchParams.get('status') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const qs = new URLSearchParams();
	if (projectId) qs.set('projectId', projectId);
	if (projectStatus) qs.set('projectStatus', projectStatus);
	if (from) qs.set('from', from);
	if (to) qs.set('to', to);

	const [response, projectsResponse] = await Promise.all([
		fetch(`/api/dashboard/projects-profit?${qs.toString()}`),
		fetch('/api/projects')
	]);
	const json = (await response.json()) as ApiResult<
		Array<{
			projectId: string;
			projectName: string;
			projectStatus: string;
			revenue: number;
			cost: number;
			profit: number;
			profitMargin: number;
		}>
	>;
	const projectsJson = (await projectsResponse.json()) as ApiResult<
		Array<{ id: string; name: string; status: string }>
	>;

	return {
		projectsProfit: json.ok ? json.data : [],
		projectOptions: projectsJson.ok ? projectsJson.data : [],
		filters: { projectId, status: projectStatus, from, to }
	};
};


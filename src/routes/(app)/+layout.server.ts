import type { LayoutServerLoad } from './$types';
import { createModuleContext } from '$lib/server/modules';
import { getEnabledModuleIds } from '$lib/server/modules/enabled';
import { createProjectApi } from '$lib/server/modules/project/api';

function shouldLoadProjectSidebarCounts(pathname: string): boolean {
	if (!pathname.startsWith('/projects')) return false;
	// Matches +layout.svelte isProjectDetailPage: no shell sidebar or list counts on detail routes
	return !/^\/projects\/(?!new$)[^/]+/.test(pathname);
}

export const load: LayoutServerLoad = async (event) => {
	const { locals, platform, url } = event;
	let enabledModules: string[] = [];
	let projectListCounts: { all: number; active: number } | undefined;

	if (platform) {
		const ctx = await createModuleContext(event);
		enabledModules = await getEnabledModuleIds(ctx.db);
		if (shouldLoadProjectSidebarCounts(url.pathname)) {
			projectListCounts = await createProjectApi(ctx).getListCounts();
		}
	}
	return {
		user: locals.user,
		enabledModules,
		projectListCounts
	};
};

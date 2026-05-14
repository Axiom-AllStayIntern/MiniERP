import type { LayoutServerLoad } from './$types';
import { createModuleContext } from '$platform/modules';
import { createProjectApi } from '$modules/project';
import { filterModuleIdsForRole, getEnabledModuleIds } from '$app-layer/bootstrap/module-access';
import { registry } from '$platform/registry';
import { defaultPathForRole } from '$platform/auth/permissions';

function shouldLoadProjectSidebarCounts(pathname: string): boolean {
	if (!pathname.startsWith('/projects')) return false;
	// Matches +layout.svelte isProjectDetailPage: no shell sidebar or list counts on detail routes
	return !/^\/projects\/(?!new$)[^/]+/.test(pathname);
}

export const load: LayoutServerLoad = async (event) => {
	const { locals, platform, url } = event;
	let enabledModules: string[] = registry.getAll().map((module) => module.manifest.id);
	let projectListCounts: { all: number; active: number } | undefined;

	if (platform) {
		const ctx = await createModuleContext(event);
		enabledModules = await getEnabledModuleIds(ctx.db);
		if (shouldLoadProjectSidebarCounts(url.pathname)) {
			projectListCounts = await createProjectApi(ctx).getListCounts();
		}
	}
	if (locals.user) {
		enabledModules = filterModuleIdsForRole(enabledModules, locals.user.role);
	}
	return {
		user: locals.user,
		enabledModules,
		defaultHome: locals.user ? defaultPathForRole(locals.user.role) : '/login',
		projectListCounts
	};
};

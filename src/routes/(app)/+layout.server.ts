import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getEnabledModuleIds } from '$lib/server/modules/enabled';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	let enabledModules: string[] = [];
	if (platform) {
		const db = getDb(platform.env);
		enabledModules = await getEnabledModuleIds(db);
	}
	return {
		user: locals.user,
		enabledModules
	};
};

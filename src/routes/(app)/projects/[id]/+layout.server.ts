import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import { createModuleContext, NotFoundError } from '$lib/server/modules';
import { createProjectApi } from '$lib/server/modules/project/api';

export const load: LayoutServerLoad = async (event) => {
	if (!event.platform) {
		throw error(500, 'Cloudflare platform bindings are required');
	}

	event.depends(`app:project-activity:${event.params.id}`);

	try {
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);
		return await project.getProjectShell(event.params.id);
	} catch (e) {
		if (e instanceof NotFoundError) {
			throw error(404, 'Project not found');
		}
		throw e;
	}
};

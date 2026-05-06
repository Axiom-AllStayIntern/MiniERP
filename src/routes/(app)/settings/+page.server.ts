import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createModuleContext, registry } from '$platform/modules';
import { createCoreApi } from '$platform/core';

export const load: PageServerLoad = async (event) => {
	const ctx = await createModuleContext(event);
	const core = createCoreApi(ctx);

	const modules = registry.getAll().map((m) => ({
		id: m.manifest.id,
		name: m.manifest.name,
		layer: m.manifest.layer,
		dependencies: m.manifest.dependencies
	}));

	const enabled = (await core.getEnabledModules()) ?? modules.map((m) => m.id);
	const validation = registry.validateDependencies(enabled);

	return {
		modules,
		enabled,
		validation
	};
};

export const actions: Actions = {
	default: async (event) => {
		const ctx = await createModuleContext(event);
		const core = createCoreApi(ctx);
		const form = await event.request.formData();

		const selected = form
			.getAll('module')
			.filter((v): v is string => typeof v === 'string')
			.map((v) => v.trim())
			.filter(Boolean);

		const validIds = new Set(registry.getAll().map((m) => m.manifest.id));
		const unknown = selected.filter((id) => !validIds.has(id));
		if (unknown.length > 0) {
			return fail(400, {
				message: `Unknown module ids: ${unknown.join(', ')}`,
				saved: false
			});
		}

		const validation = registry.validateDependencies(selected);
		if (!validation.valid) {
			return fail(400, {
				message: `Missing dependencies: ${validation.missing
					.map((m) => `${m.moduleId} -> [${m.missingDeps.join(', ')}]`)
					.join('; ')}`,
				saved: false
			});
		}

		await core.setEnabledModules(selected);
		return {
			saved: true,
			message: 'Module configuration saved.'
		};
	}
};


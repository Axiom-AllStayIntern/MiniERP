import type { RequestHandler } from './$types';

import { createModuleContext, registry } from '$platform/modules';
import { createCoreApi } from '$platform/core';
import { fail, ok } from '$platform/http';

function getValidModuleIds() {
	return new Set(registry.getAll().map((m) => m.manifest.id));
}

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const core = createCoreApi(ctx);
		const enabled = (await core.getEnabledModules()) ?? registry.getAll().map((m) => m.manifest.id);
		const validation = registry.validateDependencies(enabled);

		return ok({
			enabled,
			validation
		});
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const core = createCoreApi(ctx);
		const body = (await event.request.json()) as { enabled?: unknown };
		if (!Array.isArray(body.enabled)) {
			return fail('enabled must be an array of module ids', 400);
		}

		const validIds = getValidModuleIds();
		const enabled = [...new Set(body.enabled.filter((id): id is string => typeof id === 'string'))];
		const unknown = enabled.filter((id) => !validIds.has(id));
		if (unknown.length > 0) {
			return fail(`Unknown module ids: ${unknown.join(', ')}`, 400);
		}

		const validation = registry.validateDependencies(enabled);
		if (!validation.valid) {
			return fail(
				`Missing dependencies: ${validation.missing
					.map((m) => `${m.moduleId} -> [${m.missingDeps.join(', ')}]`)
					.join('; ')}`,
				400
			);
		}

		await core.setEnabledModules(enabled);
		return ok({ enabled, saved: true });
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};


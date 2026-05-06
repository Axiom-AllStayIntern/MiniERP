import type { RequestEvent } from '@sveltejs/kit';
import { getDb } from '../../infrastructure/db';
import { CompanySettingsRepository } from '$platform/config/company-settings-repository';
import type { ModuleContext } from '../modules/types';
import { createEventBus, resetCorrelationId } from '../events';
import { registry } from '../registry';

async function resolveEnabledModuleIds(db: ModuleContext['db']): Promise<string[]> {
	const allModules = registry.getAll();
	const fallback = allModules.map((m) => m.manifest.id);
	try {
		const configRepo = new CompanySettingsRepository(db);
		const raw = await configRepo.get<unknown>('modules.enabled');
		if (!Array.isArray(raw)) return fallback;

		const configured = raw.filter((id): id is string => typeof id === 'string').map((id) => id.trim());
		const existing = new Set(allModules.map((m) => m.manifest.id));
		const filtered = configured.filter((id) => existing.has(id));
		const validation = registry.validateDependencies(filtered);

		if (!validation.valid) {
			console.error('[Modules] Invalid modules.enabled dependency graph, falling back to full set.', {
				configured: filtered,
				missing: validation.missing
			});
			return fallback;
		}

		return filtered;
	} catch (err) {
		console.error('[Modules] Failed to resolve modules.enabled, falling back to full set.', err);
		return fallback;
	}
}

export async function createModuleContext(event: RequestEvent): Promise<ModuleContext> {
	const platform = event.platform;
	if (!platform) {
		throw new Error('Cloudflare platform bindings are required');
	}

	resetCorrelationId();

	const env = platform.env;
	const db = getDb(env);
	const user = event.locals.user;
	const eventBus = createEventBus();
	const ctx: ModuleContext = { env, db, user, eventBus };

	const enabledIds = await resolveEnabledModuleIds(db);
	const modules = registry.getEnabled(enabledIds);
	for (const mod of modules) {
		mod.registerHandlers?.(eventBus, ctx);
	}

	return ctx;
}

export async function createWorkerContext(
	env: Env,
	user?: App.Locals['user']
): Promise<ModuleContext> {
	resetCorrelationId();

	const db = getDb(env);
	const eventBus = createEventBus();
	const ctx: ModuleContext = { env, db, user: user ?? null, eventBus };

	const enabledIds = await resolveEnabledModuleIds(db);
	const modules = registry.getEnabled(enabledIds);
	for (const mod of modules) {
		mod.registerHandlers?.(eventBus, ctx);
	}

	return ctx;
}

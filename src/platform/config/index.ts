import type { DBClient } from '../../infrastructure/db';
import { CompanySettingsRepository } from '$modules/legacy/server-modules/core/repository';
import { registry } from '../registry';

const PREFIX_TO_MODULE: Array<{ prefix: string; moduleId: string }> = [
	{ prefix: '/expenses', moduleId: 'expense' },
	{ prefix: '/api/expenses', moduleId: 'expense' },
	{ prefix: '/api/business-trips', moduleId: 'expense' },
	{ prefix: '/ar', moduleId: 'ar' },
	{ prefix: '/finance', moduleId: 'ar' },
	{ prefix: '/projects', moduleId: 'project' },
	{ prefix: '/customers', moduleId: 'business-partner' },
	{ prefix: '/suppliers', moduleId: 'business-partner' },
	{ prefix: '/api/customers', moduleId: 'business-partner' },
	{ prefix: '/api/suppliers', moduleId: 'business-partner' },
	{ prefix: '/employees', moduleId: 'employee' },
	{ prefix: '/tax', moduleId: 'tax' },
	{ prefix: '/reports', moduleId: 'reporting' },
	{ prefix: '/settings', moduleId: 'core' },
	{ prefix: '/api/ar', moduleId: 'ar' },
	{ prefix: '/api/projects', moduleId: 'project' },
	{ prefix: '/api/employees', moduleId: 'employee' },
	{ prefix: '/api/tax', moduleId: 'tax' },
	{ prefix: '/api/reports', moduleId: 'reporting' },
	{ prefix: '/api/dashboard', moduleId: 'reporting' },
	{ prefix: '/api/settings', moduleId: 'core' },
	{ prefix: '/api/documents', moduleId: 'ar' }
];

export function moduleForPath(pathname: string): string | null {
	for (const entry of PREFIX_TO_MODULE) {
		if (pathname.startsWith(entry.prefix)) return entry.moduleId;
	}
	return null;
}

export async function getEnabledModuleIds(db: DBClient): Promise<string[]> {
	const all = registry.getAll().map((m) => m.manifest.id);
	const repo = new CompanySettingsRepository(db);
	const raw = await repo.get<unknown>('modules.enabled');
	if (!Array.isArray(raw)) return all;
	const configured = raw.filter((id): id is string => typeof id === 'string').map((id) => id.trim());
	const valid = new Set(all);
	const filtered = configured.filter((id) => valid.has(id));
	const validation = registry.validateDependencies(filtered);
	if (!validation.valid) return all;
	return filtered;
}

export function isPathEnabled(pathname: string, enabledModuleIds: string[]): boolean {
	const moduleId = moduleForPath(pathname);
	if (!moduleId) return true;
	if (moduleId === 'core') return true;
	return enabledModuleIds.includes(moduleId);
}

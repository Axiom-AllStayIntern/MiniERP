import type { DBClient } from '$infrastructure/db';
import { CompanySettingsRepository } from '$platform/config/company-settings-repository';
import {
	isPathEnabled as isMappedPathEnabled,
	resolveEnabledModuleIds,
	type ModulePathMapping
} from '$platform/config';

// Strict module access mappings (Wave 0.3 of v4 migration plan).
// Finance- and document-intake-owned routes are gated by the target module ids.
// Legacy module ids remain only for paths that have not yet migrated to a target
// module — they are removed step-by-step through Wave 1.x.
// Order matters: moduleForPath() is first-match-wins, so longer / more specific
// prefixes must come before shorter ones.
const MODULE_PATH_MAPPINGS: ModulePathMapping[] = [
	// Document Intake (target module — gates all upload / OCR / artifact routes)
	{ prefix: '/api/documents', moduleId: 'document-intake' },
	{ prefix: '/api/doc-hub', moduleId: 'document-intake' },
	{ prefix: '/api/upload', moduleId: 'document-intake' },
	{ prefix: '/api/ocr', moduleId: 'document-intake' },
	{ prefix: '/api/intake', moduleId: 'document-intake' },

	// Finance (target module — owns expenses / revenue / tax / reporting / dashboards)
	{ prefix: '/api/finance', moduleId: 'finance' },
	{ prefix: '/api/expenses', moduleId: 'finance' },
	{ prefix: '/api/business-trips', moduleId: 'finance' },
	{ prefix: '/api/tax', moduleId: 'finance' },
	{ prefix: '/api/reports', moduleId: 'finance' },
	{ prefix: '/api/dashboard', moduleId: 'finance' },
	{ prefix: '/api/invoices', moduleId: 'finance' },
	{ prefix: '/finance', moduleId: 'finance' },
	{ prefix: '/expenses', moduleId: 'finance' },
	{ prefix: '/tax', moduleId: 'finance' },
	{ prefix: '/reports', moduleId: 'finance' },
	{ prefix: '/dashboard', moduleId: 'finance' },

	// Project (target module — Wave 1.4 finished)
	{ prefix: '/api/projects', moduleId: 'project' },
	{ prefix: '/projects', moduleId: 'project' },

	// Business Partner (target module created in Wave 1.1; legacy id retained until then)
	{ prefix: '/api/customers', moduleId: 'business-partner' },
	{ prefix: '/api/suppliers', moduleId: 'business-partner' },
	{ prefix: '/customers', moduleId: 'business-partner' },
	{ prefix: '/suppliers', moduleId: 'business-partner' },

	// HR / Employee / Person (consolidated in Wave 1.3 into modules/hr)
	{ prefix: '/api/employees', moduleId: 'employee' },
	{ prefix: '/employees', moduleId: 'employee' },

	// Core platform (settings / audit / company-level config — special-cased to always-enabled in platform/config)
	{ prefix: '/api/settings', moduleId: 'core' },
	{ prefix: '/settings', moduleId: 'core' }
];

export async function getEnabledModuleIds(db: DBClient): Promise<string[]> {
	const repo = new CompanySettingsRepository(db);
	const raw = await repo.get<unknown>('modules.enabled');
	return resolveEnabledModuleIds(raw);
}

export function isPathEnabled(pathname: string, enabledModuleIds: readonly string[]): boolean {
	return isMappedPathEnabled(pathname, enabledModuleIds, MODULE_PATH_MAPPINGS);
}

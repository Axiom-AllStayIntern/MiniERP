import type { AuthRole } from './config';

const roleRank: Record<AuthRole, number> = {
	employee: 1,
	hr: 2,
	project_manager: 2,
	finance: 3,
	owner: 4
};

const MODULES_BY_ROLE: Record<AuthRole, readonly string[]> = {
	owner: ['finance', 'document-intake', 'project', 'hr', 'business-partner', 'core'],
	finance: ['finance', 'document-intake'],
	project_manager: ['project'],
	hr: ['hr'],
	employee: ['project']
};

const DEFAULT_PATH_BY_ROLE: Record<AuthRole, string> = {
	owner: '/finance/dashboard',
	finance: '/finance/dashboard',
	project_manager: '/projects',
	hr: '/hr/employees',
	employee: '/projects'
};

export function hasAtLeastRole(current: AuthRole, required: AuthRole): boolean {
	return roleRank[current] >= roleRank[required];
}

export function roleAllowedModuleIds(role: AuthRole): readonly string[] {
	return MODULES_BY_ROLE[role];
}

export function canRoleAccessModule(role: AuthRole, moduleId: string): boolean {
	return MODULES_BY_ROLE[role].includes(moduleId);
}

export function defaultPathForRole(role: AuthRole): string {
	return DEFAULT_PATH_BY_ROLE[role];
}

export function isRouteAllowed(pathname: string, role: AuthRole): boolean {
	if (pathname.startsWith('/api/finance/tax') || pathname.startsWith('/api/settings')) {
		return role === 'owner' || role === 'finance';
	}
	if (pathname.startsWith('/api/employees')) {
		return role === 'owner' || role === 'hr' || role === 'project_manager' || role === 'finance';
	}
	if (pathname.startsWith('/settings')) return role === 'owner';
	if (pathname.startsWith('/finance/tax')) return role === 'owner' || role === 'finance';
	if (pathname.startsWith('/hr/employees')) return role === 'owner' || role === 'hr';
	return true;
}

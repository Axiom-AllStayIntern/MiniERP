import type { AuthRole } from './config';

const roleRank: Record<AuthRole, number> = {
	employee: 1,
	project_manager: 2,
	finance: 3,
	owner: 4
};

export function hasAtLeastRole(current: AuthRole, required: AuthRole): boolean {
	return roleRank[current] >= roleRank[required];
}

export function isRouteAllowed(pathname: string, role: AuthRole): boolean {
	if (pathname.startsWith('/api/tax') || pathname.startsWith('/api/settings')) {
		return role === 'owner' || role === 'finance';
	}
	if (pathname.startsWith('/api/employees')) {
		return role !== 'employee';
	}
	if (pathname.startsWith('/settings')) return role === 'owner' || role === 'finance';
	if (pathname.startsWith('/tax')) return role === 'owner' || role === 'finance';
	if (pathname.startsWith('/employees')) return role !== 'employee';
	return true;
}

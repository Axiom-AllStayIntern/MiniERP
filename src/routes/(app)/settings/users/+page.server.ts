import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createModuleContext } from '$platform/modules';
import { UserRepository } from '$platform/auth/user-repository';
import { AuditRepository } from '$platform/audit/audit-repository';
import { parseRoles, authRoles, type AuthRole } from '$platform/auth/config';

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user || !user.roles.some((r) => r === 'owner' || r === 'admin')) {
		throw redirect(303, '/settings');
	}

	const ctx = await createModuleContext(event);
	const repo = new UserRepository(ctx.db);
	const rawUsers = await repo.listAllUsers();

	const users = rawUsers.map((u) => ({
		...u,
		roles: parseRoles(u.role),
		isActive: !u.deletedAt
	}));

	return { users, allRoles: [...authRoles] };
};

export const actions: Actions = {
	updateRoles: async (event) => {
		const user = event.locals.user;
		if (!user || !user.roles.some((r) => r === 'owner' || r === 'admin')) {
			return fail(403, { message: 'Forbidden' });
		}

		const form = await event.request.formData();
		const targetUserId = form.get('userId') as string;
		const selectedRoles = form.getAll('role').filter((v): v is string => typeof v === 'string') as AuthRole[];

		if (!targetUserId) return fail(400, { message: 'User ID required' });
		if (selectedRoles.length === 0) return fail(400, { message: 'At least one role is required' });

		const invalid = selectedRoles.filter((r) => !authRoles.includes(r as AuthRole));
		if (invalid.length > 0) return fail(400, { message: `Invalid roles: ${invalid.join(', ')}` });

		if (targetUserId === user.id && !selectedRoles.includes('owner') && user.roles.includes('owner')) {
			return fail(400, { message: 'Cannot remove your own owner role' });
		}

		const ctx = await createModuleContext(event);
		const repo = new UserRepository(ctx.db);
		const targetUser = await repo.findById(targetUserId);
		if (!targetUser) return fail(404, { message: 'User not found' });

		const oldRoles = parseRoles(targetUser.role);
		await repo.updateRoles(targetUserId, selectedRoles);

		const audit = new AuditRepository(ctx.db);
		await audit.writeLog(user, {
			action: 'user.roles_changed',
			entityType: 'user',
			entityId: targetUserId,
			module: 'core',
			actionType: 'permission_change',
			ipAddress: event.getClientAddress(),
			oldValue: { roles: oldRoles },
			newValue: { roles: selectedRoles },
			metadata: { oldRoles, newRoles: selectedRoles }
		});

		return { saved: true, message: 'Roles updated successfully.' };
	},

	deactivate: async (event) => {
		const user = event.locals.user;
		if (!user || !user.roles.some((r) => r === 'owner' || r === 'admin')) {
			return fail(403, { message: 'Forbidden' });
		}

		const form = await event.request.formData();
		const targetUserId = form.get('userId') as string;
		if (!targetUserId) return fail(400, { message: 'User ID required' });
		if (targetUserId === user.id) return fail(400, { message: 'Cannot deactivate yourself' });

		const ctx = await createModuleContext(event);
		const repo = new UserRepository(ctx.db);
		await repo.deactivate(targetUserId);

		const audit = new AuditRepository(ctx.db);
		await audit.writeLog(user, {
			action: 'user.deactivated',
			entityType: 'user',
			entityId: targetUserId,
			module: 'core',
			actionType: 'permission_change',
			ipAddress: event.getClientAddress()
		});

		return { saved: true, message: 'User deactivated.' };
	},

	reactivate: async (event) => {
		const user = event.locals.user;
		if (!user || !user.roles.some((r) => r === 'owner' || r === 'admin')) {
			return fail(403, { message: 'Forbidden' });
		}

		const form = await event.request.formData();
		const targetUserId = form.get('userId') as string;
		if (!targetUserId) return fail(400, { message: 'User ID required' });

		const ctx = await createModuleContext(event);
		const repo = new UserRepository(ctx.db);
		await repo.reactivate(targetUserId);

		const audit = new AuditRepository(ctx.db);
		await audit.writeLog(user, {
			action: 'user.reactivated',
			entityType: 'user',
			entityId: targetUserId,
			module: 'core',
			actionType: 'permission_change',
			ipAddress: event.getClientAddress()
		});

		return { saved: true, message: 'User reactivated.' };
	}
};

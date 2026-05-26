import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createModuleContext } from '$platform/modules';
import { InviteCodeRepository } from '$platform/auth/invite-code-repository';
import { AuditRepository } from '$platform/audit/audit-repository';
import { parseRoles, authRoles, type AuthRole } from '$platform/auth/config';

function generateCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user || !user.roles.some((r) => r === 'owner' || r === 'admin')) {
		throw redirect(303, '/settings');
	}

	const ctx = await createModuleContext(event);
	const repo = new InviteCodeRepository(ctx.db);
	const rawInvites = await repo.listAll();

	const now = new Date().toISOString();
	const invites = rawInvites.map((inv) => ({
		...inv,
		roles: parseRoles(inv.roles),
		isExpired: inv.expiresAt < now,
		isFullyUsed: inv.useCount >= inv.maxUses
	}));

	return { invites, allRoles: [...authRoles] };
};

export const actions: Actions = {
	generate: async (event) => {
		const user = event.locals.user;
		if (!user || !user.roles.some((r) => r === 'owner' || r === 'admin')) {
			return fail(403, { message: 'Forbidden' });
		}

		const form = await event.request.formData();
		const selectedRoles = form
			.getAll('role')
			.filter((v): v is string => typeof v === 'string') as AuthRole[];
		const label = (form.get('label') as string)?.trim() || null;
		const expiresInDays = parseInt((form.get('expiresInDays') as string) || '7', 10);

		if (selectedRoles.length === 0) return fail(400, { message: 'Select at least one role' });

		const invalid = selectedRoles.filter((r) => !authRoles.includes(r as AuthRole));
		if (invalid.length > 0) return fail(400, { message: `Invalid roles: ${invalid.join(', ')}` });

		const ctx = await createModuleContext(event);
		const repo = new InviteCodeRepository(ctx.db);
		const audit = new AuditRepository(ctx.db);

		const now = new Date();
		const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
		const code = generateCode();
		const id = crypto.randomUUID();

		await repo.create({
			id,
			code,
			roles: JSON.stringify(selectedRoles),
			createdBy: user.id,
			expiresAt: expiresAt.toISOString(),
			maxUses: 1,
			useCount: 0,
			label
		});

		await audit.writeLog(user, {
			action: 'invite_code.created',
			entityType: 'invite_code',
			entityId: id,
			metadata: { roles: selectedRoles, expiresAt: expiresAt.toISOString(), label }
		});

		return { saved: true, message: `Invite code generated: ${code}`, generatedCode: code };
	},

	revoke: async (event) => {
		const user = event.locals.user;
		if (!user || !user.roles.some((r) => r === 'owner' || r === 'admin')) {
			return fail(403, { message: 'Forbidden' });
		}

		const form = await event.request.formData();
		const codeId = form.get('codeId') as string;
		if (!codeId) return fail(400, { message: 'Code ID required' });

		const ctx = await createModuleContext(event);
		const repo = new InviteCodeRepository(ctx.db);
		await repo.softDelete(codeId);

		const audit = new AuditRepository(ctx.db);
		await audit.writeLog(user, {
			action: 'invite_code.revoked',
			entityType: 'invite_code',
			entityId: codeId
		});

		return { saved: true, message: 'Invite code revoked.' };
	}
};

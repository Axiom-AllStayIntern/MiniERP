import { and, eq, isNull } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import type { AuthRole } from '$lib/server/auth/config';
import { createSessionCookie } from '$lib/server/auth/session';
import { getDb, schema } from '$lib/server/modules/legacy-db';

const allowedRoles: AuthRole[] = ['owner', 'finance', 'project_manager', 'employee'];

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, platform, cookies, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const name = String(form.get('name') ?? '').trim();
		const roleInput = String(form.get('role') ?? 'employee') as AuthRole;

		if (!email || !name) {
			return fail(400, { message: 'Name and email are required.' });
		}
		if (!allowedRoles.includes(roleInput)) {
			return fail(400, { message: 'Invalid role selected.' });
		}

		const db = getDb(platform.env);
		const [existing] = await db
			.select()
			.from(schema.users)
			.where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
			.limit(1);

		const now = new Date().toISOString();
		if (existing) {
			await db
				.update(schema.users)
				.set({
					name,
					role: roleInput,
					updatedAt: now
				})
				.where(eq(schema.users.id, existing.id));
		} else {
			await db.insert(schema.users).values({
				id: crypto.randomUUID(),
				email,
				name,
				role: roleInput,
				createdAt: now,
				updatedAt: now
			});
		}

		const [user] = await db
			.select()
			.from(schema.users)
			.where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
			.limit(1);
		if (!user) return fail(500, { message: 'Unable to create login session.' });

		const secret = (platform.env.BETTER_AUTH_SECRET as string | undefined) || 'local-dev-secret';
		await createSessionCookie(
			cookies,
			{ userId: user.id, email: user.email, role: user.role as AuthRole },
			secret
		);

		await writeAuditLog(platform, locals.user, {
			action: 'auth.login',
			entityType: 'user',
			entityId: user.id,
			metadata: { email: user.email, role: user.role }
		});

		throw redirect(303, '/dashboard');
	}
};

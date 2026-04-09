import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';

export const actions: Actions = {
	default: async ({ request, platform }) => {
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? 'full_time');
		const status = String(form.get('status') ?? 'active');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const contact = String(form.get('contact') ?? '').trim();
		const taxId = String(form.get('taxId') ?? '').trim();

		if (!name) {
			return fail(400, { message: 'Employee name is required.' });
		}

		const id = crypto.randomUUID();
		const db = getDb(platform.env);
		await db.insert(schema.employees).values({
			id,
			name,
			type: type as (typeof schema.employees.$inferInsert)['type'],
			status,
			startDate: startDate || null,
			endDate: endDate || null,
			contact: contact || null,
			taxId: taxId || null,
			metadata: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		throw redirect(303, `/employees/${id}`);
	}
};

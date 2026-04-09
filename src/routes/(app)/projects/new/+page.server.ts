import { desc, isNull } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform) {
		return { customers: [] };
	}

	const db = getDb(platform.env);
	const customers = await db
		.select({ id: schema.customers.id, name: schema.customers.name })
		.from(schema.customers)
		.where(isNull(schema.customers.deletedAt))
		.orderBy(desc(schema.customers.createdAt));

	return { customers };
};

export const actions: Actions = {
	default: async ({ request, platform }) => {
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await request.formData();
		const customerId = String(form.get('customerId') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const status = String(form.get('status') ?? 'active');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const description = String(form.get('description') ?? '').trim();

		if (!customerId || !name) {
			return fail(400, { message: 'Customer and project name are required.' });
		}

		const id = crypto.randomUUID();
		const db = getDb(platform.env);
		await db.insert(schema.projects).values({
			id,
			customerId,
			name,
			status,
			startDate: startDate || null,
			endDate: endDate || null,
			description: description || null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		throw redirect(303, `/projects/${id}`);
	}
};

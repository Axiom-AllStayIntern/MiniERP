import { and, desc, eq, isNull } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');
	const db = getDb(platform.env);
	const [project] = await db
		.select({ id: schema.projects.id, name: schema.projects.name })
		.from(schema.projects)
		.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)))
		.limit(1);
	if (!project) throw error(404, 'Project not found');

	const expenses = await db
		.select()
		.from(schema.expenses)
		.where(and(eq(schema.expenses.projectId, params.id), isNull(schema.expenses.deletedAt)))
		.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt));

	return { project, expenses };
};

export const actions: Actions = {
	create: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const category = String(form.get('category') ?? '').trim();
		const subcategory = String(form.get('subcategory') ?? '').trim();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');
		const staffName = String(form.get('staffName') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim();

		if (!category || !date) return fail(400, { message: '费用类别和日期必填。' });

		const db = getDb(platform.env);
		await db.insert(schema.expenses).values({
			id: crypto.randomUUID(),
			projectId: params.id,
			category,
			subcategory: subcategory || null,
			amount: Number.isFinite(amount) ? amount : 0,
			currency,
			date,
			staffName: staffName || null,
			fileUrl: null,
			ocrData: null,
			metadata: notes ? JSON.stringify({ notes }) : null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
		return { ok: true };
	}
};

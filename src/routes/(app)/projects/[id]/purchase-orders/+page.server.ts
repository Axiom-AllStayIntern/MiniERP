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

	const purchaseOrders = await db
		.select()
		.from(schema.purchaseOrders)
		.where(and(eq(schema.purchaseOrders.projectId, params.id), isNull(schema.purchaseOrders.deletedAt)))
		.orderBy(desc(schema.purchaseOrders.createdAt));

	return { project, purchaseOrders };
};

export const actions: Actions = {
	create: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const poNumberInput = String(form.get('poNumber') ?? '').trim();
		const poNumber = poNumberInput || `PO-${Date.now().toString().slice(-8)}`;
		const supplierName = String(form.get('supplierName') ?? '').trim();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');

		if (!supplierName) return fail(400, { message: '供应商名称必填。' });

		const db = getDb(platform.env);
		await db.insert(schema.purchaseOrders).values({
			id: crypto.randomUUID(),
			projectId: params.id,
			poNumber,
			fileUrl: null,
			supplierName,
			amount: Number.isFinite(amount) ? amount : 0,
			currency,
			date: date || null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		return { ok: true };
	}
};

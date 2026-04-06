import { and, eq, isNull } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { buildDocumentMetadata, parseDocumentMetadata } from '$lib/server/document-metadata';
import { getDb, schema } from '$lib/server/db';
import { r2FileUrls } from '$lib/server/r2-file-urls';

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);
	const [purchaseOrder] = await db
		.select()
		.from(schema.purchaseOrders)
		.where(
			and(
				eq(schema.purchaseOrders.id, params.purchaseOrderId),
				eq(schema.purchaseOrders.projectId, params.id),
				isNull(schema.purchaseOrders.deletedAt)
			)
		)
		.limit(1);

	if (!purchaseOrder) throw error(404, 'Purchase order not found');

	const docMeta = parseDocumentMetadata(purchaseOrder.metadata);
	const { fileViewUrl, fileDownloadUrl } = r2FileUrls(purchaseOrder.fileUrl);

	return { purchaseOrder, docMeta, fileViewUrl, fileDownloadUrl };
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const poNumber = String(form.get('poNumber') ?? '').trim();
		const supplierName = String(form.get('supplierName') ?? '').trim();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');
		const notes = String(form.get('notes') ?? '').trim();

		if (!poNumber || !supplierName) {
			return fail(400, { message: 'PO number and supplier name are required.' });
		}

		const db = getDb(platform.env);
		const [current] = await db
			.select({ metadata: schema.purchaseOrders.metadata })
			.from(schema.purchaseOrders)
			.where(
				and(
					eq(schema.purchaseOrders.id, params.purchaseOrderId),
					eq(schema.purchaseOrders.projectId, params.id),
					isNull(schema.purchaseOrders.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: notes || undefined
		});

		await db
			.update(schema.purchaseOrders)
			.set({
				poNumber,
				supplierName,
				amount: Number.isFinite(amount) ? amount : 0,
				currency,
				date: date || null,
				metadata,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.purchaseOrders.id, params.purchaseOrderId),
					eq(schema.purchaseOrders.projectId, params.id),
					isNull(schema.purchaseOrders.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'purchase_order.update',
			entityType: 'purchase_order',
			entityId: params.purchaseOrderId,
			projectId: params.id,
			metadata: { poNumber }
		});

		return { ok: true };
	},
	delete: async ({ params, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.purchaseOrders)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.purchaseOrders.id, params.purchaseOrderId),
					eq(schema.purchaseOrders.projectId, params.id),
					isNull(schema.purchaseOrders.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'purchase_order.delete',
			entityType: 'purchase_order',
			entityId: params.purchaseOrderId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}`);
	}
};

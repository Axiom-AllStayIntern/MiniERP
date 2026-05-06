import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createCoreApi } from '$platform/core';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../../../../modules/finance';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent } = event;
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const { documents } = createFinanceApi(ctx);
	const detail = await documents.getPurchaseOrderDocumentDetail(params.id, params.purchaseOrderId);
	if (!detail) throw error(404, 'Purchase order not found');

	return detail;
};

export const actions: Actions = {
	update: async (event) => {
		const { params, request, platform, locals } = event;
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

		const ctx = await createModuleContext(event);
		const { documents } = createFinanceApi(ctx);
		await documents.updatePurchaseOrderDocument(params.id, params.purchaseOrderId, {
			poNumber,
			supplierName,
			amount,
			currency,
			date,
			notes
		});

		await createCoreApi(ctx).writeAuditLog({
			action: 'purchase_order.update',
			entityType: 'purchase_order',
			entityId: params.purchaseOrderId,
			projectId: params.id,
			metadata: { poNumber }
		});

		return { ok: true };
	},
	delete: async (event) => {
		const { params, platform, locals } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const ctx = await createModuleContext(event);
		const { documents } = createFinanceApi(ctx);
		await documents.deletePurchaseOrderDocument(params.id, params.purchaseOrderId);

		await createCoreApi(ctx).writeAuditLog({
			action: 'purchase_order.delete',
			entityType: 'purchase_order',
			entityId: params.purchaseOrderId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}/documents`);
	}
};


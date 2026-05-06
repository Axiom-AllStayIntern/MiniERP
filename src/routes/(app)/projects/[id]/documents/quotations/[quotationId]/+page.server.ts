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
	const detail = await documents.getQuotationDocumentDetail(params.id, params.quotationId);
	if (!detail) throw error(404, 'Quotation not found');

	return detail;
};

export const actions: Actions = {
	update: async (event) => {
		const { params, request, platform, locals } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const quotationNumber = String(form.get('quotationNumber') ?? '').trim();
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');
		const notes = String(form.get('notes') ?? '');

		const ctx = await createModuleContext(event);
		const { documents } = createFinanceApi(ctx);
		await documents.updateQuotationDocument(params.id, params.quotationId, {
			quotationNumber,
			amount,
			currency,
			date,
			notes
		});

		await createCoreApi(ctx).writeAuditLog({
			action: 'quotation.update',
			entityType: 'quotation',
			entityId: params.quotationId,
			projectId: params.id
		});

		return { ok: true };
	},
	delete: async (event) => {
		const { params, platform, locals } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const ctx = await createModuleContext(event);
		const { documents } = createFinanceApi(ctx);
		await documents.deleteQuotationDocument(params.id, params.quotationId);

		await createCoreApi(ctx).writeAuditLog({
			action: 'quotation.delete',
			entityType: 'quotation',
			entityId: params.quotationId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}/documents`);
	}
};


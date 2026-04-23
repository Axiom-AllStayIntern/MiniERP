import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { createModuleContext } from '$lib/server/modules';
import { createArApi } from '$lib/server/modules/ar/api';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent } = event;
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const ar = createArApi(ctx);
	const detail = await ar.getContractDocumentDetail(params.id, params.contractId);
	if (!detail) throw error(404, 'Contract not found');

	return detail;
};

export const actions: Actions = {
	update: async (event) => {
		const { params, request, platform, locals } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');
		const notes = String(form.get('notes') ?? '').trim();

		const ctx = await createModuleContext(event);
		const ar = createArApi(ctx);
		await ar.updateContractDocument(params.id, params.contractId, {
			amount,
			currency,
			date,
			notes
		});

		await writeAuditLog(platform, locals.user, {
			action: 'contract.update',
			entityType: 'contract',
			entityId: params.contractId,
			projectId: params.id
		});

		return { ok: true };
	},
	delete: async (event) => {
		const { params, platform, locals } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const ctx = await createModuleContext(event);
		const ar = createArApi(ctx);
		await ar.deleteContractDocument(params.id, params.contractId);

		await writeAuditLog(platform, locals.user, {
			action: 'contract.delete',
			entityType: 'contract',
			entityId: params.contractId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}/documents`);
	}
};

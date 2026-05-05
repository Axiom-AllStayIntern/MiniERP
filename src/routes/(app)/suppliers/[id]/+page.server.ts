import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createBusinessPartnerApi } from '$modules/legacy/server-modules/business-partner/api';
import { createModuleContext } from '$platform/modules';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) throw error(500, 'Cloudflare platform bindings are required');
	const ctx = await createModuleContext(event);
	const bp = createBusinessPartnerApi(ctx);
	const detail = await bp.getSupplierDetail(event.params.id);
	if (!detail?.supplier) throw error(404, 'Supplier not found');
	return {
		supplier: detail.supplier,
		contacts: detail.contacts
	};
};

export const actions: Actions = {
	update: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const address = String(form.get('address') ?? '').trim();
		const contact = String(form.get('contact') ?? '').trim();
		const itemDescription = String(form.get('itemDescription') ?? '').trim();
		const dateCreate = String(form.get('dateCreate') ?? '').trim();
		const projectRelated = String(form.get('projectRelated') ?? '').trim();
		const gstRegNo = String(form.get('gstRegNo') ?? '').trim();
		const contactNames = form.getAll('contactName').map((v) => String(v ?? '').trim());
		const contactPhoneEmails = form.getAll('contactPhoneEmail').map((v) => String(v ?? '').trim());
		const contactWechats = form.getAll('contactWechat').map((v) => String(v ?? '').trim());
		const contactPositions = form.getAll('contactPosition').map((v) => String(v ?? '').trim());
		if (!name) return fail(400, { message: 'Supplier name is required.' });
		const contacts = contactNames
			.map((contactName, i) => ({
				name: contactName,
				phoneEmail: contactPhoneEmails[i] || undefined,
				wechat: contactWechats[i] || undefined,
				position: contactPositions[i] || undefined
			}))
			.filter((c) => c.name);
		const ctx = await createModuleContext(event);
		const bp = createBusinessPartnerApi(ctx);
		await bp.updateSupplierWithContacts(event.params.id, {
			name,
			address: address || undefined,
			contact: contact || undefined,
			itemDescription: itemDescription || undefined,
			dateCreate: dateCreate || undefined,
			projectRelated: projectRelated || undefined,
			gstRegNo: gstRegNo || undefined,
			contacts
		});
		throw redirect(303, `/suppliers/${event.params.id}`);
	}
};



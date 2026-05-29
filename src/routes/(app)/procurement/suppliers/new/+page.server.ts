import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

import { createProcurementApi } from '$modules/procurement';
import { createModuleContext } from '$platform/modules';

export const actions: Actions = {
	default: async (event) => {
		if (!event.platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

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

		const contacts = contactNames
			.map((contactName, i) => ({
				name: contactName,
				phoneEmail: contactPhoneEmails[i] || undefined,
				wechat: contactWechats[i] || undefined,
				position: contactPositions[i] || undefined
			}))
			.filter((c) => c.name);

		if (!name) {
			return fail(400, { message: 'Supplier name is required.' });
		}

		const ctx = await createModuleContext(event);
		const procurement = createProcurementApi(ctx);
		await procurement.createSupplier({
			name,
			address: address || undefined,
			contact: contact || undefined,
			itemDescription: itemDescription || undefined,
			dateCreate: dateCreate || undefined,
			projectRelated: projectRelated || undefined,
			gstRegNo: gstRegNo || undefined,
			contacts
		});

		throw redirect(303, '/procurement/suppliers');
	}
};


import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createBusinessPartnerApi } from '$lib/server/modules/business-partner/api';

export const actions: Actions = {
	default: async (event) => {
		if (!event.platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const address = String(form.get('address') ?? '').trim();
		const contact = String(form.get('contact') ?? '').trim();
		const gstRegNo = String(form.get('gstRegNo') ?? '').trim();

		if (!name) {
			return fail(400, { message: 'Customer name is required.' });
		}

		const ctx = await createModuleContext(event);
		const businessPartner = createBusinessPartnerApi(ctx);
		await businessPartner.createCustomer({
			name,
			address: address || undefined,
			contact: contact || undefined,
			gstRegNo: gstRegNo || undefined,
			metadata: undefined
		});

		throw redirect(303, '/customers');
	}
};

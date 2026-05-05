import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
import { createBusinessPartnerApi } from '$modules/legacy/server-modules/business-partner/api';
import { createProjectApi } from '../../../../modules/project';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) {
		return { customers: [] };
	}

	const ctx = await createModuleContext(event);
	const businessPartner = createBusinessPartnerApi(ctx);
	return { customers: await businessPartner.listCustomerOptions() };
};

export const actions: Actions = {
	default: async (event) => {
		if (!event.platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await event.request.formData();
		const customerId = String(form.get('customerId') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const status = String(form.get('status') ?? 'active');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const description = String(form.get('description') ?? '').trim();

		if (!customerId || !name) {
			return fail(400, { message: 'Customer and project name are required.' });
		}

		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);
		const created = await project.create({
			customerId,
			name,
			status,
			startDate: startDate || undefined,
			endDate: endDate || undefined,
			description: description || undefined
		});

		throw redirect(303, `/projects/${created.id}`);
	}
};


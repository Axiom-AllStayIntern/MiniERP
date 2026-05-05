import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

import { createModuleContext } from '$platform/modules';
import { createEmployeeApi } from '../../../../modules/hr';

export const actions: Actions = {
	default: async (event) => {
		if (!event.platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? 'full_time');
		const status = String(form.get('status') ?? 'active');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const contact = String(form.get('contact') ?? '').trim();
		const taxId = String(form.get('taxId') ?? '').trim();

		if (!name) {
			return fail(400, { message: 'Employee name is required.' });
		}

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.createEmployeeProfile({
			name,
			type,
			status,
			startDate,
			endDate,
			contact,
			taxId
		});

		throw redirect(303, `/employees/${result.id}`);
	}
};


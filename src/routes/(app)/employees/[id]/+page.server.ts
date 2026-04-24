import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createEmployeeApi } from '../../../../modules/hr';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const employee = createEmployeeApi(ctx);
	const page = await employee.getEmployeeDetailPage(event.params.id, event.url.searchParams.get('taxYear'));
	if (!page) throw error(404, 'Employee not found');

	return page;
};

export const actions: Actions = {
	updateProfile: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? 'full_time');
		const status = String(form.get('status') ?? 'active');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const contact = String(form.get('contact') ?? '').trim();
		const taxId = String(form.get('taxId') ?? '').trim();
		const taxResidentLabel = String(form.get('taxResidentLabel') ?? '').trim();
		const cpfApplicable = form.get('cpfApplicable') === 'on';

		if (!name) return fail(400, { message: 'Employee name is required.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		await employee.updateEmployeeProfile(event.params.id, {
			name,
			type,
			status,
			startDate,
			endDate,
			contact,
			taxId,
			taxResidentLabel,
			cpfApplicable
		});

		return { ok: true, profileUpdated: true as const };
	},
	addCompanyComponent: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await event.request.formData();
		const label = String(form.get('label') ?? '').trim();
		const incomeType = String(form.get('incomeType') ?? 'salary');
		const ruleType = String(form.get('ruleType') ?? 'fixed');
		const value = Number.parseFloat(String(form.get('value') ?? '0'));
		const frequency = String(form.get('frequency') ?? 'monthly');
		const effectiveFrom = String(form.get('effectiveFrom') ?? '').trim();
		const taxable = form.get('taxable') === 'on';

		if (!label) return fail(400, { message: 'Component label is required.' });
		if (!effectiveFrom) return fail(400, { message: 'Effective from date is required.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		await employee.addCompanyComponent(event.params.id, {
			label,
			incomeType,
			ruleType,
			value,
			frequency,
			effectiveFrom,
			taxable
		});

		return { ok: true };
	},
	removeCompanyComponent: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await event.request.formData();
		const componentId = String(form.get('componentId') ?? '');
		if (!componentId) return fail(400, { message: 'Missing component id.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		await employee.removeCompanyComponent(event.params.id, componentId);

		return { ok: true };
	},
	saveAllocations: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await event.request.formData();
		const effectiveFrom = String(form.get('effectiveFrom') ?? '').trim() || new Date().toISOString().slice(0, 10);
		const weightsByProjectId: Record<string, string> = {};
		for (const [key, value] of form.entries()) {
			if (key.startsWith('w_')) {
				weightsByProjectId[key.slice(2)] = String(value);
			}
		}

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.saveEmployeeProjectAllocations(event.params.id, {
			effectiveFrom,
			weightsByProjectId
		});
		if (!result.ok) {
			return fail(400, { message: result.message });
		}

		return { ok: true };
	},
	deleteEmployee: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		await employee.deleteEmployee(event.params.id);

		throw redirect(303, '/employees');
	}
};

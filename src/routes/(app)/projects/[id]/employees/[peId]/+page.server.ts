import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
import { createEmployeeApi } from '../../../../../../modules/hr';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent, url } = event;
	const parentData = await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const employee = createEmployeeApi(ctx);
	const detail = await employee.getProjectStaffingDetailPage(
		params.id,
		params.peId,
		url.searchParams.get('month')
	);

	if (!detail) throw error(404, 'Project assignment not found');

	return {
		project: parentData.project,
		...detail
	};
};

export const actions: Actions = {
	updateAssignment: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const role = String(form.get('role') ?? '').trim() || null;
		const staffType = String(form.get('staffType') ?? 'fulltime');
		const dateIn = String(form.get('dateIn') ?? '').trim() || null;
		const dateOut = String(form.get('dateOut') ?? '').trim() || null;
		const cpfApplicable = form.get('cpfApplicable') === 'on';

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.updateProjectStaffingAssignment(params.id, params.peId, {
			role,
			staffType,
			dateIn,
			dateOut,
			cpfApplicable
		});

		if (!result.ok) return fail(400, { message: result.message });
		return { ok: true };
	},
	addProjectComponent: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const label = String(form.get('label') ?? '').trim();
		const incomeType = String(form.get('incomeType') ?? 'bonus');
		const ruleType = String(form.get('ruleType') ?? 'manual');
		const value = Number.parseFloat(String(form.get('value') ?? '0'));
		const frequency = String(form.get('frequency') ?? 'one_off');
		const effectiveFrom = String(form.get('effectiveFrom') ?? '').trim();
		const taxable = form.get('taxable') === 'on';

		if (!label) return fail(400, { message: 'Label is required.' });
		if (!effectiveFrom) return fail(400, { message: 'Effective from is required.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.addManualProjectStaffingComponent(params.id, params.peId, {
			label,
			incomeType,
			ruleType,
			value,
			frequency,
			effectiveFrom,
			taxable
		});

		if (!result.ok) return fail(400, { message: result.message });
		return { ok: true };
	},
	removeProjectComponent: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const componentId = String(form.get('componentId') ?? '');
		if (!componentId) return fail(400, { message: 'Missing component id.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		await employee.removeManualProjectStaffingComponent(params.peId, componentId);

		return { ok: true };
	},
	settleCompanyAllocation: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const monthYm = String(form.get('monthYm') ?? '').trim();
		if (!/^\d{4}-\d{2}$/.test(monthYm)) return fail(400, { message: 'Select a month to settle.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.settleProjectStaffingCompanyAllocation(params.id, params.peId, monthYm);

		if (!result.ok) return fail(400, { message: result.message });

		return {
			ok: true,
			message: `Recorded ${result.lines} allocated line(s) for ${monthYm} (confirmed, staff cost).`
		};
	},
	settleProjectComponents: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const monthYm = String(form.get('monthYm') ?? '').trim();
		if (!/^\d{4}-\d{2}$/.test(monthYm)) return fail(400, { message: 'Select a month to settle.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.settleProjectStaffingComponents(params.id, params.peId, monthYm);

		if (!result.ok) return fail(400, { message: result.message });

		return {
			ok: true,
			message: result.message
		};
	}
};


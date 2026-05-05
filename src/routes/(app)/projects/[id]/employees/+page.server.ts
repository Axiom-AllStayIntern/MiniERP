import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
import { createEmployeeApi } from '../../../../../modules/hr';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent, url } = event;
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const employee = createEmployeeApi(ctx);
	return employee.getProjectStaffingPage(params.id, url.searchParams.get('month'));
};

export const actions: Actions = {
	settleAllForMonth: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const monthYm = String(form.get('monthYm') ?? '').trim();
		if (!/^\d{4}-\d{2}$/.test(monthYm)) return fail(400, { message: 'Select a month.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		return employee.settleAllProjectStaffForMonth(params.id, monthYm);
	},
	addToProject: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const employeeId = String(form.get('employeeId') ?? '');
		const role = String(form.get('role') ?? '').trim() || null;
		const staffType = String(form.get('staffType') ?? 'fulltime');
		const dateIn = String(form.get('dateIn') ?? '').trim() || null;
		const dateOut = String(form.get('dateOut') ?? '').trim() || null;

		if (!employeeId) return fail(400, { message: 'Choose an employee.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.addProjectStaffingMember(params.id, {
			employeeId,
			role,
			staffType,
			dateIn,
			dateOut
		});

		if (!result.ok) return fail(400, { message: result.message });
		return { ok: true };
	},
	removeFromProject: async (event) => {
		const { params, request, platform } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const peId = String(form.get('peId') ?? '');
		if (!peId) return fail(400, { message: 'Missing assignment id.' });

		const ctx = await createModuleContext(event);
		const employee = createEmployeeApi(ctx);
		const result = await employee.removeProjectStaffingMember(params.id, peId);

		if (!result.ok) return fail(400, { message: result.message });
		return { ok: true };
	}
};


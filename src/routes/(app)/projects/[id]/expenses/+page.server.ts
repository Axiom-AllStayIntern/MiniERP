import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';

export const load: PageServerLoad = async (event) => {
	const { project } = await event.parent();

	if (!event.platform) {
		return {
			expenses: [],
			employees: [],
			totals: { total: 0, opex: 0, salesCost: 0 },
			businessTrips: []
		};
	}

	const ctx = await createModuleContext(event);
	const { expenses } = createFinanceApi(ctx);
	return { ...(await expenses.getProjectExpensePage(event.params.id, project.name)), project };
};

export const actions: Actions = {
	create: async (event) => {
		if (!event.platform) return fail(500, { error: 'Platform not available' });

		const formData = await event.request.formData();
		const expenseType = (formData.get('expenseType') as string) || 'opex';
		const category = String(formData.get('category') || 'others');
		const amount = Number(formData.get('amount') || 0);
		const currency = String(formData.get('currency') || 'SGD').trim().toUpperCase();
		const date = String(formData.get('date') || new Date().toISOString().slice(0, 10));
		const vendorOrSupplier = String(formData.get('vendorOrSupplier') || '') || null;
		const staffName = String(formData.get('staffName') || '') || null;
		const reimbursement = formData.get('reimbursement') === 'on';
		const businessTrip = formData.get('businessTrip') === 'on';
		const destination = String(formData.get('destination') || '') || null;
		const notes = String(formData.get('notes') || '') || null;

		const ctx = await createModuleContext(event);
		const { expenses } = createFinanceApi(ctx);
		await expenses.create({
			projectId: event.params.id,
			expenseType: expenseType as 'opex' | 'sales_cost',
			category,
			date,
			amount,
			currency,
			vendorOrSupplier,
			staffName,
			reimbursement,
			businessTrip,
			destination,
			notes
		});

		return { success: true };
	},

	createTrip: async (event) => {
		if (!event.platform) return fail(500, { error: 'Platform not available' });

		const formData = await event.request.formData();
		const employeeId = String(formData.get('employeeId'));
		const destination = String(formData.get('destination'));
		const startDate = String(formData.get('startDate'));
		const endDate = String(formData.get('endDate'));
		const dailyAllowanceRate = Number(formData.get('dailyAllowanceRate') || 50);

		if (!employeeId || !destination || !startDate || !endDate) {
			return fail(400, { error: 'Missing required fields' });
		}

		const ctx = await createModuleContext(event);
		const { expenses } = createFinanceApi(ctx);
		const result = await expenses.createBusinessTripWithAllowance({
			projectId: event.params.id,
			employeeId,
			destination,
			startDate,
			endDate,
			dailyAllowanceRate
		});
		if (!result.ok) {
			return fail(400, { error: result.error });
		}

		return { success: true, tripId: result.tripId };
	}
};

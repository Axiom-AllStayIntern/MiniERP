import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '$lib/server/modules/finance';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent } = event;
	const { project } = await parent();

	if (!platform) {
		return {
			revenueRecords: [],
			invoices: [],
			totals: { total: 0, revenue: 0, invoiced: 0 },
			project
		};
	}

	const ctx = await createModuleContext(event);
	const { revenue } = createFinanceApi(ctx);
	const revenuePage = await revenue.getProjectRevenuePage(params.id);

	return {
		...revenuePage,
		project
	};
};

export const actions: Actions = {
	createRevenue: async (event) => {
		const { request, platform, params } = event;
		if (!platform) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const now = new Date().toISOString();

		const invoiceType = (formData.get('invoiceType') as string) || 'standard';
		const invoiceNumber = String(formData.get('invoiceNumber') || '') || null;
		const clientName = String(formData.get('clientName') || '') || null;
		const date = String(formData.get('date') || now.slice(0, 10));
		const amount = Number(formData.get('amount') || 0);
		const currency = String(formData.get('currency') || 'SGD').trim().toUpperCase();
		const gstAmount = Number(formData.get('gstAmount') || 0);
		const notes = String(formData.get('notes') || '') || null;

		const ctx = await createModuleContext(event);
		const { revenue } = createFinanceApi(ctx);
		await revenue.createRevenue({
			invoiceType: invoiceType as 'standard' | 'zero_rate' | 'tax_invoice',
			invoiceNumber,
			clientName,
			projectId: params.id,
			date,
			amount,
			currency,
			gstAmount,
			notes
		});

		return { success: true };
	}
};

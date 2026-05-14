import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

import { createFinanceApi } from '$modules/finance';
import { createModuleContext } from '$platform/modules';

function invoiceNumber() {
	const d = new Date();
	const stamp = d.toISOString().slice(0, 10).replaceAll('-', '');
	return `INV-${stamp}`;
}

export const load: PageServerLoad = async (event) => {
	const defaults = {
		defaultInvoiceNumber: invoiceNumber(),
		defaultDate: new Date().toISOString().slice(0, 10)
	};

	if (!event.platform) {
		return {
			...defaults,
			projects: [],
			preselectProjectId: ''
		};
	}

	const ctx = await createModuleContext(event);
	const page = await createFinanceApi(ctx).revenue.getCustomerInvoiceGeneratePage(
		event.url.searchParams.get('projectId')?.trim() ?? ''
	);

	return { ...defaults, ...page };
};

export const actions: Actions = {
	save: async (event) => {
		const { request, platform } = event;
		if (!platform) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const invoiceType = String(formData.get('invoiceType') || 'standard');
		const invoiceNumber = String(formData.get('invoiceNumber') || '') || null;
		const clientName = String(formData.get('clientName') || '') || null;
		const date = String(formData.get('date') || new Date().toISOString().slice(0, 10));
		const amount = Number(formData.get('amount') || 0);
		const currency = String(formData.get('currency') || 'SGD').trim().toUpperCase();
		const gstAmount = Number(formData.get('gstAmount') || 0);
		const projectId = String(formData.get('projectId') || '') || null;
		const notes = String(formData.get('notes') || '') || null;
		const metadata = String(formData.get('metadata') || '') || null;

		if (!clientName) return fail(400, { error: 'Client name is required.' });
		if (!amount || amount <= 0) return fail(400, { error: 'Amount must be greater than zero.' });

		const ctx = await createModuleContext(event);
		const record = await createFinanceApi(ctx).revenue.createRevenue({
			invoiceType: invoiceType as 'standard' | 'zero_rate' | 'tax_invoice',
			invoiceNumber,
			clientName,
			projectId,
			date,
			amount,
			currency,
			gstAmount,
			metadata,
			notes
		});

		return { success: true, revenueId: record.id };
	}
};

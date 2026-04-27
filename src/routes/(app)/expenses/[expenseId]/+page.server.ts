import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createCoreApi } from '$lib/server/modules/core';
import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '../../../../modules/finance';
import { deleteUploadedFileHashForEntity } from '$lib/server/uploaded-file-hash';

export const load: PageServerLoad = async (event) => {
	const { params, platform } = event;
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const expenses = createFinanceApi(ctx).expenses;
	const detail = await expenses.getStandaloneExpenseDetail(params.expenseId);

	if (!detail) throw error(404, 'Expense not found');

	if (detail.expense.projectId) {
		throw redirect(302, `/projects/${detail.expense.projectId}/documents/expenses/${params.expenseId}`);
	}

	return detail;
};

export const actions: Actions = {
	update: async (event) => {
		const { params, request, platform, locals } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const category = String(form.get('category') ?? '').trim();
		const expenseType = String(form.get('expenseType') ?? 'opex');
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const currency = String(form.get('currency') ?? 'SGD').trim().toUpperCase();
		const date = String(form.get('date') ?? '');
		const staffName = String(form.get('staffName') ?? '').trim();
		const vendorOrSupplier = String(form.get('vendorOrSupplier') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim();

		if (!category || !date) return fail(400, { message: 'Category and date are required.' });

		const ctx = await createModuleContext(event);
		const expenses = createFinanceApi(ctx).expenses;
		const result = await expenses.updateStandaloneExpense(params.expenseId, {
			category,
			expenseType,
			amount,
			currency,
			date,
			staffName,
			vendorOrSupplier,
			notes
		});

		if (!result.ok) {
			const status = result.status === 'not_found' ? 404 : 400;
			return fail(status, { message: result.message });
		}

		await createCoreApi(ctx).writeAuditLog({
			action: 'expense.update',
			entityType: 'expense',
			entityId: params.expenseId,
			projectId: null,
			metadata: { category, expenseType }
		});

		return { ok: true };
	},
	delete: async (event) => {
		const { params, platform, locals } = event;
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const ctx = await createModuleContext(event);
		const expenses = createFinanceApi(ctx).expenses;
		const result = await expenses.softDeleteStandaloneExpense(params.expenseId);

		if (!result.ok) {
			const status = result.status === 'not_found' ? 404 : 400;
			return fail(status, { message: result.message });
		}

		await deleteUploadedFileHashForEntity(platform.env, {
			entityType: 'expense',
			entityId: params.expenseId
		});

		await createCoreApi(ctx).writeAuditLog({
			action: 'expense.delete',
			entityType: 'expense',
			entityId: params.expenseId,
			projectId: null
		});

		throw redirect(303, '/expenses');
	}
};

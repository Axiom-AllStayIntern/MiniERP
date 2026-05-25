import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createCoreApi } from '$platform/core';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../../../../modules/finance';
import { deleteUploadedFileHashForEntity } from '$platform/files/uploaded-file-hash';
import { UserRepository } from '$platform/auth/user-repository';
import { sendTransactionalEmail } from '$platform/auth/email';

async function notifyPrivilegedUsers(
	ctx: { db: import('$infrastructure/db').DBClient; env: Env },
	subject: string,
	body: string
) {
	const repo = new UserRepository(ctx.db);
	const recipients = await repo.findByRoles(['owner', 'finance']);
	await Promise.all(
		recipients.map((u) =>
			sendTransactionalEmail(ctx.env, {
				to: u.email,
				subject,
				text: body,
				html: `<p style="font-family:sans-serif;font-size:14px;color:#374151">${body.replace(/\n/g, '<br>')}</p>`
			})
		)
	);
}

export const load: PageServerLoad = async (event) => {
	await event.parent();
	if (!event.platform) throw error(500, 'Cloudflare platform bindings are required');

	const ctx = await createModuleContext(event);
	const expenses = createFinanceApi(ctx).expenses;
	const detail = await expenses.getProjectExpenseDetail(event.params.id, event.params.expenseId);
	if (!detail) throw error(404, 'Expense not found');

	return detail;
};

export const actions: Actions = {
	update: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await event.request.formData();
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
		await expenses.updateProjectExpense(event.params.id, event.params.expenseId, {
			category,
			expenseType,
			amount,
			currency,
			date,
			staffName,
			vendorOrSupplier,
			notes
		});

		await createCoreApi(ctx).writeAuditLog({
			action: 'expense.update',
			entityType: 'expense',
			entityId: event.params.expenseId,
			projectId: event.params.id,
			metadata: { category, expenseType }
		});

		await notifyPrivilegedUsers(
			ctx,
			`[SmartFin] Expense record updated — Project ${event.params.id}`,
			`An expense record has been modified.\n\nProject: ${event.params.id}\nRecord ID: ${event.params.expenseId}\nModified by: ${ctx.user?.email ?? 'unknown'}\nCategory: ${category} (${expenseType})\nAmount: ${amount} ${currency}\nDate: ${date}`
		);

		return { ok: true };
	},
	delete: async (event) => {
		if (!event.platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const ctx = await createModuleContext(event);
		const expenses = createFinanceApi(ctx).expenses;
		await expenses.softDeleteProjectExpense(event.params.id, event.params.expenseId);
		await deleteUploadedFileHashForEntity(event.platform.env, {
			entityType: 'expense',
			entityId: event.params.expenseId
		});

		await createCoreApi(ctx).writeAuditLog({
			action: 'expense.delete',
			entityType: 'expense',
			entityId: event.params.expenseId,
			projectId: event.params.id
		});

		await notifyPrivilegedUsers(
			ctx,
			`[SmartFin] Expense record deleted — Project ${event.params.id}`,
			`An expense record has been permanently deleted.\n\nProject: ${event.params.id}\nRecord ID: ${event.params.expenseId}\nDeleted by: ${ctx.user?.email ?? 'unknown'}`
		);

		throw redirect(303, `/projects/${event.params.id}/documents`);
	}
};


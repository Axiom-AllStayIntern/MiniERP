import { and, eq, isNull } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { buildDocumentMetadata, parseDocumentMetadata } from '$lib/server/document-metadata';
import { resolveExpenseFilePreview } from '$lib/server/expense-file-preview';
import { getDb, schema } from '$lib/server/modules/legacy-db';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';
import { deleteUploadedFileHashForEntity } from '$lib/server/uploaded-file-hash';

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);
	const [expense] = await db
		.select()
		.from(schema.expenses)
		.where(
			and(
				eq(schema.expenses.id, params.expenseId),
				eq(schema.expenses.projectId, params.id),
				isNull(schema.expenses.deletedAt)
			)
		)
		.limit(1);

	if (!expense) throw error(404, 'Expense not found');

	const docMeta = parseDocumentMetadata(expense.metadata);
	const { fileViewUrl, fileDownloadUrl, previewDisplay } = await resolveExpenseFilePreview(
		db,
		expense.documentRef,
		docMeta
	);

	return { expense, docMeta, fileViewUrl, fileDownloadUrl, previewDisplay };
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
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

		const db = getDb(platform.env);
		const [current] = await db
			.select({ metadata: schema.expenses.metadata })
			.from(schema.expenses)
			.where(
				and(
					eq(schema.expenses.id, params.expenseId),
					eq(schema.expenses.projectId, params.id),
					isNull(schema.expenses.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: notes || undefined
		});

		const amt = Number.isFinite(amount) ? amount : 0;
		const sgdEq = await resolveSgdEquivalentForWrite({ amount: amt, currency, dateYmd: date });

		await db
			.update(schema.expenses)
			.set({
				expenseType: expenseType as 'opex' | 'sales_cost',
				category,
				amount: amt,
				currency,
				sgdEquivalent: sgdEq,
				date,
				staffName: staffName || null,
				vendorOrSupplier: vendorOrSupplier || null,
				metadata,
				notes: notes || null,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.expenses.id, params.expenseId),
					eq(schema.expenses.projectId, params.id),
					isNull(schema.expenses.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'expense.update',
			entityType: 'expense',
			entityId: params.expenseId,
			projectId: params.id,
			metadata: { category, expenseType }
		});

		return { ok: true };
	},
	delete: async ({ params, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.expenses)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.expenses.id, params.expenseId),
					eq(schema.expenses.projectId, params.id),
					isNull(schema.expenses.deletedAt)
				)
			);
		await deleteUploadedFileHashForEntity(platform.env, {
			entityType: 'expense',
			entityId: params.expenseId
		});

		await writeAuditLog(platform, locals.user, {
			action: 'expense.delete',
			entityType: 'expense',
			entityId: params.expenseId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}/documents`);
	}
};

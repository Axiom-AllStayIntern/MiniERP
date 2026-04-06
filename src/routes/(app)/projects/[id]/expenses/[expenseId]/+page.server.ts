import { and, eq, isNull } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { buildDocumentMetadata, parseDocumentMetadata } from '$lib/server/document-metadata';
import { getDb, schema } from '$lib/server/db';
import { r2FileUrls } from '$lib/server/r2-file-urls';

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
	const { fileViewUrl, fileDownloadUrl } = r2FileUrls(expense.fileUrl);

	return { expense, docMeta, fileViewUrl, fileDownloadUrl };
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const category = String(form.get('category') ?? '').trim();
		const subcategory = String(form.get('subcategory') ?? '').trim();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');
		const staffName = String(form.get('staffName') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim();

		if (!category || !date) return fail(400, { message: 'Record ID, expense category, and date are required.' });

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

		await db
			.update(schema.expenses)
			.set({
				category,
				subcategory: subcategory || null,
				amount: Number.isFinite(amount) ? amount : 0,
				currency,
				date,
				staffName: staffName || null,
				metadata,
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
			metadata: { category }
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

		await writeAuditLog(platform, locals.user, {
			action: 'expense.delete',
			entityType: 'expense',
			entityId: params.expenseId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}`);
	}
};

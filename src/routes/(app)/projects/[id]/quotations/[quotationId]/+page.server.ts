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
	const [quotation] = await db
		.select()
		.from(schema.quotations)
		.where(
			and(
				eq(schema.quotations.id, params.quotationId),
				eq(schema.quotations.projectId, params.id),
				isNull(schema.quotations.deletedAt)
			)
		)
		.limit(1);

	if (!quotation) throw error(404, 'Quotation not found');

	const docMeta = parseDocumentMetadata(quotation.metadata);
	const { fileViewUrl, fileDownloadUrl } = r2FileUrls(quotation.fileUrl);

	return { quotation, docMeta, fileViewUrl, fileDownloadUrl };
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const sourceType = String(form.get('sourceType') ?? 'manual');
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');
		const notes = String(form.get('notes') ?? '');

		const db = getDb(platform.env);
		const [current] = await db
			.select({ metadata: schema.quotations.metadata })
			.from(schema.quotations)
			.where(
				and(
					eq(schema.quotations.id, params.quotationId),
					eq(schema.quotations.projectId, params.id),
					isNull(schema.quotations.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: notes || undefined
		});

		await db
			.update(schema.quotations)
			.set({
				sourceType,
				amount: Number.isFinite(amount) ? amount : 0,
				currency,
				date: date || null,
				metadata,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.quotations.id, params.quotationId),
					eq(schema.quotations.projectId, params.id),
					isNull(schema.quotations.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'quotation.update',
			entityType: 'quotation',
			entityId: params.quotationId,
			projectId: params.id
		});

		return { ok: true };
	},
	delete: async ({ params, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.quotations)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.quotations.id, params.quotationId),
					eq(schema.quotations.projectId, params.id),
					isNull(schema.quotations.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'quotation.delete',
			entityType: 'quotation',
			entityId: params.quotationId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}`);
	}
};

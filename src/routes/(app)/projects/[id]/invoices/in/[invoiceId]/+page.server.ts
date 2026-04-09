import { and, eq, isNull } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { DocumentMetadata } from '$lib/server/document-metadata';
import { writeAuditLog } from '$lib/server/audit';
import { getDb, schema } from '$lib/server/modules/legacy-db';
import { r2FileUrls } from '$lib/server/r2-file-urls';

function prettyRawOcr(raw: string | null) {
	if (!raw) return null;
	try {
		return JSON.stringify(JSON.parse(raw), null, 2);
	} catch {
		return raw;
	}
}

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);
	const [invoice] = await db
		.select()
		.from(schema.invoicesIn)
		.where(
			and(
				eq(schema.invoicesIn.id, params.invoiceId),
				eq(schema.invoicesIn.projectId, params.id),
				isNull(schema.invoicesIn.deletedAt)
			)
		)
		.limit(1);

	if (!invoice) throw error(404, 'Supplier invoice not found');

	const { fileViewUrl, fileDownloadUrl } = r2FileUrls(invoice.fileUrl);
	const docMeta: DocumentMetadata = {};
	const notesBlock = prettyRawOcr(invoice.rawOcr);

	return {
		invoice,
		docMeta,
		fileViewUrl,
		fileDownloadUrl,
		notesBlock
	};
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const status = String(form.get('status') ?? '').trim() || 'pending_review';
		const supplierName = String(form.get('supplierName') ?? '').trim();
		const invoiceDate = String(form.get('invoiceDate') ?? '').trim();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const gstAmount = Number.parseFloat(String(form.get('gstAmount') ?? '0'));
		const poNumber = String(form.get('poNumber') ?? '').trim();

		if (!invoiceDate) return fail(400, { message: 'Invoice date is required.' });

		const db = getDb(platform.env);
		await db
			.update(schema.invoicesIn)
			.set({
				status,
				supplierName: supplierName || null,
				invoiceDate,
				amount: Number.isFinite(amount) ? amount : 0,
				gstAmount: Number.isFinite(gstAmount) ? gstAmount : 0,
				poNumber: poNumber || null,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.invoicesIn.id, params.invoiceId),
					eq(schema.invoicesIn.projectId, params.id),
					isNull(schema.invoicesIn.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'invoice_in.update',
			entityType: 'invoice_in',
			entityId: params.invoiceId,
			projectId: params.id
		});

		return { ok: true };
	},
	delete: async ({ params, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.invoicesIn)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.invoicesIn.id, params.invoiceId),
					eq(schema.invoicesIn.projectId, params.id),
					isNull(schema.invoicesIn.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'invoice_in.delete',
			entityType: 'invoice_in',
			entityId: params.invoiceId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}/invoices`);
	}
};

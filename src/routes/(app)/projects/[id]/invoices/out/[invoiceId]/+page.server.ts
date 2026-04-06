import { and, eq, isNull } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { DocumentMetadata } from '$lib/server/document-metadata';
import { writeAuditLog } from '$lib/server/audit';
import { getDb, schema } from '$lib/server/db';
import { r2FileUrls } from '$lib/server/r2-file-urls';

function prettyLineItems(raw: string | null) {
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
		.from(schema.invoicesOut)
		.where(
			and(
				eq(schema.invoicesOut.id, params.invoiceId),
				eq(schema.invoicesOut.projectId, params.id),
				isNull(schema.invoicesOut.deletedAt)
			)
		)
		.limit(1);

	if (!invoice) throw error(404, 'Invoice not found');

	const [customer] = await db
		.select({ name: schema.customers.name })
		.from(schema.customers)
		.where(eq(schema.customers.id, invoice.customerId))
		.limit(1);

	const { fileViewUrl, fileDownloadUrl } = r2FileUrls(invoice.pdfUrl);
	const docMeta: DocumentMetadata = {};
	const lineItemsPretty = prettyLineItems(invoice.lineItems);

	return {
		invoice,
		customerName: customer?.name ?? invoice.customerId,
		docMeta,
		fileViewUrl,
		fileDownloadUrl,
		lineItemsPretty
	};
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const status = String(form.get('status') ?? 'draft').trim() || 'draft';
		const date = String(form.get('date') ?? '').trim();
		const dueDate = String(form.get('dueDate') ?? '').trim();
		const total = Number.parseFloat(String(form.get('total') ?? '0'));
		const subtotal = Number.parseFloat(String(form.get('subtotal') ?? '0'));
		const gstAmount = Number.parseFloat(String(form.get('gstAmount') ?? '0'));

		if (!date) return fail(400, { message: 'Invoice date is required.' });

		const db = getDb(platform.env);
		await db
			.update(schema.invoicesOut)
			.set({
				status,
				date,
				dueDate: dueDate || null,
				total: Number.isFinite(total) ? total : 0,
				subtotal: Number.isFinite(subtotal) ? subtotal : 0,
				gstAmount: Number.isFinite(gstAmount) ? gstAmount : 0,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.invoicesOut.id, params.invoiceId),
					eq(schema.invoicesOut.projectId, params.id),
					isNull(schema.invoicesOut.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'invoice_out.update',
			entityType: 'invoice_out',
			entityId: params.invoiceId,
			projectId: params.id,
			metadata: { status }
		});

		return { ok: true };
	},
	delete: async ({ params, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.invoicesOut)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.invoicesOut.id, params.invoiceId),
					eq(schema.invoicesOut.projectId, params.id),
					isNull(schema.invoicesOut.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'invoice_out.delete',
			entityType: 'invoice_out',
			entityId: params.invoiceId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}/invoices`);
	}
};

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
	const [contract] = await db
		.select()
		.from(schema.contracts)
		.where(
			and(
				eq(schema.contracts.id, params.contractId),
				eq(schema.contracts.projectId, params.id),
				isNull(schema.contracts.deletedAt)
			)
		)
		.limit(1);

	if (!contract) throw error(404, 'Contract not found');

	const docMeta = parseDocumentMetadata(contract.metadata);
	const { fileViewUrl, fileDownloadUrl } = r2FileUrls(contract.fileUrl);

	return { contract, docMeta, fileViewUrl, fileDownloadUrl };
};

export const actions: Actions = {
	update: async ({ params, request, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const amount = Number.parseFloat(String(form.get('amount') ?? '0'));
		const currency = String(form.get('currency') ?? 'SGD');
		const date = String(form.get('date') ?? '');
		const notes = String(form.get('notes') ?? '').trim();

		const db = getDb(platform.env);
		const [current] = await db
			.select({ metadata: schema.contracts.metadata })
			.from(schema.contracts)
			.where(
				and(
					eq(schema.contracts.id, params.contractId),
					eq(schema.contracts.projectId, params.id),
					isNull(schema.contracts.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: notes || undefined
		});

		await db
			.update(schema.contracts)
			.set({
				amount: Number.isFinite(amount) ? amount : 0,
				currency,
				date: date || null,
				metadata,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.contracts.id, params.contractId),
					eq(schema.contracts.projectId, params.id),
					isNull(schema.contracts.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'contract.update',
			entityType: 'contract',
			entityId: params.contractId,
			projectId: params.id
		});

		return { ok: true };
	},
	delete: async ({ params, platform, locals }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.contracts)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.contracts.id, params.contractId),
					eq(schema.contracts.projectId, params.id),
					isNull(schema.contracts.deletedAt)
				)
			);

		await writeAuditLog(platform, locals.user, {
			action: 'contract.delete',
			entityType: 'contract',
			entityId: params.contractId,
			projectId: params.id
		});

		throw redirect(303, `/projects/${params.id}`);
	}
};

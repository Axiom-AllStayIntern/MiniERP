import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { parseDocumentMetadata } from '$lib/server/document-metadata';
import { resolveExpenseFilePreview } from '$lib/server/expense-file-preview';
import { getDb, schema } from '$lib/server/modules/legacy-db';

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);
	const [revenue] = await db
		.select()
		.from(schema.revenue)
		.where(
			and(
				eq(schema.revenue.id, params.revenueId),
				eq(schema.revenue.projectId, params.id),
				isNull(schema.revenue.deletedAt)
			)
		)
		.limit(1);

	if (!revenue) throw error(404, 'Revenue record not found');

	const docMeta = parseDocumentMetadata(null);
	const { fileViewUrl, fileDownloadUrl, previewDisplay } = await resolveExpenseFilePreview(
		db,
		revenue.documentRef,
		docMeta
	);

	return { revenue, docMeta, fileViewUrl, fileDownloadUrl, previewDisplay };
};

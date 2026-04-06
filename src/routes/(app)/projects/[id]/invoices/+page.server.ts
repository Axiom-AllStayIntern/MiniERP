import { and, eq, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/db';
import { r2FileUrls } from '$lib/server/r2-file-urls';

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);
	const base = `/projects/${params.id}/invoices`;

	const [customerOut, supplierIn] = await Promise.all([
		db
			.select({
				id: schema.invoicesOut.id,
				invoiceNo: schema.invoicesOut.invoiceNo,
				date: schema.invoicesOut.date,
				status: schema.invoicesOut.status,
				total: schema.invoicesOut.total,
				currency: schema.invoicesOut.currency,
				pdfUrl: schema.invoicesOut.pdfUrl
			})
			.from(schema.invoicesOut)
			.where(and(eq(schema.invoicesOut.projectId, params.id), isNull(schema.invoicesOut.deletedAt)))
			.orderBy(sql`${schema.invoicesOut.date} desc`, sql`${schema.invoicesOut.createdAt} desc`),
		db
			.select({
				id: schema.invoicesIn.id,
				supplierName: schema.invoicesIn.supplierName,
				invoiceDate: schema.invoicesIn.invoiceDate,
				status: schema.invoicesIn.status,
				amount: schema.invoicesIn.amount,
				currency: schema.invoicesIn.currency,
				poNumber: schema.invoicesIn.poNumber,
				fileUrl: schema.invoicesIn.fileUrl
			})
			.from(schema.invoicesIn)
			.where(and(eq(schema.invoicesIn.projectId, params.id), isNull(schema.invoicesIn.deletedAt)))
			.orderBy(sql`${schema.invoicesIn.invoiceDate} desc`, sql`${schema.invoicesIn.createdAt} desc`)
	]);

	return {
		invoicesOut: customerOut.map((row) => {
			const { fileViewUrl, fileDownloadUrl } = r2FileUrls(row.pdfUrl);
			return {
				...row,
				hasFile: Boolean(fileViewUrl),
				fileViewUrl,
				fileDownloadUrl,
				detailHref: `${base}/out/${row.id}`
			};
		}),
		invoicesIn: supplierIn.map((row) => {
			const { fileViewUrl, fileDownloadUrl } = r2FileUrls(row.fileUrl);
			return {
				...row,
				hasFile: Boolean(fileViewUrl),
				fileViewUrl,
				fileDownloadUrl,
				detailHref: `${base}/in/${row.id}`
			};
		})
	};
};

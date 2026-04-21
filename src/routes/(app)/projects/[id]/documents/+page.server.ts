import { desc, isNull, eq, and, or, not, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { parseDocumentMetadata } from '$lib/server/document-metadata';
import { getDb, schema } from '$lib/server/modules/legacy-db';

function referenceFileLabel(fileUrl: string | null | undefined, metadata: string | null | undefined): string {
	const m = parseDocumentMetadata(metadata ?? null);
	if (m.upload?.fileName?.trim()) return m.upload.fileName.trim();
	if (!fileUrl) return '—';
	const pathOnly = fileUrl.split('?')[0];
	const tail = pathOnly.split('/').pop() ?? '';
	try {
		const d = decodeURIComponent(tail);
		if (d) return d;
	} catch {
		/* ignore */
	}
	return tail || fileUrl;
}

function friendlyDocNumber(primary: string | null | undefined, id: string): string {
	const t = primary?.trim();
	if (t) return t;
	return id.length > 14 ? `${id.slice(0, 8)}…` : id;
}

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	const { project } = await parent();

	if (!platform) {
		return {
			documents: [],
			contracts: [],
			quotations: [],
			purchaseOrders: [],
			expenseDocuments: [],
			revenueDocuments: [],
			project
		};
	}

	const db = getDb(platform.env);
	const projectId = params.id;

	/** Reference rows already listed under Contracts / Quotations / POs should not duplicate here. */
	const documents = await db
		.select({
			id: schema.documents.id,
			fileName: schema.documents.fileName,
			fileType: schema.documents.fileType,
			fileKey: schema.documents.fileKey,
			docType: schema.documents.docType,
			purpose: schema.documents.purpose,
			ocrStatus: schema.documents.ocrStatus,
			ocrResult: schema.documents.ocrResult,
			notes: schema.documents.notes,
			createdAt: schema.documents.createdAt
		})
		.from(schema.documents)
		.where(
			and(
				eq(schema.documents.projectId, projectId),
				eq(schema.documents.purpose, 'reference'),
				isNull(schema.documents.deletedAt),
				or(
					isNull(schema.documents.entityId),
					not(
						inArray(schema.documents.entityType, ['contract', 'quotation', 'purchase_order'])
					)
				)
			)
		)
		.orderBy(desc(schema.documents.createdAt));

	const contractRows = await db
		.select({
			id: schema.contracts.id,
			contractNumber: schema.contracts.contractNumber,
			fileUrl: schema.contracts.fileUrl,
			amount: schema.contracts.amount,
			currency: schema.contracts.currency,
			date: schema.contracts.effectiveDate,
			status: schema.contracts.status,
			metadata: schema.contracts.metadata,
			createdAt: schema.contracts.createdAt
		})
		.from(schema.contracts)
		.where(and(eq(schema.contracts.projectId, projectId), isNull(schema.contracts.deletedAt)))
		.orderBy(desc(schema.contracts.createdAt));

	const quotationRows = await db
		.select({
			id: schema.quotations.id,
			quotationNumber: schema.quotations.quotationNumber,
			fileUrl: schema.quotations.fileUrl,
			amount: schema.quotations.amount,
			currency: schema.quotations.currency,
			date: schema.quotations.date,
			status: schema.quotations.status,
			metadata: schema.quotations.metadata,
			createdAt: schema.quotations.createdAt
		})
		.from(schema.quotations)
		.where(and(eq(schema.quotations.projectId, projectId), isNull(schema.quotations.deletedAt)))
		.orderBy(desc(schema.quotations.createdAt));

	const purchaseOrderRows = await db
		.select({
			id: schema.purchaseOrders.id,
			poNumber: schema.purchaseOrders.poNumber,
			fileUrl: schema.purchaseOrders.fileUrl,
			supplierName: schema.purchaseOrders.supplierName,
			amount: schema.purchaseOrders.amount,
			currency: schema.purchaseOrders.currency,
			date: schema.purchaseOrders.date,
			status: schema.purchaseOrders.status,
			metadata: schema.purchaseOrders.metadata,
			createdAt: schema.purchaseOrders.createdAt
		})
		.from(schema.purchaseOrders)
		.where(and(eq(schema.purchaseOrders.projectId, projectId), isNull(schema.purchaseOrders.deletedAt)))
		.orderBy(desc(schema.purchaseOrders.createdAt));

	const expenseRows = await db
		.select({
			id: schema.expenses.id,
			category: schema.expenses.category,
			expenseType: schema.expenses.expenseType,
			docType: schema.expenses.docType,
			date: schema.expenses.date,
			amount: schema.expenses.amount,
			currency: schema.expenses.currency,
			documentRef: schema.expenses.documentRef,
			metadata: schema.expenses.metadata,
			createdAt: schema.expenses.createdAt
		})
		.from(schema.expenses)
		.where(and(eq(schema.expenses.projectId, projectId), isNull(schema.expenses.deletedAt)))
		.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt));

	const revenueRows = await db
		.select({
			id: schema.revenue.id,
			invoiceType: schema.revenue.invoiceType,
			invoiceNumber: schema.revenue.invoiceNumber,
			clientName: schema.revenue.clientName,
			date: schema.revenue.date,
			amount: schema.revenue.amount,
			currency: schema.revenue.currency,
			documentRef: schema.revenue.documentRef,
			notes: schema.revenue.notes,
			createdAt: schema.revenue.createdAt
		})
		.from(schema.revenue)
		.where(and(eq(schema.revenue.projectId, projectId), isNull(schema.revenue.deletedAt)))
		.orderBy(desc(schema.revenue.date), desc(schema.revenue.createdAt));

	const contracts = contractRows.map((c) => ({
		...c,
		displayNumber: friendlyDocNumber(c.contractNumber, c.id),
		displayFileName: referenceFileLabel(c.fileUrl, c.metadata)
	}));

	const quotations = quotationRows.map((q) => ({
		...q,
		displayNumber: friendlyDocNumber(q.quotationNumber, q.id),
		displayFileName: referenceFileLabel(q.fileUrl, q.metadata)
	}));

	const purchaseOrders = purchaseOrderRows.map((po) => ({
		...po,
		displayNumber: friendlyDocNumber(po.poNumber, po.id),
		displayFileName: referenceFileLabel(po.fileUrl, po.metadata)
	}));

	const expenseDocuments = expenseRows.map((e) => {
		const meta = parseDocumentMetadata(e.metadata ?? null);
		const uploadName = meta.upload?.fileName?.trim();
		const refName =
			e.documentRef && !e.documentRef.startsWith('manual://')
				? (() => {
						const tail = e.documentRef.split('/').pop() ?? e.documentRef;
						try {
							return decodeURIComponent(tail) || tail;
						} catch {
							return tail;
						}
					})()
				: null;
		return {
			...e,
			displayNumber: friendlyDocNumber(null, e.id),
			displayFileName: uploadName || refName || e.category || 'Expense',
			statusLabel: e.expenseType === 'sales_cost' ? 'Sales Cost' : 'OpEx'
		};
	});

	const revenueDocuments = revenueRows.map((r) => {
		const refName =
			r.documentRef && !r.documentRef.startsWith('manual://')
				? (() => {
						const tail = r.documentRef.split('/').pop() ?? r.documentRef;
						try {
							return decodeURIComponent(tail) || tail;
						} catch {
							return tail;
						}
					})()
				: null;
		return {
			...r,
			displayNumber: friendlyDocNumber(r.invoiceNumber, r.id),
			displayFileName: refName || r.clientName || 'Revenue Invoice',
			statusLabel:
				r.invoiceType === 'zero_rate'
					? 'Zero Rate'
					: r.invoiceType === 'tax_invoice'
						? 'Tax Invoice'
						: 'Standard'
		};
	});

	return { documents, contracts, quotations, purchaseOrders, expenseDocuments, revenueDocuments, project };
};

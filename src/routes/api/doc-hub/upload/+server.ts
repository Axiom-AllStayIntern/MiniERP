import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';
import { objectExists } from '$lib/server/r2';

type UploadPayload = {
	key?: string;
	fileName?: string;
	fileType?: string;
	projectId?: string | null;
	docType?: 'contract' | 'quotation' | 'purchase_order';
	status?: string | null;
	notes?: string | null;
	extracted?: Record<string, unknown> | null;
};

function str(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

function num(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim()) {
		const n = Number(v.replace(/,/g, ''));
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform) return fail('Cloudflare platform bindings are required', 500);
	const body = (await request.json()) as UploadPayload;

	const key = str(body.key);
	const fileName = str(body.fileName);
	const fileType = str(body.fileType) || 'application/octet-stream';
	const docType = body.docType;
	if (!key || !fileName || !docType) {
		return fail('Missing required fields: key, fileName, docType', 400);
	}
	if (!['contract', 'quotation', 'purchase_order'].includes(docType)) {
		return fail('Unsupported docType', 400);
	}

	const projectId = str(body.projectId) || null;
	const exists = await objectExists(platform.env, key);
	if (!exists) return fail('Uploaded object was not found in R2', 404);

	const db = getDb(platform.env);
	if (projectId) {
		const [project] = await db
			.select({ id: schema.projects.id })
			.from(schema.projects)
			.where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)))
			.limit(1);
		if (!project) return fail('Project not found', 404);
	}

	const now = new Date().toISOString();
	const extracted = (body.extracted ?? {}) as Record<string, unknown>;
	const status = str(body.status);
	const notes = str(body.notes) || null;
	const currency = str(extracted.currency) || 'SGD';
	const documentId = crypto.randomUUID();
	const uploadedBy = locals.user?.id || 'system';

	if (docType === 'contract') {
		const contractId = crypto.randomUUID();
		const contractMetadata = {
			...extracted,
			sourceType: 'upload' as const,
			parseStatus: 'not_parsed' as const,
			upload: {
				key,
				fileName,
				contentType: fileType,
				size: 0,
				uploadedAt: now
			}
		};
		await db.insert(schema.contracts).values({
			id: contractId,
			projectId,
			clientName: str(extracted.client_name) || null,
			contractNumber: str(extracted.contract_number) || null,
			effectiveDate: str(extracted.effective_date) || null,
			expiryDate: str(extracted.expiry_date) || null,
			amount: num(extracted.amount),
			currency,
			scope: str(extracted.scope) || null,
			paymentTerms: str(extracted.payment_terms) || null,
			type: (str(extracted.type) as 'customer_contract' | 'supplier_contract' | '') || 'customer_contract',
			status: (status as 'draft' | 'active' | 'completed' | 'terminated' | '') || 'active',
			fileUrl: key,
			metadata: JSON.stringify(contractMetadata),
			notes,
			createdAt: now,
			updatedAt: now
		});
		await db.insert(schema.documents).values({
			id: documentId,
			projectId,
			uploadedBy,
			entityType: 'contract',
			entityId: contractId,
			fileKey: key,
			fileName,
			fileType,
			purpose: 'reference',
			docType: 'contract',
			ocrStatus: 'done',
			ocrResult: JSON.stringify(extracted),
			notes: notes ?? 'Archive only. Not included in cashflow calculation.',
			createdAt: now,
			updatedAt: now
		});
		if (projectId) {
			await writeAuditLog(platform, locals.user, {
				action: 'contract.create',
				entityType: 'contract',
				entityId: contractId,
				projectId,
				metadata: { source: 'doc_hub_upload', fileName }
			});
		}
		return ok({ entityType: 'contract', entityId: contractId, documentId }, 201);
	}

	if (docType === 'quotation') {
		if (!projectId) {
			await db.insert(schema.documents).values({
				id: documentId,
				projectId: null,
				uploadedBy,
				entityType: null,
				entityId: null,
				fileKey: key,
				fileName,
				fileType,
				purpose: 'reference',
				docType: 'quotation',
				ocrStatus: 'done',
				ocrResult: JSON.stringify(extracted),
				notes: notes ?? 'Archive only. Not included in cashflow calculation.',
				createdAt: now,
				updatedAt: now
			});
			return ok({ entityType: 'quotation', entityId: null, documentId }, 201);
		}
		const quotationId = crypto.randomUUID();
		await db.insert(schema.quotations).values({
			id: quotationId,
			projectId,
			clientName: str(extracted.client_name) || null,
			quotationNumber: str(extracted.quotation_number) || null,
			date: str(extracted.date) || null,
			validUntil: str(extracted.valid_until) || null,
			amount: num(extracted.amount),
			currency,
			fileUrl: key,
			metadata: JSON.stringify({
				line_items: extracted.line_items ?? null,
				sourceType: 'upload',
				parseStatus: 'not_parsed',
				upload: {
					key,
					fileName,
					contentType: fileType,
					size: 0,
					uploadedAt: now
				}
			}),
			status: (status as 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | '') || 'draft',
			notes,
			createdAt: now,
			updatedAt: now
		});
		await db.insert(schema.documents).values({
			id: documentId,
			projectId,
			uploadedBy,
			entityType: 'quotation',
			entityId: quotationId,
			fileKey: key,
			fileName,
			fileType,
			purpose: 'reference',
			docType: 'quotation',
			ocrStatus: 'done',
			ocrResult: JSON.stringify(extracted),
			notes: notes ?? 'Archive only. Not included in cashflow calculation.',
			createdAt: now,
			updatedAt: now
		});
		await writeAuditLog(platform, locals.user, {
			action: 'quotation.create',
			entityType: 'quotation',
			entityId: quotationId,
			projectId,
			metadata: { source: 'doc_hub_upload', fileName }
		});
		return ok({ entityType: 'quotation', entityId: quotationId, documentId }, 201);
	}

	if (!projectId) {
		await db.insert(schema.documents).values({
			id: documentId,
			projectId: null,
			uploadedBy,
			entityType: null,
			entityId: null,
			fileKey: key,
			fileName,
			fileType,
			purpose: 'reference',
			docType: 'po',
			ocrStatus: 'done',
			ocrResult: JSON.stringify(extracted),
			notes: notes ?? 'Archive only. Not included in cashflow calculation.',
			createdAt: now,
			updatedAt: now
		});
		return ok({ entityType: 'purchase_order', entityId: null, documentId }, 201);
	}

	const poId = crypto.randomUUID();
	const resolvedPoNumber = str(extracted.po_number) || `PO-${Date.now().toString(36).toUpperCase()}`;
	await db.insert(schema.purchaseOrders).values({
		id: poId,
		projectId,
		poNumber: resolvedPoNumber,
		supplierName: str(extracted.supplier_name) || 'Unknown supplier',
		clientName: str(extracted.client_name) || null,
		date: str(extracted.date) || null,
		amount: num(extracted.amount),
		currency,
		description: str(extracted.description) || null,
		fileUrl: key,
		metadata: JSON.stringify({
			line_items: extracted.line_items ?? null,
			sourceType: 'upload',
			parseStatus: 'not_parsed',
			upload: {
				key,
				fileName,
				contentType: fileType,
				size: 0,
				uploadedAt: now
			}
		}),
		status: (status as 'draft' | 'sent' | 'confirmed' | 'fulfilled' | '') || 'draft',
		notes,
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.documents).values({
		id: documentId,
		projectId,
		uploadedBy,
		entityType: 'purchase_order',
		entityId: poId,
		fileKey: key,
		fileName,
		fileType,
		purpose: 'reference',
		docType: 'po',
		ocrStatus: 'done',
		ocrResult: JSON.stringify(extracted),
		notes: notes ?? 'Archive only. Not included in cashflow calculation.',
		createdAt: now,
		updatedAt: now
	});
	await writeAuditLog(platform, locals.user, {
		action: 'purchase_order.create',
		entityType: 'purchase_order',
		entityId: poId,
		projectId,
		metadata: {
			source: 'doc_hub_upload',
			fileName,
			poNumber: resolvedPoNumber
		}
	});
	return ok({ entityType: 'purchase_order', entityId: poId, documentId }, 201);
};

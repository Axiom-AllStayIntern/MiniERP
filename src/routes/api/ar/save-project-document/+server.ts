import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { buildDocumentMetadata } from '$lib/server/document-metadata';
import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';
import { objectExists } from '$lib/server/r2';

function errorChainText(e: unknown): string {
	if (e instanceof Error) {
		const parts = [e.message];
		let c: unknown = e.cause;
		let depth = 0;
		while (c instanceof Error && depth < 5) {
			parts.push(c.message);
			c = c.cause;
			depth += 1;
		}
		return parts.join(' ');
	}
	return String(e);
}

function isUniqueConstraintError(text: string): boolean {
	const t = text.toLowerCase();
	return (
		t.includes('unique') ||
		t.includes('sqlite_constraint_unique') ||
		(t.includes('constraint failed') &&
			(t.includes('invoice_no') || t.includes('po_number') || t.includes('invoices_out')))
	);
}

function isForeignKeyConstraintError(text: string): boolean {
	const t = text.toLowerCase();
	return t.includes('foreign key') || t.includes('sqlite_constraint_foreignkey');
}

/** Audit must not fail the save if the business row was already inserted. */
async function auditSafe(
	platform: App.Platform,
	user: App.Locals['user'],
	input: Parameters<typeof writeAuditLog>[2]
): Promise<void> {
	try {
		await writeAuditLog(platform, user, input);
	} catch (e) {
		console.error('[save-project-document] audit log failed:', errorChainText(e));
	}
}

function str(v: unknown): string {
	return typeof v === 'string' ? v.trim() : String(v ?? '').trim();
}

function optNum(v: unknown): number | null {
	const s = str(v);
	if (!s) return null;
	const n = Number.parseFloat(s);
	return Number.isFinite(n) ? n : null;
}

function num0(v: unknown): number {
	const n = optNum(v);
	return n ?? 0;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as Record<string, unknown>;
	const key = str(body.key);
	const fileType = str(body.fileType) || 'application/octet-stream';
	const projectId = str(body.projectId);
	const docType = str(body.docType);

	if (!key || !projectId || !docType) {
		return fail('Missing required fields: key, projectId, docType');
	}

	if (!(await objectExists(platform.env, key))) {
		return fail('Uploaded file was not found in storage', 404);
	}

	const db = getDb(platform.env);
	const [project] = await db
		.select({
			id: schema.projects.id,
			customerId: schema.projects.customerId
		})
		.from(schema.projects)
		.where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)))
		.limit(1);

	if (!project) {
		return fail('Project not found', 404);
	}

	const now = new Date().toISOString();
	const docTitle = str(body.docTitle);
	const docNotes = str(body.docNotes);
	const fileName = str(body.fileName) || 'upload';
	const fileSizeRaw = optNum(body.fileSize);
	const fileSize = fileSizeRaw ?? 0;

	const uploadEvidence = {
		key,
		fileName,
		contentType: fileType,
		size: fileSize,
		uploadedAt: now
	};

	const makeMetadata = (extra?: string) =>
		buildDocumentMetadata({
			raw: null,
			notes: [docTitle && `Title: ${docTitle}`, docNotes, extra].filter(Boolean).join('\n') || undefined,
			sourceType: 'upload',
			parseStatus: 'parsed',
			upload: uploadEvidence
		});

	const rawDetectedText = str(body.rawDetectedText);

	try {
		switch (docType) {
			case 'contract': {
				const id = crypto.randomUUID();
				const extra = str(body.contractNo) ? `Contract No: ${str(body.contractNo)}` : undefined;
				await db.insert(schema.contracts).values({
					id,
					projectId,
					fileUrl: key,
					amount: optNum(body.contractAmount),
					currency: str(body.contractCurrency) || 'SGD',
					date: str(body.contractDate) || null,
					metadata: makeMetadata(extra),
					createdAt: now,
					updatedAt: now
				});
				await auditSafe(platform, locals.user, {
					action: 'contract.create',
					entityType: 'contract',
					entityId: id,
					projectId,
					metadata: {
						source: 'ar_document_upload',
						fileName,
						docTitle: docTitle || undefined
					}
				});
				return ok({ entityId: id, entityType: 'contract' }, 201);
			}
			case 'quotation': {
				const id = crypto.randomUUID();
				const ref = str(body.quotationRef);
				const extra = ref ? `Quotation ref: ${ref}` : undefined;
				await db.insert(schema.quotations).values({
					id,
					projectId,
					sourceType: str(body.quotationChannel) || 'document_upload',
					fileUrl: key,
					amount: optNum(body.quotationAmount),
					currency: str(body.quotationCurrency) || 'SGD',
					date: str(body.quotationDate) || null,
					metadata: makeMetadata(extra),
					createdAt: now,
					updatedAt: now
				});
				await auditSafe(platform, locals.user, {
					action: 'quotation.create',
					entityType: 'quotation',
					entityId: id,
					projectId,
					metadata: { source: 'ar_document_upload', fileName }
				});
				return ok({ entityId: id, entityType: 'quotation' }, 201);
			}
			case 'purchase_order': {
				let poNumber = str(body.poNumber);
				if (!poNumber) {
					poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
				}
				const supplierName = str(body.poSupplier) || 'Unknown supplier';
				const id = crypto.randomUUID();
				await db.insert(schema.purchaseOrders).values({
					id,
					projectId,
					poNumber,
					fileUrl: key,
					supplierName,
					amount: optNum(body.poAmount),
					currency: str(body.poCurrency) || 'SGD',
					date: str(body.poDate) || null,
					metadata: makeMetadata(),
					createdAt: now,
					updatedAt: now
				});
				await auditSafe(platform, locals.user, {
					action: 'purchase_order.create',
					entityType: 'purchase_order',
					entityId: id,
					projectId,
					metadata: { source: 'ar_document_upload', fileName, poNumber }
				});
				return ok({ entityId: id, entityType: 'purchase_order' }, 201);
			}
			case 'invoice_out': {
				const reissueNumber = body.invoiceOutReissueNumber === true;
				const desiredInvoiceNo = str(body.invoiceOutNo);
				const total = num0(body.invoiceOutTotal);
				const gst = num0(body.invoiceOutGstAmount);
				const subtotal = Math.max(0, total - gst);
				const gstTypeRaw = str(body.invoiceOutGstType);
				const gstType =
					gstTypeRaw === 'zero' || gstTypeRaw === 'exempt' || gstTypeRaw === 'standard'
						? gstTypeRaw
						: 'standard';
				const extractedCustomer = str(body.invoiceOutCustomer);
				const id = crypto.randomUUID();

				const buildLineItems = (opts: { systemReassigned?: boolean }) => {
					const o: Record<string, unknown> = {};
					if (extractedCustomer) o.extractedCustomerLabel = extractedCustomer;
					if (desiredInvoiceNo) o.extractedInvoiceNoFromDocument = desiredInvoiceNo;
					if (opts.systemReassigned) {
						o.note =
							'System invoice number reassigned after user confirmed save despite duplicate document number.';
					}
					return Object.keys(o).length ? JSON.stringify(o) : null;
				};

				const insertOut = async (no: string, lineItems: string | null) => {
					await db.insert(schema.invoicesOut).values({
						id,
						projectId,
						customerId: project.customerId,
						invoiceNo: no,
						date: str(body.invoiceOutDate) || now.slice(0, 10),
						dueDate: str(body.invoiceOutDueDate) || null,
						currency: str(body.invoiceOutCurrency) || 'SGD',
						subtotal,
						gstType,
						gstAmount: gst,
						total,
						status: 'draft',
						pdfUrl: key,
						lineItems,
						createdAt: now,
						updatedAt: now
					});
				};

				let invoiceNo: string;

				if (reissueNumber) {
					invoiceNo = `INV-UP-${crypto.randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
					try {
						await insertOut(invoiceNo, buildLineItems({ systemReassigned: true }));
					} catch (e) {
						const t = errorChainText(e);
						if (!isUniqueConstraintError(t)) throw e;
						invoiceNo = `INV-UP-${crypto.randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
						await insertOut(invoiceNo, buildLineItems({ systemReassigned: true }));
					}
				} else {
					invoiceNo =
						desiredInvoiceNo || `INV-UP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
					try {
						await insertOut(invoiceNo, buildLineItems({}));
					} catch (e) {
						const t = errorChainText(e);
						if (!isUniqueConstraintError(t)) throw e;
						return fail(
							'This customer invoice number already exists in the system. Cancel or confirm to save with a new system-generated number.',
							409,
							{ code: 'DUPLICATE_INVOICE_NO', invoiceNo }
						);
					}
				}

				await auditSafe(platform, locals.user, {
					action: 'invoice_out.create',
					entityType: 'invoice_out',
					entityId: id,
					projectId,
					metadata: { fileName, invoiceNo, extractedInvoiceNo: desiredInvoiceNo || undefined }
				});
				return ok({ entityId: id, entityType: 'invoice_out', invoiceNo }, 201);
			}
			case 'invoice_in': {
				const id = crypto.randomUUID();
				await db.insert(schema.invoicesIn).values({
					id,
					projectId,
					supplierName: str(body.invoiceInSupplier) || null,
					invoiceDate: str(body.invoiceInDate) || null,
					amount: num0(body.invoiceInAmount),
					currency: str(body.invoiceInCurrency) || 'SGD',
					gstAmount: num0(body.invoiceInGstAmount),
					dueDate: str(body.invoiceInDueDate) || null,
					poNumber: str(body.invoiceInPoNumber) || null,
					status: 'pending_review',
					fileUrl: key,
					rawOcr: rawDetectedText
						? JSON.stringify({
								source: 'document_upload',
								textPreview: rawDetectedText.slice(0, 12000),
								savedAt: now
							})
						: null,
					createdAt: now,
					updatedAt: now
				});
				await auditSafe(platform, locals.user, {
					action: 'invoice_in.create',
					entityType: 'invoice_in',
					entityId: id,
					projectId,
					metadata: {
						fileName,
						supplierName: str(body.invoiceInSupplier) || undefined
					}
				});
				return ok({ entityId: id, entityType: 'invoice_in' }, 201);
			}
			case 'other': {
				const id = crypto.randomUUID();
				const tag = str(body.otherTag);
				const ref = str(body.otherRef);
				const extra = [tag && `Tag: ${tag}`, ref && `Ref: ${ref}`].filter(Boolean).join('\n') || undefined;
				await db.insert(schema.quotations).values({
					id,
					projectId,
					sourceType: 'unclassified_upload',
					fileUrl: key,
					amount: null,
					currency: 'SGD',
					date: null,
					metadata: makeMetadata(extra),
					createdAt: now,
					updatedAt: now
				});
				await writeAuditLog(platform, locals.user, {
					action: 'document.unclassified_upload',
					entityType: 'quotation',
					entityId: id,
					projectId,
					metadata: { fileName, tag, ref: str(body.otherRef) || undefined }
				});
				return ok({ entityId: id, entityType: 'quotation' }, 201);
			}
			default:
				return fail(`Unsupported docType: ${docType}`);
		}
	} catch (e) {
		const msg = errorChainText(e);
		if (isUniqueConstraintError(msg)) {
			return fail(
				'A record with this number already exists (e.g. duplicate customer invoice no. or PO no.). Edit the number or remove the existing row.',
				409
			);
		}
		if (isForeignKeyConstraintError(msg)) {
			return fail('Database rejected a reference (project / customer / PO link). Check project data.', 422);
		}
		return fail('Database error while saving document', 500, msg);
	}
};

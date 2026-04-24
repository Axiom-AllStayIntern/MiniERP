import { and, eq, isNull } from 'drizzle-orm';
import type { ModuleContext } from '../types';
import { schema } from '../../db';
import { buildDocumentMetadata } from '$lib/server/document-metadata';
import { objectExists } from '$lib/server/r2';
import {
	beginIdempotentRequest,
	claimFileHash,
	completeIdempotentRequest,
	failIdempotentRequest,
	getObjectSha256,
	normalizeProjectScope,
	releaseFileHashClaim,
	UploadGuardSchemaError
} from '$lib/server/upload-guards';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';

type ProjectDocumentResult =
	| { ok: true; data: unknown; status: number }
	| { ok: false; message: string; status: number; details?: unknown };

function success(data: unknown, status = 200): ProjectDocumentResult {
	return { ok: true, data, status };
}

function failure(message: string, status = 400, details?: unknown): ProjectDocumentResult {
	return { ok: false, message, status, details };
}

function errorChainText(e: unknown): string {
	if (e instanceof Error) {
		const parts = [e.message];
		let cause: unknown = e.cause;
		let depth = 0;
		while (cause instanceof Error && depth < 5) {
			parts.push(cause.message);
			cause = cause.cause;
			depth += 1;
		}
		return parts.join(' ');
	}
	return String(e);
}

function isUniqueConstraintError(text: string): boolean {
	const normalized = text.toLowerCase();
	return (
		normalized.includes('unique') ||
		normalized.includes('sqlite_constraint_unique') ||
		(normalized.includes('constraint failed') &&
			(normalized.includes('invoice_no') ||
				normalized.includes('po_number') ||
				normalized.includes('invoices_out')))
	);
}

function isForeignKeyConstraintError(text: string): boolean {
	const normalized = text.toLowerCase();
	return (
		normalized.includes('foreign key') ||
		normalized.includes('sqlite_constraint_foreignkey') ||
		(normalized.includes('constraint failed') && normalized.includes('foreign key'))
	);
}

function str(value: unknown): string {
	return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function optNum(value: unknown): number | null {
	const text = str(value);
	if (!text) return null;
	const parsed = Number.parseFloat(text);
	return Number.isFinite(parsed) ? parsed : null;
}

function num0(value: unknown): number {
	return optNum(value) ?? 0;
}

export class ArUploadService {
	constructor(private ctx: ModuleContext) {}

	async saveProjectDocument(body: Record<string, unknown>): Promise<ProjectDocumentResult> {
		const key = str(body.key);
		const fileType = str(body.fileType) || 'application/octet-stream';
		const projectId = str(body.projectId);
		const docType = str(body.docType);

		if (!key || !projectId || !docType) {
			return failure('Missing required fields: key, projectId, docType');
		}

		try {
			if (!(await objectExists(this.ctx.env, key))) {
				return failure('Uploaded file was not found in storage', 404);
			}
		} catch (e) {
			console.error('[save-project-document] R2 head failed:', errorChainText(e));
			return failure('Could not verify file in storage (R2). Check binding and upload.', 503, errorChainText(e));
		}

		try {
			const [project] = await this.ctx.db
				.select({
					id: schema.projects.id,
					customerId: schema.projects.customerId
				})
				.from(schema.projects)
				.where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)))
				.limit(1);

			if (!project) {
				return failure('Project not found', 404);
			}

			const now = new Date().toISOString();
			const docTitle = str(body.docTitle);
			const docNotes = str(body.docNotes);
			const fileName = str(body.fileName) || 'upload';
			const fileSizeRaw = optNum(body.fileSize);
			const fileSize = fileSizeRaw ?? 0;
			const rawDetectedText = str(body.rawDetectedText);

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

			switch (docType) {
				case 'contract':
					return this.saveContract({ body, projectId, key, now, fileName, docTitle, makeMetadata });
				case 'quotation':
					return this.saveQuotation({ body, projectId, key, now, fileName, makeMetadata });
				case 'purchase_order':
					return this.savePurchaseOrder({ body, projectId, key, now, fileName, makeMetadata });
				case 'invoice_out':
					return this.saveCustomerInvoice({ body, projectId, key, now, fileName });
				case 'expense':
					return this.saveProjectExpense({ body, projectId, key, now, fileName, docTitle, makeMetadata });
				case 'invoice_in':
					return this.saveSupplierInvoice({ body, projectId, key, now, fileName, rawDetectedText });
				case 'other':
					return this.saveOtherDocument({ body, projectId, key, now, fileName, makeMetadata });
				default:
					return failure(`Unsupported docType: ${docType}`);
			}
		} catch (e) {
			const message = errorChainText(e);
			console.error('[save-project-document]', message);
			if (isUniqueConstraintError(message)) {
				return failure(
					'A record with this number already exists (e.g. duplicate customer invoice no. or PO no.). Edit the number or remove the existing row.',
					409
				);
			}
			if (isForeignKeyConstraintError(message)) {
				return failure(
					'Database rejected a reference (e.g. audit actor user missing after DB reset - sign out and sign in again, or broken project/customer link).',
					422,
					message
				);
			}
			return failure('Database error while saving document', 500, message);
		}
	}

	private async saveContract(input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		docTitle: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> {
		const { body, projectId, key, now, fileName, docTitle, makeMetadata } = input;
		const id = crypto.randomUUID();
		const extra = str(body.contractNo) ? `Contract No: ${str(body.contractNo)}` : undefined;
		await this.ctx.db.insert(schema.contracts).values({
			id,
			projectId,
			fileUrl: key,
			amount: optNum(body.contractAmount),
			currency: str(body.contractCurrency) || 'SGD',
			effectiveDate: str(body.contractDate) || null,
			metadata: makeMetadata(extra),
			createdAt: now,
			updatedAt: now
		});
		await this.auditSafe({
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
		return success({ entityId: id, entityType: 'contract' }, 201);
	}

	private async saveQuotation(input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> {
		const { body, projectId, key, now, fileName, makeMetadata } = input;
		const id = crypto.randomUUID();
		const ref = str(body.quotationRef);
		const extra = ref ? `Quotation ref: ${ref}` : undefined;
		await this.ctx.db.insert(schema.quotations).values({
			id,
			projectId,
			quotationNumber: str(body.quotationRef) || null,
			fileUrl: key,
			amount: optNum(body.quotationAmount),
			currency: str(body.quotationCurrency) || 'SGD',
			date: str(body.quotationDate) || null,
			metadata: makeMetadata(extra),
			createdAt: now,
			updatedAt: now
		});
		await this.auditSafe({
			action: 'quotation.create',
			entityType: 'quotation',
			entityId: id,
			projectId,
			metadata: { source: 'ar_document_upload', fileName }
		});
		return success({ entityId: id, entityType: 'quotation' }, 201);
	}

	private async savePurchaseOrder(input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> {
		const { body, projectId, key, now, fileName, makeMetadata } = input;
		let poNumber = str(body.poNumber);
		if (!poNumber) {
			poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
		}
		const supplierName = str(body.poSupplier) || 'Unknown supplier';
		const id = crypto.randomUUID();
		await this.ctx.db.insert(schema.purchaseOrders).values({
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
		await this.auditSafe({
			action: 'purchase_order.create',
			entityType: 'purchase_order',
			entityId: id,
			projectId,
			metadata: { source: 'ar_document_upload', fileName, poNumber }
		});
		return success({ entityId: id, entityType: 'purchase_order' }, 201);
	}

	private async saveCustomerInvoice(input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
	}): Promise<ProjectDocumentResult> {
		const { body, projectId, key, now, fileName } = input;
		const idempotencyKey = str(body.idempotencyKey);
		if (!idempotencyKey) {
			return failure('idempotencyKey is required for invoice_out upload');
		}

		const db = this.ctx.db;
		const projectScope = normalizeProjectScope(projectId);
		let idem: Awaited<ReturnType<typeof beginIdempotentRequest>>;
		try {
			idem = await beginIdempotentRequest(db, {
				idempotencyKey,
				endpoint: 'POST:/api/ar/save-project-document:invoice_out',
				userId: this.ctx.user?.id ?? null,
				projectScope
			});
		} catch (e) {
			if (e instanceof UploadGuardSchemaError) {
				return failure('Upload dedupe guard is initializing. Please run DB migration and retry.', 503);
			}
			throw e;
		}
		if (idem.state === 'completed') {
			if (idem.responseBody) {
				try {
					const parsed = JSON.parse(idem.responseBody) as unknown;
					return success(parsed, 200);
				} catch {
					return success({ message: 'Request already processed' }, 200);
				}
			}
			return success({ message: 'Request already processed' }, 200);
		}
		if (idem.state === 'in_progress') {
			return failure('A request with the same idempotency key is still processing', 409);
		}

		const fileHash = await getObjectSha256(this.ctx.env, key);
		if (!fileHash) {
			await failIdempotentRequest(db, idempotencyKey, 'Uploaded file missing in storage during hash check');
			return failure('Uploaded file was not found in storage during dedupe check', 404);
		}

		const reissueNumber = body.invoiceOutReissueNumber === true;
		const desiredInvoiceNo = str(body.invoiceOutNo);
		const total = num0(body.invoiceOutTotal);
		const gst = num0(body.invoiceOutGstAmount);
		const gstTypeRaw = str(body.invoiceOutGstType);
		const gstType =
			gstTypeRaw === 'zero' || gstTypeRaw === 'exempt' || gstTypeRaw === 'standard'
				? gstTypeRaw
				: 'standard';
		const extractedCustomer = str(body.invoiceOutCustomer);
		const outCurrency = (str(body.invoiceOutCurrency) || 'SGD').trim().toUpperCase();
		const invoiceDate = str(body.invoiceOutDate) || now.slice(0, 10);
		const id = crypto.randomUUID();

		let hashClaim: Awaited<ReturnType<typeof claimFileHash>>;
		try {
			hashClaim = await claimFileHash(db, {
				domain: 'revenue',
				projectScope,
				fileHash,
				entityType: 'invoice_out',
				entityId: id,
				createdBy: this.ctx.user?.id ?? null
			});
		} catch (e) {
			if (e instanceof UploadGuardSchemaError) {
				await failIdempotentRequest(db, idempotencyKey, e.message);
				return failure('Upload dedupe guard is initializing. Please run DB migration and retry.', 503);
			}
			throw e;
		}
		if (!hashClaim.ok) {
			await failIdempotentRequest(db, idempotencyKey, 'Duplicate file hash detected');
			return failure('Duplicate upload detected: this customer invoice file was already recorded', 409, {
				code: 'DUPLICATE_FILE_UPLOAD',
				existingEntityId: hashClaim.duplicateEntityId
			});
		}

		try {
			const buildLineItems = (opts: { systemReassigned?: boolean }) => {
				const metadata: Record<string, unknown> = {};
				if (extractedCustomer) metadata.extractedCustomerLabel = extractedCustomer;
				if (desiredInvoiceNo) metadata.extractedInvoiceNoFromDocument = desiredInvoiceNo;
				if (opts.systemReassigned) {
					metadata.note =
						'System invoice number reassigned after user confirmed save despite duplicate document number.';
				}
				return Object.keys(metadata).length ? JSON.stringify(metadata) : null;
			};

			const insertRevenueRow = async (invoiceNumber: string, lineItems: string | null) => {
				const sgdEq = await resolveSgdEquivalentForWrite({
					amount: total,
					currency: outCurrency,
					dateYmd: invoiceDate
				});
				const invoiceType = gstType === 'zero' || gstType === 'exempt' ? 'zero_rate' : 'standard';
				await db.insert(schema.revenue).values({
					id,
					projectId,
					invoiceType: invoiceType as 'standard' | 'zero_rate',
					invoiceNumber,
					clientName: extractedCustomer || null,
					date: invoiceDate,
					amount: total,
					currency: outCurrency,
					sgdEquivalent: sgdEq,
					gstAmount: gst,
					documentRef: key,
					notes: lineItems,
					createdAt: now,
					updatedAt: now
				});
			};

			let invoiceNo: string;
			if (reissueNumber) {
				invoiceNo = `INV-UP-${crypto.randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
				try {
					await insertRevenueRow(invoiceNo, buildLineItems({ systemReassigned: true }));
				} catch (e) {
					const text = errorChainText(e);
					if (!isUniqueConstraintError(text)) throw e;
					invoiceNo = `INV-UP-${crypto.randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
					await insertRevenueRow(invoiceNo, buildLineItems({ systemReassigned: true }));
				}
			} else {
				invoiceNo = desiredInvoiceNo || `INV-UP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
				try {
					await insertRevenueRow(invoiceNo, buildLineItems({}));
				} catch (e) {
					const text = errorChainText(e);
					if (!isUniqueConstraintError(text)) throw e;
					await failIdempotentRequest(db, idempotencyKey, 'Duplicate invoice number');
					await releaseFileHashClaim(db, { domain: 'revenue', projectScope, fileHash });
					return failure(
						'This customer invoice number already exists in the system. Cancel or confirm to save with a new system-generated number.',
						409,
						{ code: 'DUPLICATE_INVOICE_NO', invoiceNo }
					);
				}
			}

			await this.auditSafe({
				action: 'invoice_out.create',
				entityType: 'invoice_out',
				entityId: id,
				projectId,
				metadata: { fileName, invoiceNo, extractedInvoiceNo: desiredInvoiceNo || undefined }
			});
			const responseBody = { entityId: id, entityType: 'invoice_out', invoiceNo };
			await completeIdempotentRequest(db, idempotencyKey, JSON.stringify(responseBody));
			return success(responseBody, 201);
		} catch (e) {
			await releaseFileHashClaim(db, { domain: 'revenue', projectScope, fileHash });
			await failIdempotentRequest(db, idempotencyKey, e instanceof Error ? e.message : String(e));
			throw e;
		}
	}

	private async saveProjectExpense(input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		docTitle: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> {
		const { body, projectId, key, now, fileName, docTitle, makeMetadata } = input;
		const id = crypto.randomUUID();
		const category = str(body.expenseCategory) || str(body.otherTag) || str(docTitle) || 'others';
		const amount = num0(body.expenseAmount);
		const currency = (str(body.expenseCurrency) || 'SGD').trim().toUpperCase();
		const date = str(body.expenseDate) || now.slice(0, 10);
		const staffName = str(body.expenseStaffName) || null;
		const expenseType = str(body.expenseCostLayer) === 'sales_cost' ? 'sales_cost' : 'opex';
		const sgdEq = await resolveSgdEquivalentForWrite({ amount, currency, dateYmd: date });
		await this.ctx.db.insert(schema.expenses).values({
			id,
			projectId,
			expenseType: expenseType as 'opex' | 'sales_cost',
			category,
			amount,
			currency,
			sgdEquivalent: sgdEq,
			date,
			staffName,
			reimbursement: false,
			businessTrip: false,
			documentRef: key,
			metadata: makeMetadata(),
			createdAt: now,
			updatedAt: now
		});
		await this.auditSafe({
			action: 'expense.create',
			entityType: 'expense',
			entityId: id,
			projectId,
			metadata: {
				source: 'ar_document_upload',
				fileName,
				expenseType,
				category
			}
		});
		return success({ entityId: id, entityType: 'expense' }, 201);
	}

	private async saveSupplierInvoice(input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		rawDetectedText: string;
	}): Promise<ProjectDocumentResult> {
		const { body, projectId, key, now, fileName, rawDetectedText } = input;
		const id = crypto.randomUUID();
		await this.ctx.db.insert(schema.invoicesIn).values({
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
		await this.auditSafe({
			action: 'invoice_in.create',
			entityType: 'invoice_in',
			entityId: id,
			projectId,
			metadata: {
				fileName,
				supplierName: str(body.invoiceInSupplier) || undefined
			}
		});
		return success({ entityId: id, entityType: 'invoice_in' }, 201);
	}

	private async saveOtherDocument(input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> {
		const { body, projectId, key, now, fileName, makeMetadata } = input;
		const id = crypto.randomUUID();
		const tag = str(body.otherTag);
		const ref = str(body.otherRef);
		const extra = [tag && `Tag: ${tag}`, ref && `Ref: ${ref}`].filter(Boolean).join('\n') || undefined;
		await this.ctx.db.insert(schema.quotations).values({
			id,
			projectId,
			quotationNumber: null,
			fileUrl: key,
			amount: null,
			currency: 'SGD',
			date: null,
			metadata: makeMetadata(extra),
			createdAt: now,
			updatedAt: now
		});
		await this.auditSafe({
			action: 'document.unclassified_upload',
			entityType: 'quotation',
			entityId: id,
			projectId,
			metadata: { fileName, tag, ref: str(body.otherRef) || undefined }
		});
		return success({ entityId: id, entityType: 'quotation' }, 201);
	}

	private async auditSafe(input: {
		action: string;
		entityType: string;
		entityId?: string | null;
		projectId?: string | null;
		metadata?: Record<string, unknown>;
	}): Promise<void> {
		try {
			const now = new Date().toISOString();
			await this.ctx.db.insert(schema.auditLogs).values({
				id: crypto.randomUUID(),
				actorUserId: this.ctx.user?.id ?? null,
				actorEmail: this.ctx.user?.email ?? null,
				action: input.action,
				entityType: input.entityType,
				entityId: input.entityId ?? null,
				projectId: input.projectId ?? null,
				metadata: input.metadata ? JSON.stringify(input.metadata) : null,
				createdAt: now,
				updatedAt: now
			});
		} catch (e) {
			console.error('[save-project-document] audit log failed:', errorChainText(e));
		}
	}
}

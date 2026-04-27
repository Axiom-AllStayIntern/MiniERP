import { and, desc, eq, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import { buildDocumentMetadata, parseDocumentMetadata } from '$lib/server/document-metadata';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';
import { objectExists } from '$lib/server/r2';
import { r2FileUrls } from '$lib/server/r2-file-urls';
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
import type { ModuleContext } from '../../../lib/server/modules/types';
import {
	auditLogs,
	contracts,
	expenses,
	invoicesIn,
	projects,
	purchaseOrders,
	quotations,
	revenue
} from '../../../infrastructure/db/schema';
import { DocumentRepository } from '../repositories';
import {
	fileViewUrl,
	getDocHubProjectPicker,
	parseProjectFilters,
	textParam,
	tryParseJson
} from './doc-hub-shared';

type ProjectDocumentResult =
	| { ok: true; data: unknown; status: number }
	| { ok: false; message: string; status: number; details?: unknown };

function success(data: unknown, status = 200): ProjectDocumentResult {
	return { ok: true, data, status };
}

function failure(message: string, status = 400, details?: unknown): ProjectDocumentResult {
	return { ok: false, message, status, details };
}

function errorChainText(error: unknown): string {
	if (error instanceof Error) {
		const parts = [error.message];
		let cause: unknown = error.cause;
		let depth = 0;
		while (cause instanceof Error && depth < 5) {
			parts.push(cause.message);
			cause = cause.cause;
			depth += 1;
		}
		return parts.join(' ');
	}
	return String(error);
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

function nowIso() {
	return new Date().toISOString();
}

export function createFinanceDocumentApi(ctx: ModuleContext) {
	const documentRepository = new DocumentRepository(ctx.db);

	const auditSafe = async (input: {
		action: string;
		entityType: string;
		entityId?: string | null;
		projectId?: string | null;
		metadata?: Record<string, unknown>;
	}) => {
		try {
			const now = nowIso();
			await ctx.db.insert(auditLogs).values({
				id: crypto.randomUUID(),
				actorUserId: ctx.user?.id ?? null,
				actorEmail: ctx.user?.email ?? null,
				action: input.action,
				entityType: input.entityType,
				entityId: input.entityId ?? null,
				projectId: input.projectId ?? null,
				metadata: input.metadata ? JSON.stringify(input.metadata) : null,
				createdAt: now,
				updatedAt: now
			});
		} catch (error) {
			console.error('[finance.save-project-document] audit log failed:', errorChainText(error));
		}
	};

	const saveContract = async (input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		docTitle: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> => {
		const { body, projectId, key, now, fileName, docTitle, makeMetadata } = input;
		const id = crypto.randomUUID();
		const extra = str(body.contractNo) ? `Contract No: ${str(body.contractNo)}` : undefined;
		await ctx.db.insert(contracts).values({
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
		await auditSafe({
			action: 'contract.create',
			entityType: 'contract',
			entityId: id,
			projectId,
			metadata: {
				source: 'finance_document_upload',
				fileName,
				docTitle: docTitle || undefined
			}
		});
		return success({ entityId: id, entityType: 'contract' }, 201);
	};

	const saveQuotation = async (input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> => {
		const { body, projectId, key, now, fileName, makeMetadata } = input;
		const id = crypto.randomUUID();
		const ref = str(body.quotationRef);
		const extra = ref ? `Quotation ref: ${ref}` : undefined;
		await ctx.db.insert(quotations).values({
			id,
			projectId,
			quotationNumber: ref || null,
			fileUrl: key,
			amount: optNum(body.quotationAmount),
			currency: str(body.quotationCurrency) || 'SGD',
			date: str(body.quotationDate) || null,
			metadata: makeMetadata(extra),
			createdAt: now,
			updatedAt: now
		});
		await auditSafe({
			action: 'quotation.create',
			entityType: 'quotation',
			entityId: id,
			projectId,
			metadata: { source: 'finance_document_upload', fileName }
		});
		return success({ entityId: id, entityType: 'quotation' }, 201);
	};

	const savePurchaseOrder = async (input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> => {
		const { body, projectId, key, now, fileName, makeMetadata } = input;
		let poNumber = str(body.poNumber);
		if (!poNumber) {
			poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
		}
		const supplierName = str(body.poSupplier) || 'Unknown supplier';
		const id = crypto.randomUUID();
		await ctx.db.insert(purchaseOrders).values({
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
		await auditSafe({
			action: 'purchase_order.create',
			entityType: 'purchase_order',
			entityId: id,
			projectId,
			metadata: { source: 'finance_document_upload', fileName, poNumber }
		});
		return success({ entityId: id, entityType: 'purchase_order' }, 201);
	};

	const saveCustomerInvoice = async (input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
	}): Promise<ProjectDocumentResult> => {
		const { body, projectId, key, now, fileName } = input;
		const idempotencyKey = str(body.idempotencyKey);
		if (!idempotencyKey) {
			return failure('idempotencyKey is required for invoice_out upload');
		}

		const projectScope = normalizeProjectScope(projectId);
		let idem: Awaited<ReturnType<typeof beginIdempotentRequest>>;
		try {
			idem = await beginIdempotentRequest(ctx.db, {
				idempotencyKey,
				endpoint: 'POST:/api/finance/save-project-document:invoice_out',
				userId: ctx.user?.id ?? null,
				projectScope
			});
		} catch (error) {
			if (error instanceof UploadGuardSchemaError) {
				return failure('Upload dedupe guard is initializing. Please run DB migration and retry.', 503);
			}
			throw error;
		}
		if (idem.state === 'completed') {
			if (idem.responseBody) {
				try {
					return success(JSON.parse(idem.responseBody) as unknown, 200);
				} catch {
					return success({ message: 'Request already processed' }, 200);
				}
			}
			return success({ message: 'Request already processed' }, 200);
		}
		if (idem.state === 'in_progress') {
			return failure('A request with the same idempotency key is still processing', 409);
		}

		const fileHash = await getObjectSha256(ctx.env, key);
		if (!fileHash) {
			await failIdempotentRequest(ctx.db, idempotencyKey, 'Uploaded file missing in storage during hash check');
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
			hashClaim = await claimFileHash(ctx.db, {
				domain: 'revenue',
				projectScope,
				fileHash,
				entityType: 'invoice_out',
				entityId: id,
				createdBy: ctx.user?.id ?? null
			});
		} catch (error) {
			if (error instanceof UploadGuardSchemaError) {
				await failIdempotentRequest(ctx.db, idempotencyKey, error.message);
				return failure('Upload dedupe guard is initializing. Please run DB migration and retry.', 503);
			}
			throw error;
		}
		if (!hashClaim.ok) {
			await failIdempotentRequest(ctx.db, idempotencyKey, 'Duplicate file hash detected');
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
				const sgdEquivalent = await resolveSgdEquivalentForWrite({
					amount: total,
					currency: outCurrency,
					dateYmd: invoiceDate
				});
				const invoiceType = gstType === 'zero' || gstType === 'exempt' ? 'zero_rate' : 'standard';
				await ctx.db.insert(revenue).values({
					id,
					projectId,
					invoiceType: invoiceType as 'standard' | 'zero_rate',
					invoiceNumber,
					clientName: extractedCustomer || null,
					date: invoiceDate,
					amount: total,
					currency: outCurrency,
					sgdEquivalent,
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
				} catch (error) {
					const text = errorChainText(error);
					if (!isUniqueConstraintError(text)) throw error;
					invoiceNo = `INV-UP-${crypto.randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
					await insertRevenueRow(invoiceNo, buildLineItems({ systemReassigned: true }));
				}
			} else {
				invoiceNo = desiredInvoiceNo || `INV-UP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
				try {
					await insertRevenueRow(invoiceNo, buildLineItems({}));
				} catch (error) {
					const text = errorChainText(error);
					if (!isUniqueConstraintError(text)) throw error;
					await failIdempotentRequest(ctx.db, idempotencyKey, 'Duplicate invoice number');
					await releaseFileHashClaim(ctx.db, { domain: 'revenue', projectScope, fileHash });
					return failure(
						'This customer invoice number already exists in the system. Cancel or confirm to save with a new system-generated number.',
						409,
						{ code: 'DUPLICATE_INVOICE_NO', invoiceNo }
					);
				}
			}

			await auditSafe({
				action: 'invoice_out.create',
				entityType: 'invoice_out',
				entityId: id,
				projectId,
				metadata: { fileName, invoiceNo, extractedInvoiceNo: desiredInvoiceNo || undefined }
			});
			const responseBody = { entityId: id, entityType: 'invoice_out', invoiceNo };
			await completeIdempotentRequest(ctx.db, idempotencyKey, JSON.stringify(responseBody));
			return success(responseBody, 201);
		} catch (error) {
			await releaseFileHashClaim(ctx.db, { domain: 'revenue', projectScope, fileHash });
			await failIdempotentRequest(
				ctx.db,
				idempotencyKey,
				error instanceof Error ? error.message : String(error)
			);
			throw error;
		}
	};

	const saveProjectExpense = async (input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		docTitle: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> => {
		const { body, projectId, key, now, fileName, docTitle, makeMetadata } = input;
		const id = crypto.randomUUID();
		const category = str(body.expenseCategory) || str(body.otherTag) || str(docTitle) || 'others';
		const amount = num0(body.expenseAmount);
		const currency = (str(body.expenseCurrency) || 'SGD').trim().toUpperCase();
		const date = str(body.expenseDate) || now.slice(0, 10);
		const staffName = str(body.expenseStaffName) || null;
		const expenseType = str(body.expenseCostLayer) === 'sales_cost' ? 'sales_cost' : 'opex';
		const sgdEquivalent = await resolveSgdEquivalentForWrite({ amount, currency, dateYmd: date });
		await ctx.db.insert(expenses).values({
			id,
			projectId,
			expenseType: expenseType as 'opex' | 'sales_cost',
			category,
			amount,
			currency,
			sgdEquivalent,
			date,
			staffName,
			reimbursement: false,
			businessTrip: false,
			documentRef: key,
			metadata: makeMetadata(),
			createdAt: now,
			updatedAt: now
		});
		await auditSafe({
			action: 'expense.create',
			entityType: 'expense',
			entityId: id,
			projectId,
			metadata: {
				source: 'finance_document_upload',
				fileName,
				expenseType,
				category
			}
		});
		return success({ entityId: id, entityType: 'expense' }, 201);
	};

	const saveSupplierInvoice = async (input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		rawDetectedText: string;
	}): Promise<ProjectDocumentResult> => {
		const { body, projectId, key, now, fileName, rawDetectedText } = input;
		const id = crypto.randomUUID();
		await ctx.db.insert(invoicesIn).values({
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
		await auditSafe({
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
	};

	const saveOtherDocument = async (input: {
		body: Record<string, unknown>;
		projectId: string;
		key: string;
		now: string;
		fileName: string;
		makeMetadata: (extra?: string) => string | null;
	}): Promise<ProjectDocumentResult> => {
		const { body, projectId, now, fileName, makeMetadata } = input;
		const id = crypto.randomUUID();
		const tag = str(body.otherTag);
		const ref = str(body.otherRef);
		const extra = [tag && `Tag: ${tag}`, ref && `Ref: ${ref}`].filter(Boolean).join('\n') || undefined;
		await ctx.db.insert(quotations).values({
			id,
			projectId,
			quotationNumber: null,
			fileUrl: input.key,
			amount: null,
			currency: 'SGD',
			date: null,
			metadata: makeMetadata(extra),
			createdAt: now,
			updatedAt: now
		});
		await auditSafe({
			action: 'document.unclassified_upload',
			entityType: 'quotation',
			entityId: id,
			projectId,
			metadata: { fileName, tag, ref: str(body.otherRef) || undefined }
		});
		return success({ entityId: id, entityType: 'quotation' }, 201);
	};

	const saveProjectDocument = async (body: Record<string, unknown>) => {
		const key = str(body.key);
		const fileType = str(body.fileType) || 'application/octet-stream';
		const projectId = str(body.projectId);
		const docType = str(body.docType);

		if (!key || !projectId || !docType) {
			return failure('Missing required fields: key, projectId, docType');
		}

		try {
			if (!(await objectExists(ctx.env, key))) {
				return failure('Uploaded file was not found in storage', 404);
			}
		} catch (error) {
			console.error('[finance.save-project-document] R2 head failed:', errorChainText(error));
			return failure(
				'Could not verify file in storage (R2). Check binding and upload.',
				503,
				errorChainText(error)
			);
		}

		try {
			const [project] = await ctx.db
				.select({ id: projects.id, customerId: projects.customerId })
				.from(projects)
				.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
				.limit(1);

			if (!project) {
				return failure('Project not found', 404);
			}

			const now = nowIso();
			const docTitle = str(body.docTitle);
			const docNotes = str(body.docNotes);
			const fileName = str(body.fileName) || 'upload';
			const fileSize = optNum(body.fileSize) ?? 0;
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
					notes: [docTitle && `Title: ${docTitle}`, docNotes, extra]
						.filter(Boolean)
						.join('\n') || undefined,
					sourceType: 'upload',
					parseStatus: 'parsed',
					upload: uploadEvidence
				});

			switch (docType) {
				case 'contract':
					return saveContract({ body, projectId, key, now, fileName, docTitle, makeMetadata });
				case 'quotation':
					return saveQuotation({ body, projectId, key, now, fileName, makeMetadata });
				case 'purchase_order':
					return savePurchaseOrder({ body, projectId, key, now, fileName, makeMetadata });
				case 'invoice_out':
					return saveCustomerInvoice({ body, projectId, key, now, fileName });
				case 'expense':
					return saveProjectExpense({ body, projectId, key, now, fileName, docTitle, makeMetadata });
				case 'invoice_in':
					return saveSupplierInvoice({ body, projectId, key, now, fileName, rawDetectedText });
				case 'other':
					return saveOtherDocument({ body, projectId, key, now, fileName, makeMetadata });
				default:
					return failure(`Unsupported docType: ${docType}`);
			}
		} catch (error) {
			const message = errorChainText(error);
			console.error('[finance.save-project-document]', message);
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
	};

	const getContractDocHubPage = async (params: URLSearchParams) => {
		const projectFilters = parseProjectFilters(params);
		const contractQ = textParam(params, 'contractQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const contractFieldRaw = textParam(params, 'contractField', 'all');
		const listMode =
			listModeRaw === 'all' || listModeRaw === 'unassigned' || listModeRaw === 'selected'
				? listModeRaw
				: 'all';
		const contractField =
			contractFieldRaw === 'id' ||
			contractFieldRaw === 'amount' ||
			contractFieldRaw === 'date' ||
			contractFieldRaw === 'notes' ||
			contractFieldRaw === 'all'
				? contractFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(contracts.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(contracts.projectId, projectFilters.projectId) : sql`1 = 0`);
		} else if (listMode === 'unassigned') {
			conditions.push(isNull(contracts.projectId));
		}
		if (contractQ) {
			if (contractField === 'id') {
				conditions.push(like(contracts.id, `%${contractQ}%`));
			} else if (contractField === 'amount') {
				conditions.push(like(sql`cast(coalesce(${contracts.amount}, 0) as text)`, `%${contractQ}%`));
			} else if (contractField === 'date') {
				conditions.push(like(contracts.effectiveDate, `%${contractQ}%`));
			} else if (contractField === 'notes') {
				conditions.push(like(sql`coalesce(${contracts.metadata}, '')`, `%${contractQ}%`));
			} else {
				conditions.push(
					or(
						like(contracts.id, `%${contractQ}%`),
						like(sql`cast(coalesce(${contracts.amount}, 0) as text)`, `%${contractQ}%`),
						like(contracts.effectiveDate, `%${contractQ}%`),
						like(sql`coalesce(${contracts.metadata}, '')`, `%${contractQ}%`)
					)!
				);
			}
		}

		const contractRows = await ctx.db
			.select()
			.from(contracts)
			.where(and(...conditions))
			.orderBy(desc(contracts.effectiveDate), desc(contracts.createdAt));
		const countRows = await ctx.db
			.select({ projectId: contracts.projectId, total: sql<number>`count(*)` })
			.from(contracts)
			.where(isNull(contracts.deletedAt))
			.groupBy(contracts.projectId);
		const projectPage = await getDocHubProjectPicker(
			ctx.db,
			projectFilters,
			countRows,
			contractRows.map((item) => item.projectId),
			'contractCount'
		);

		return {
			contracts: contractRows.map((item) => ({
				...item,
				projectName: item.projectId
					? projectPage.projectMap.get(item.projectId) ?? item.projectId
					: 'Unassigned Contract',
				fileViewUrl: fileViewUrl(item.fileUrl),
				docMeta: parseDocumentMetadata(item.metadata)
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, contractQ, listMode, contractField },
			pagination: projectPage.pagination
		};
	};

	const getQuotationDocHubPage = async (params: URLSearchParams) => {
		const projectFilters = parseProjectFilters(params);
		const quotationQ = textParam(params, 'quotationQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const quotationFieldRaw = textParam(params, 'quotationField', 'all');
		const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
		const quotationField =
			quotationFieldRaw === 'id' ||
			quotationFieldRaw === 'amount' ||
			quotationFieldRaw === 'date' ||
			quotationFieldRaw === 'notes' ||
			quotationFieldRaw === 'source' ||
			quotationFieldRaw === 'all'
				? quotationFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(quotations.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(quotations.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (quotationQ) {
			if (quotationField === 'id') conditions.push(like(quotations.id, `%${quotationQ}%`));
			else if (quotationField === 'amount')
				conditions.push(like(sql`cast(coalesce(${quotations.amount}, 0) as text)`, `%${quotationQ}%`));
			else if (quotationField === 'date') conditions.push(like(quotations.date, `%${quotationQ}%`));
			else if (quotationField === 'notes')
				conditions.push(like(sql`coalesce(${quotations.metadata}, '')`, `%${quotationQ}%`));
			else if (quotationField === 'source')
				conditions.push(like(sql`coalesce(${quotations.quotationNumber}, '')`, `%${quotationQ}%`));
			else {
				conditions.push(
					or(
						like(quotations.id, `%${quotationQ}%`),
						like(sql`cast(coalesce(${quotations.amount}, 0) as text)`, `%${quotationQ}%`),
						like(quotations.date, `%${quotationQ}%`),
						like(sql`coalesce(${quotations.quotationNumber}, '')`, `%${quotationQ}%`),
						like(sql`coalesce(${quotations.metadata}, '')`, `%${quotationQ}%`)
					)!
				);
			}
		}

		const quotationRows = await ctx.db
			.select()
			.from(quotations)
			.where(and(...conditions))
			.orderBy(desc(quotations.date), desc(quotations.createdAt));
		const countRows = await ctx.db
			.select({ projectId: quotations.projectId, total: sql<number>`count(*)` })
			.from(quotations)
			.where(isNull(quotations.deletedAt))
			.groupBy(quotations.projectId);
		const projectPage = await getDocHubProjectPicker(
			ctx.db,
			projectFilters,
			countRows,
			quotationRows.map((item) => item.projectId),
			'quotationCount'
		);

		return {
			quotations: quotationRows.map((item) => ({
				...item,
				projectName: item.projectId ? projectPage.projectMap.get(item.projectId) ?? item.projectId : item.projectId,
				fileViewUrl: fileViewUrl(item.fileUrl),
				docMeta: parseDocumentMetadata(item.metadata)
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, quotationQ, listMode, quotationField },
			pagination: projectPage.pagination
		};
	};

	const getPurchaseOrderDocHubPage = async (params: URLSearchParams) => {
		const projectFilters = parseProjectFilters(params);
		const poQ = textParam(params, 'poQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const poFieldRaw = textParam(params, 'poField', 'all');
		const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
		const poField =
			poFieldRaw === 'id' ||
			poFieldRaw === 'poNumber' ||
			poFieldRaw === 'supplier' ||
			poFieldRaw === 'amount' ||
			poFieldRaw === 'date' ||
			poFieldRaw === 'notes' ||
			poFieldRaw === 'all'
				? poFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(purchaseOrders.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(purchaseOrders.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (poQ) {
			if (poField === 'id') conditions.push(like(purchaseOrders.id, `%${poQ}%`));
			else if (poField === 'poNumber') conditions.push(like(purchaseOrders.poNumber, `%${poQ}%`));
			else if (poField === 'supplier')
				conditions.push(like(sql`coalesce(${purchaseOrders.supplierName}, '')`, `%${poQ}%`));
			else if (poField === 'amount')
				conditions.push(like(sql`cast(coalesce(${purchaseOrders.amount}, 0) as text)`, `%${poQ}%`));
			else if (poField === 'date')
				conditions.push(like(sql`coalesce(${purchaseOrders.date}, '')`, `%${poQ}%`));
			else if (poField === 'notes')
				conditions.push(like(sql`coalesce(${purchaseOrders.metadata}, '')`, `%${poQ}%`));
			else {
				conditions.push(
					or(
						like(purchaseOrders.id, `%${poQ}%`),
						like(purchaseOrders.poNumber, `%${poQ}%`),
						like(sql`coalesce(${purchaseOrders.supplierName}, '')`, `%${poQ}%`),
						like(sql`cast(coalesce(${purchaseOrders.amount}, 0) as text)`, `%${poQ}%`),
						like(sql`coalesce(${purchaseOrders.date}, '')`, `%${poQ}%`),
						like(sql`coalesce(${purchaseOrders.metadata}, '')`, `%${poQ}%`)
					)!
				);
			}
		}

		const purchaseOrderRows = await ctx.db
			.select()
			.from(purchaseOrders)
			.where(and(...conditions))
			.orderBy(desc(purchaseOrders.date), desc(purchaseOrders.createdAt));
		const countRows = await ctx.db
			.select({ projectId: purchaseOrders.projectId, total: sql<number>`count(*)` })
			.from(purchaseOrders)
			.where(isNull(purchaseOrders.deletedAt))
			.groupBy(purchaseOrders.projectId);
		const projectPage = await getDocHubProjectPicker(
			ctx.db,
			projectFilters,
			countRows,
			purchaseOrderRows.map((item) => item.projectId),
			'poCount'
		);

		return {
			purchaseOrders: purchaseOrderRows.map((item) => ({
				...item,
				projectName: item.projectId ? projectPage.projectMap.get(item.projectId) ?? item.projectId : item.projectId,
				fileViewUrl: fileViewUrl(item.fileUrl),
				docMeta: parseDocumentMetadata(item.metadata)
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, poQ, listMode, poField },
			pagination: projectPage.pagination
		};
	};

	const getSupplierInvoiceDocHubPage = async (params: URLSearchParams) => {
		const projectFilters = parseProjectFilters(params);
		const supplierQ = textParam(params, 'supplierQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const supplierFieldRaw = textParam(params, 'supplierField', 'all');
		const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
		const supplierField =
			supplierFieldRaw === 'id' ||
			supplierFieldRaw === 'supplier' ||
			supplierFieldRaw === 'amount' ||
			supplierFieldRaw === 'date' ||
			supplierFieldRaw === 'status' ||
			supplierFieldRaw === 'poNumber' ||
			supplierFieldRaw === 'all'
				? supplierFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(invoicesIn.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(invoicesIn.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (supplierQ) {
			if (supplierField === 'id') conditions.push(like(invoicesIn.id, `%${supplierQ}%`));
			else if (supplierField === 'supplier')
				conditions.push(like(sql`coalesce(${invoicesIn.supplierName}, '')`, `%${supplierQ}%`));
			else if (supplierField === 'amount')
				conditions.push(like(sql`cast(coalesce(${invoicesIn.amount}, 0) as text)`, `%${supplierQ}%`));
			else if (supplierField === 'date')
				conditions.push(like(sql`coalesce(${invoicesIn.invoiceDate}, '')`, `%${supplierQ}%`));
			else if (supplierField === 'status') conditions.push(like(invoicesIn.status, `%${supplierQ}%`));
			else if (supplierField === 'poNumber')
				conditions.push(like(sql`coalesce(${invoicesIn.poNumber}, '')`, `%${supplierQ}%`));
			else {
				conditions.push(
					or(
						like(invoicesIn.id, `%${supplierQ}%`),
						like(sql`coalesce(${invoicesIn.supplierName}, '')`, `%${supplierQ}%`),
						like(sql`cast(coalesce(${invoicesIn.amount}, 0) as text)`, `%${supplierQ}%`),
						like(sql`coalesce(${invoicesIn.invoiceDate}, '')`, `%${supplierQ}%`),
						like(invoicesIn.status, `%${supplierQ}%`),
						like(sql`coalesce(${invoicesIn.poNumber}, '')`, `%${supplierQ}%`)
					)!
				);
			}
		}

		const invoiceRows = await ctx.db
			.select()
			.from(invoicesIn)
			.where(and(...conditions))
			.orderBy(desc(invoicesIn.invoiceDate), desc(invoicesIn.createdAt));
		const countRows = await ctx.db
			.select({ projectId: invoicesIn.projectId, total: sql<number>`count(*)` })
			.from(invoicesIn)
			.where(isNull(invoicesIn.deletedAt))
			.groupBy(invoicesIn.projectId);
		const projectPage = await getDocHubProjectPicker(
			ctx.db,
			projectFilters,
			countRows,
			invoiceRows.map((row) => row.projectId),
			'supplierInvoiceCount'
		);

		return {
			invoices: invoiceRows.map((item) => ({
				...item,
				projectName: item.projectId ? projectPage.projectMap.get(item.projectId) ?? item.projectId : item.projectId,
				rawParsed: item.rawOcr ? tryParseJson(item.rawOcr) : null
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, supplierQ, listMode, supplierField },
			pagination: projectPage.pagination
		};
	};

	const getContractDocumentDetail = async (projectId: string, contractId: string) => {
		const contract = await documentRepository.findContractById(projectId, contractId);
		if (!contract) return null;

		const docMeta = parseDocumentMetadata(contract.metadata);
		const { fileViewUrl, fileDownloadUrl } = r2FileUrls(contract.fileUrl);
		return { contract, docMeta, fileViewUrl, fileDownloadUrl };
	};

	const updateContractDocument = async (
		projectId: string,
		contractId: string,
		data: { amount: number; currency: string; date: string; notes: string }
	) => {
		const [current] = await ctx.db
			.select({ metadata: contracts.metadata })
			.from(contracts)
			.where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId), isNull(contracts.deletedAt)))
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: data.notes || undefined
		});

		await ctx.db
			.update(contracts)
			.set({
				amount: Number.isFinite(data.amount) ? data.amount : 0,
				currency: data.currency,
				effectiveDate: data.date || null,
				metadata,
				updatedAt: nowIso()
			})
			.where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId), isNull(contracts.deletedAt)));
	};

	const deleteContractDocument = async (projectId: string, contractId: string) => {
		const now = nowIso();
		await ctx.db
			.update(contracts)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId), isNull(contracts.deletedAt)));
	};

	const getQuotationDocumentDetail = async (projectId: string, quotationId: string) => {
		const quotation = await documentRepository.findQuotationById(projectId, quotationId);
		if (!quotation) return null;

		const docMeta = parseDocumentMetadata(quotation.metadata);
		const { fileViewUrl, fileDownloadUrl } = r2FileUrls(quotation.fileUrl);
		return { quotation, docMeta, fileViewUrl, fileDownloadUrl };
	};

	const updateQuotationDocument = async (
		projectId: string,
		quotationId: string,
		data: { quotationNumber: string; amount: number; currency: string; date: string; notes: string }
	) => {
		const [current] = await ctx.db
			.select({ metadata: quotations.metadata })
			.from(quotations)
			.where(
				and(eq(quotations.id, quotationId), eq(quotations.projectId, projectId), isNull(quotations.deletedAt))
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: data.notes || undefined
		});

		await ctx.db
			.update(quotations)
			.set({
				quotationNumber: data.quotationNumber || null,
				amount: Number.isFinite(data.amount) ? data.amount : 0,
				currency: data.currency,
				date: data.date || null,
				metadata,
				updatedAt: nowIso()
			})
			.where(
				and(eq(quotations.id, quotationId), eq(quotations.projectId, projectId), isNull(quotations.deletedAt))
			);
	};

	const deleteQuotationDocument = async (projectId: string, quotationId: string) => {
		const now = nowIso();
		await ctx.db
			.update(quotations)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(eq(quotations.id, quotationId), eq(quotations.projectId, projectId), isNull(quotations.deletedAt))
			);
	};

	const getPurchaseOrderDocumentDetail = async (
		projectId: string,
		purchaseOrderId: string
	) => {
		const purchaseOrder = await documentRepository.findPurchaseOrderById(projectId, purchaseOrderId);
		if (!purchaseOrder) return null;

		const docMeta = parseDocumentMetadata(purchaseOrder.metadata);
		const { fileViewUrl, fileDownloadUrl } = r2FileUrls(purchaseOrder.fileUrl);
		return { purchaseOrder, docMeta, fileViewUrl, fileDownloadUrl };
	};

	const updatePurchaseOrderDocument = async (
		projectId: string,
		purchaseOrderId: string,
		data: {
			poNumber: string;
			supplierName: string;
			amount: number;
			currency: string;
			date: string;
			notes: string;
		}
	) => {
		const [current] = await ctx.db
			.select({ metadata: purchaseOrders.metadata })
			.from(purchaseOrders)
			.where(
				and(
					eq(purchaseOrders.id, purchaseOrderId),
					eq(purchaseOrders.projectId, projectId),
					isNull(purchaseOrders.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: data.notes || undefined
		});

		await ctx.db
			.update(purchaseOrders)
			.set({
				poNumber: data.poNumber,
				supplierName: data.supplierName,
				amount: Number.isFinite(data.amount) ? data.amount : 0,
				currency: data.currency,
				date: data.date || null,
				metadata,
				updatedAt: nowIso()
			})
			.where(
				and(
					eq(purchaseOrders.id, purchaseOrderId),
					eq(purchaseOrders.projectId, projectId),
					isNull(purchaseOrders.deletedAt)
				)
			);
	};

	const deletePurchaseOrderDocument = async (projectId: string, purchaseOrderId: string) => {
		const now = nowIso();
		await ctx.db
			.update(purchaseOrders)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(purchaseOrders.id, purchaseOrderId),
					eq(purchaseOrders.projectId, projectId),
					isNull(purchaseOrders.deletedAt)
				)
			);
	};

	return {
		saveProjectDocument,
		getContractDocHubPage,
		getQuotationDocHubPage,
		getPurchaseOrderDocHubPage,
		getSupplierInvoiceDocHubPage,
		getContractDocumentDetail,
		updateContractDocument,
		deleteContractDocument,
		getQuotationDocumentDetail,
		updateQuotationDocument,
		deleteQuotationDocument,
		getPurchaseOrderDocumentDetail,
		updatePurchaseOrderDocument,
		deletePurchaseOrderDocument
	};
}

export type FinanceDocumentsApi = ReturnType<typeof createFinanceDocumentApi>;

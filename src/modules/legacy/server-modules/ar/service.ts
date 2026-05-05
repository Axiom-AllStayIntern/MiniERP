import { and, eq, isNull, ne } from 'drizzle-orm';
import type { ModuleContext } from '$platform/modules/types';
import {
	CustomerInvoiceRepository,
	SupplierInvoiceRepository,
	PurchaseOrderRepository,
	PaymentRepository,
	DocumentLinkRepository,
	ContractRepository,
	QuotationRepository
} from './repository';
import { NotFoundError, ConflictError } from '$platform/modules/errors';
import { createEvent } from '$platform/modules';
import { buildDocumentMetadata, parseDocumentMetadata } from '$modules/finance/schemas/document-metadata';
import { r2FileUrls } from '$platform/files/r2-file-urls';
import { objectExists } from '$infrastructure/storage/r2';
import { parseStoredInvoiceLineItems } from '$modules/finance/schemas/invoice-line-items';
import { schema } from '$infrastructure/db';

type CustomerInvoiceDraftPayload = {
	projectId?: string;
	customerId?: string;
	date?: string;
	dueDate?: string;
	currency?: string;
	gstType?: 'standard' | 'zero' | 'exempt';
	lineItems?: Array<{ desc: string; qty: number; price: number } & Record<string, unknown>>;
	invoiceNo?: string;
	generatorMeta?: Record<string, unknown>;
};

function escPdfText(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimpleInvoicePdf(params: {
	invoiceNo: string;
	date: string;
	dueDate: string | null;
	currency: string | null;
	customerName: string;
	total: number;
	lines: Array<{ desc: string; qty: number; price: number }>;
}): Uint8Array {
	const rows = params.lines.slice(0, 18);
	const textLines = [
		`SmartFin Invoice`,
		`Invoice No: ${params.invoiceNo}`,
		`Date: ${params.date}`,
		`Due: ${params.dueDate ?? '-'}`,
		`Customer: ${params.customerName}`,
		'',
		'Description | Qty | Unit | Amount'
	];
	for (const row of rows) {
		const amount = row.qty * row.price;
		textLines.push(
			`${row.desc || '-'} | ${row.qty} | ${params.currency} ${row.price.toFixed(2)} | ${params.currency} ${amount.toFixed(2)}`
		);
	}
	textLines.push('', `Total: ${params.currency} ${params.total.toFixed(2)}`);

	const streamParts: string[] = ['BT', '/F1 12 Tf', '50 790 Td', '14 TL'];
	textLines.forEach((line, index) => {
		if (index > 0) streamParts.push('T*');
		streamParts.push(`(${escPdfText(line)}) Tj`);
	});
	streamParts.push('ET');
	const stream = streamParts.join('\n');

	const objects: string[] = [];
	objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
	objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
	objects.push(
		'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj'
	);
	objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
	objects.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);

	let pdf = '%PDF-1.4\n';
	const xref: number[] = [0];
	for (const obj of objects) {
		xref.push(pdf.length);
		pdf += `${obj}\n`;
	}
	const xrefStart = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += '0000000000 65535 f \n';
	for (let index = 1; index <= objects.length; index++) {
		pdf += `${String(xref[index]).padStart(10, '0')} 00000 n \n`;
	}
	pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

	return new TextEncoder().encode(pdf);
}

// ---------------------------------------------------------------------------
// InvoiceService
// ---------------------------------------------------------------------------

export class InvoiceService {
	private customerInvoiceRepo: CustomerInvoiceRepository;
	private supplierInvoiceRepo: SupplierInvoiceRepository;
	private purchaseOrderRepo: PurchaseOrderRepository;

	constructor(private ctx: ModuleContext) {
		this.customerInvoiceRepo = new CustomerInvoiceRepository(ctx.db);
		this.supplierInvoiceRepo = new SupplierInvoiceRepository(ctx.db);
		this.purchaseOrderRepo = new PurchaseOrderRepository(ctx.db);
	}

	/** Calculate GST based on type */
	static calculateGst(subtotal: number, gstType: string): { gstAmount: number; total: number } {
		const rate = gstType === 'standard' ? 0.09 : 0;
		const gstAmount = Math.round(subtotal * rate * 100) / 100;
		const total = Math.round((subtotal + gstAmount) * 100) / 100;
		return { gstAmount, total };
	}

	async createCustomerInvoice(data: {
		projectId: string;
		customerId: string;
		invoiceNo: string;
		date: string;
		dueDate?: string;
		currency?: string;
		subtotal: number;
		gstType?: string;
		lineItems?: string;
		status?: string;
	}) {
		// Check uniqueness
		const existing = await this.customerInvoiceRepo.findByInvoiceNo(data.invoiceNo);
		if (existing) throw new ConflictError(`Invoice number "${data.invoiceNo}" already exists`);

		const gstType = data.gstType ?? 'standard';
		const { gstAmount, total } = InvoiceService.calculateGst(data.subtotal, gstType);

		const created = await this.customerInvoiceRepo.create({
			...data,
			gstType,
			gstAmount,
			total,
			status: data.status ?? 'draft'
		});
		await this.ctx.eventBus.emit(
			createEvent('invoice.created', 'ar', {
				invoiceId: created.id,
				projectId: data.projectId,
				type: 'customer',
				amount: total
			})
		);
		return created;
	}

	async updateCustomerInvoice(id: string, data: Record<string, unknown>) {
		const updated = await this.customerInvoiceRepo.update(id, data);
		const status = typeof data.status === 'string' ? data.status : null;
		if (status === 'voided' || status === 'cancelled') {
			const invoice = await this.customerInvoiceRepo.findById(id);
			if (invoice) {
				await this.ctx.eventBus.emit(
					createEvent('invoice.voided', 'ar', {
						invoiceId: id,
						projectId: invoice.projectId,
						type: 'customer'
					})
				);
			}
		}
		return updated;
	}

	async confirmInvoice(id: string) {
		const invoice = await this.customerInvoiceRepo.findById(id);
		if (!invoice) throw new NotFoundError('CustomerInvoice', id);

		await this.customerInvoiceRepo.update(id, { status: 'confirmed' });

		// Emit event for cross-module reactions (GST, project profit)
		await this.ctx.eventBus.emit(
			createEvent('invoice.confirmed', 'ar', {
				invoiceId: id,
				projectId: invoice.projectId,
				type: 'customer',
				amount: invoice.total
			})
		);

		return invoice;
	}

	async getProjectRevenue(projectId: string) {
		return this.customerInvoiceRepo.getProjectRevenue(projectId);
	}

	async getProjectPurchaseCost(projectId: string) {
		return this.purchaseOrderRepo.getProjectPurchaseCost(projectId);
	}

	async getCustomerInvoicesByProject(projectId: string) {
		return this.customerInvoiceRepo.findByProject(projectId);
	}

	async getSupplierInvoicesByProject(projectId: string) {
		return this.supplierInvoiceRepo.findByProject(projectId);
	}

	async updateCustomerInvoiceDraft(id: string, data: CustomerInvoiceDraftPayload) {
		const [existing] = await this.ctx.db
			.select({ id: schema.invoicesOut.id })
			.from(schema.invoicesOut)
			.where(and(eq(schema.invoicesOut.id, id), isNull(schema.invoicesOut.deletedAt)))
			.limit(1);
		if (!existing) throw new NotFoundError('Invoice');

		const desiredNo = typeof data.invoiceNo === 'string' ? data.invoiceNo.trim() : '';
		if (desiredNo) {
			const [collision] = await this.ctx.db
				.select({ id: schema.invoicesOut.id })
				.from(schema.invoicesOut)
				.where(
					and(
						eq(schema.invoicesOut.invoiceNo, desiredNo),
						isNull(schema.invoicesOut.deletedAt),
						ne(schema.invoicesOut.id, id)
					)
				)
				.limit(1);
			if (collision) throw new ConflictError('This invoice number is already in use.');
		}

		const lineItems = data.lineItems ?? [];
		const subtotal = lineItems.reduce(
			(sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0),
			0
		);
		const gstRate = data.gstType === 'standard' || !data.gstType ? 0.09 : 0;
		const gstAmount = subtotal * gstRate;
		const total = subtotal + gstAmount;

		const storedLineItems =
			data.generatorMeta && typeof data.generatorMeta === 'object'
				? JSON.stringify({ version: 2, lines: lineItems, generator: data.generatorMeta })
				: JSON.stringify(lineItems);

		await this.ctx.db
			.update(schema.invoicesOut)
			.set({
				projectId: data.projectId,
				customerId: data.customerId,
				invoiceNo: desiredNo || undefined,
				date: data.date,
				dueDate: data.dueDate,
				currency: data.currency ?? 'SGD',
				gstType: data.gstType ?? 'standard',
				subtotal,
				gstAmount,
				total,
				lineItems: storedLineItems,
				updatedAt: new Date().toISOString()
			})
			.where(eq(schema.invoicesOut.id, id));

		return { id, invoiceNo: desiredNo || null };
	}

	async getCustomerInvoicePreview(id: string) {
		const [invoice] = await this.ctx.db
			.select()
			.from(schema.invoicesOut)
			.where(eq(schema.invoicesOut.id, id))
			.limit(1);

		if (!invoice) return null;

		const parsed = parseStoredInvoiceLineItems(invoice.lineItems);
		return {
			id: invoice.id,
			invoiceNo: invoice.invoiceNo,
			date: invoice.date,
			dueDate: invoice.dueDate,
			currency: invoice.currency,
			gstType: invoice.gstType,
			subtotal: invoice.subtotal,
			gstAmount: invoice.gstAmount,
			total: invoice.total,
			lineItems: parsed.lines,
			generatorMeta: parsed.generator ?? null
		};
	}

	async issueCustomerInvoicePdf(id: string, uploadedKey = '') {
		const [invoice] = await this.ctx.db
			.select({
				id: schema.invoicesOut.id,
				invoiceNo: schema.invoicesOut.invoiceNo,
				date: schema.invoicesOut.date,
				dueDate: schema.invoicesOut.dueDate,
				currency: schema.invoicesOut.currency,
				total: schema.invoicesOut.total,
				lineItems: schema.invoicesOut.lineItems,
				customerName: schema.customers.name,
				customerId: schema.invoicesOut.customerId
			})
			.from(schema.invoicesOut)
			.leftJoin(schema.customers, eq(schema.invoicesOut.customerId, schema.customers.id))
			.where(eq(schema.invoicesOut.id, id))
			.limit(1);

		if (!invoice) return { status: 'invoice-not-found' as const };

		const keyFromUpload = uploadedKey.trim();
		if (keyFromUpload) {
			if (!(await objectExists(this.ctx.env, keyFromUpload))) {
				return { status: 'uploaded-pdf-not-found' as const };
			}
			await this.ctx.db
				.update(schema.invoicesOut)
				.set({ pdfUrl: keyFromUpload, status: 'issued', updatedAt: new Date().toISOString() })
				.where(eq(schema.invoicesOut.id, invoice.id));
			return { status: 'ok' as const, id: invoice.id, pdfUrl: keyFromUpload };
		}

		const parsed = parseStoredInvoiceLineItems(invoice.lineItems);
		const invoiceCurrency = invoice.currency ?? 'SGD';
		const pdfBytes = buildSimpleInvoicePdf({
			invoiceNo: invoice.invoiceNo,
			date: invoice.date,
			dueDate: invoice.dueDate,
			currency: invoiceCurrency,
			customerName: invoice.customerName ?? invoice.customerId ?? 'Unknown customer',
			total: invoice.total,
			lines: parsed.lines
		});

		const generatedKey = `invoices/out/${invoice.id}.pdf`;
		await this.ctx.env.R2.put(generatedKey, pdfBytes, {
			httpMetadata: { contentType: 'application/pdf' }
		});

		await this.ctx.db
			.update(schema.invoicesOut)
			.set({ pdfUrl: generatedKey, status: 'issued', updatedAt: new Date().toISOString() })
			.where(eq(schema.invoicesOut.id, invoice.id));

		return { status: 'ok' as const, id: invoice.id, pdfUrl: generatedKey };
	}

	async importContractLinesToCustomerInvoice(id: string) {
		const [invoice] = await this.ctx.db
			.select()
			.from(schema.invoicesOut)
			.where(eq(schema.invoicesOut.id, id))
			.limit(1);
		if (!invoice) return null;

		const [contract] = await this.ctx.db
			.select()
			.from(schema.contracts)
			.where(eq(schema.contracts.projectId, invoice.projectId))
			.limit(1);
		if (!contract) {
			return { imported: 0, lineItems: [] };
		}

		const lineItems = [
			{
				desc: 'Imported from contract',
				qty: 1,
				price: contract.amount ?? 0
			}
		];
		const subtotal = lineItems.reduce((sum, line) => sum + line.qty * line.price, 0);
		const gstAmount = invoice.gstType === 'standard' ? subtotal * 0.09 : 0;
		await this.ctx.db
			.update(schema.invoicesOut)
			.set({
				lineItems: JSON.stringify(lineItems),
				subtotal,
				gstAmount,
				total: subtotal + gstAmount,
				updatedAt: new Date().toISOString()
			})
			.where(eq(schema.invoicesOut.id, invoice.id));

		return { imported: lineItems.length, lineItems };
	}
}

// ---------------------------------------------------------------------------
// ArDocumentService
// ---------------------------------------------------------------------------

export class ArDocumentService {
	constructor(private ctx: ModuleContext) {}

	async getContractDocumentDetail(projectId: string, contractId: string) {
		const [contract] = await this.ctx.db
			.select()
			.from(schema.contracts)
			.where(
				and(
					eq(schema.contracts.id, contractId),
					eq(schema.contracts.projectId, projectId),
					isNull(schema.contracts.deletedAt)
				)
			)
			.limit(1);

		if (!contract) return null;

		const docMeta = parseDocumentMetadata(contract.metadata);
		const { fileViewUrl, fileDownloadUrl } = r2FileUrls(contract.fileUrl);
		return { contract, docMeta, fileViewUrl, fileDownloadUrl };
	}

	async updateContractDocument(
		projectId: string,
		contractId: string,
		data: { amount: number; currency: string; date: string; notes: string }
	) {
		const [current] = await this.ctx.db
			.select({ metadata: schema.contracts.metadata })
			.from(schema.contracts)
			.where(
				and(
					eq(schema.contracts.id, contractId),
					eq(schema.contracts.projectId, projectId),
					isNull(schema.contracts.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: data.notes || undefined
		});

		await this.ctx.db
			.update(schema.contracts)
			.set({
				amount: Number.isFinite(data.amount) ? data.amount : 0,
				currency: data.currency,
				effectiveDate: data.date || null,
				metadata,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.contracts.id, contractId),
					eq(schema.contracts.projectId, projectId),
					isNull(schema.contracts.deletedAt)
				)
			);
	}

	async deleteContractDocument(projectId: string, contractId: string) {
		const now = new Date().toISOString();
		await this.ctx.db
			.update(schema.contracts)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.contracts.id, contractId),
					eq(schema.contracts.projectId, projectId),
					isNull(schema.contracts.deletedAt)
				)
			);
	}

	async getQuotationDocumentDetail(projectId: string, quotationId: string) {
		const [quotation] = await this.ctx.db
			.select()
			.from(schema.quotations)
			.where(
				and(
					eq(schema.quotations.id, quotationId),
					eq(schema.quotations.projectId, projectId),
					isNull(schema.quotations.deletedAt)
				)
			)
			.limit(1);

		if (!quotation) return null;

		const docMeta = parseDocumentMetadata(quotation.metadata);
		const { fileViewUrl, fileDownloadUrl } = r2FileUrls(quotation.fileUrl);
		return { quotation, docMeta, fileViewUrl, fileDownloadUrl };
	}

	async updateQuotationDocument(
		projectId: string,
		quotationId: string,
		data: { quotationNumber: string; amount: number; currency: string; date: string; notes: string }
	) {
		const [current] = await this.ctx.db
			.select({ metadata: schema.quotations.metadata })
			.from(schema.quotations)
			.where(
				and(
					eq(schema.quotations.id, quotationId),
					eq(schema.quotations.projectId, projectId),
					isNull(schema.quotations.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: data.notes || undefined
		});

		await this.ctx.db
			.update(schema.quotations)
			.set({
				quotationNumber: data.quotationNumber || null,
				amount: Number.isFinite(data.amount) ? data.amount : 0,
				currency: data.currency,
				date: data.date || null,
				metadata,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.quotations.id, quotationId),
					eq(schema.quotations.projectId, projectId),
					isNull(schema.quotations.deletedAt)
				)
			);
	}

	async deleteQuotationDocument(projectId: string, quotationId: string) {
		const now = new Date().toISOString();
		await this.ctx.db
			.update(schema.quotations)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.quotations.id, quotationId),
					eq(schema.quotations.projectId, projectId),
					isNull(schema.quotations.deletedAt)
				)
			);
	}

	async getPurchaseOrderDocumentDetail(projectId: string, purchaseOrderId: string) {
		const [purchaseOrder] = await this.ctx.db
			.select()
			.from(schema.purchaseOrders)
			.where(
				and(
					eq(schema.purchaseOrders.id, purchaseOrderId),
					eq(schema.purchaseOrders.projectId, projectId),
					isNull(schema.purchaseOrders.deletedAt)
				)
			)
			.limit(1);

		if (!purchaseOrder) return null;

		const docMeta = parseDocumentMetadata(purchaseOrder.metadata);
		const { fileViewUrl, fileDownloadUrl } = r2FileUrls(purchaseOrder.fileUrl);
		return { purchaseOrder, docMeta, fileViewUrl, fileDownloadUrl };
	}

	async updatePurchaseOrderDocument(
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
	) {
		const [current] = await this.ctx.db
			.select({ metadata: schema.purchaseOrders.metadata })
			.from(schema.purchaseOrders)
			.where(
				and(
					eq(schema.purchaseOrders.id, purchaseOrderId),
					eq(schema.purchaseOrders.projectId, projectId),
					isNull(schema.purchaseOrders.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: data.notes || undefined
		});

		await this.ctx.db
			.update(schema.purchaseOrders)
			.set({
				poNumber: data.poNumber,
				supplierName: data.supplierName,
				amount: Number.isFinite(data.amount) ? data.amount : 0,
				currency: data.currency,
				date: data.date || null,
				metadata,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.purchaseOrders.id, purchaseOrderId),
					eq(schema.purchaseOrders.projectId, projectId),
					isNull(schema.purchaseOrders.deletedAt)
				)
			);
	}

	async deletePurchaseOrderDocument(projectId: string, purchaseOrderId: string) {
		const now = new Date().toISOString();
		await this.ctx.db
			.update(schema.purchaseOrders)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.purchaseOrders.id, purchaseOrderId),
					eq(schema.purchaseOrders.projectId, projectId),
					isNull(schema.purchaseOrders.deletedAt)
				)
			);
	}
}

// ---------------------------------------------------------------------------
// PaymentService
// ---------------------------------------------------------------------------

export class PaymentService {
	private repo: PaymentRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new PaymentRepository(ctx.db);
	}

	async recordPayment(data: {
		direction: 'inbound' | 'outbound';
		amount: number;
		currency?: string;
		paymentDate: string;
		businessPartnerId?: string;
		projectId?: string;
		invoiceId?: string;
		invoiceType?: string;
		method?: string;
		reference?: string;
		note?: string;
	}) {
		const result = await this.repo.create({
			...data,
			currency: data.currency ?? 'SGD',
			status: 'completed'
		});

		const eventType = data.direction === 'inbound' ? 'payment.received' : 'payment.made';
		await this.ctx.eventBus.emit(
			createEvent(eventType, 'ar', {
				paymentId: result.id,
				invoiceId: data.invoiceId,
				projectId: data.projectId,
				amount: data.amount
			})
		);

		return result;
	}

	async getByInvoice(invoiceId: string) {
		return this.repo.findByInvoice(invoiceId);
	}

	async getByProject(projectId: string) {
		return this.repo.findByProject(projectId);
	}
}

// ---------------------------------------------------------------------------
// DocumentLinkService
// ---------------------------------------------------------------------------

export class DocumentLinkService {
	private repo: DocumentLinkRepository;

	constructor(ctx: ModuleContext) {
		this.repo = new DocumentLinkRepository(ctx.db);
	}

	async linkDocuments(input: {
		fromType: string;
		fromId: string;
		toType: string;
		toId: string;
		linkType: string;
	}) {
		return this.repo.link(input);
	}

	async getLinkedDocuments(type: string, id: string) {
		return this.repo.findLinkedDocuments(type, id);
	}
}

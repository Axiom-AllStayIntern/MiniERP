import { and, eq, isNull } from 'drizzle-orm';
import type { ModuleContext } from '../types';
import {
	CustomerInvoiceRepository,
	SupplierInvoiceRepository,
	PurchaseOrderRepository,
	PaymentRepository,
	DocumentLinkRepository,
	ContractRepository,
	QuotationRepository
} from './repository';
import { NotFoundError, ConflictError } from '../errors';
import { createEvent } from '../event-bus';
import { buildDocumentMetadata, parseDocumentMetadata } from '$lib/server/document-metadata';
import { r2FileUrls } from '$lib/server/r2-file-urls';
import { schema } from '../../db';

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

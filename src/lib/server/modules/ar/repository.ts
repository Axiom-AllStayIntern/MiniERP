import { eq, isNull, and, sql, desc } from 'drizzle-orm';
import type { DBClient } from '../../db';
import {
	contracts,
	quotations,
	invoicesOut,
	purchaseOrders,
	invoicesIn,
	payments,
	arDocumentLinks
} from './schema';
import { BaseRepository } from '../base-repository';
import { revenue } from '../expense/schema';
import { projectRevenueTotalSumExpr } from '../expense/repository';

// ---------------------------------------------------------------------------
// ContractRepository
// ---------------------------------------------------------------------------

export class ContractRepository extends BaseRepository<typeof contracts> {
	constructor(db: DBClient) {
		super(db, contracts);
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(contracts)
			.where(and(eq(contracts.projectId, projectId), isNull(contracts.deletedAt)))
			.orderBy(desc(contracts.createdAt));
	}
}

// ---------------------------------------------------------------------------
// QuotationRepository
// ---------------------------------------------------------------------------

export class QuotationRepository extends BaseRepository<typeof quotations> {
	constructor(db: DBClient) {
		super(db, quotations);
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(quotations)
			.where(and(eq(quotations.projectId, projectId), isNull(quotations.deletedAt)))
			.orderBy(desc(quotations.createdAt));
	}
}

// ---------------------------------------------------------------------------
// CustomerInvoiceRepository (invoicesOut)
// ---------------------------------------------------------------------------

export class CustomerInvoiceRepository extends BaseRepository<typeof invoicesOut> {
	constructor(db: DBClient) {
		super(db, invoicesOut);
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(invoicesOut)
			.where(and(eq(invoicesOut.projectId, projectId), isNull(invoicesOut.deletedAt)))
			.orderBy(desc(invoicesOut.createdAt));
	}

	/** Total revenue for a project (sum in SGD — uses `revenue` / FX equivalent, not face `amount` alone). */
	async getProjectRevenue(projectId: string) {
		const rows = await this.db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(revenue)
			.where(and(eq(revenue.projectId, projectId), isNull(revenue.deletedAt)));
		return rows[0]?.total ?? 0;
	}

	async findByInvoiceNo(invoiceNo: string) {
		const rows = await this.db
			.select()
			.from(invoicesOut)
			.where(eq(invoicesOut.invoiceNo, invoiceNo))
			.limit(1);
		return rows[0] ?? null;
	}
}

// ---------------------------------------------------------------------------
// PurchaseOrderRepository
// ---------------------------------------------------------------------------

export class PurchaseOrderRepository extends BaseRepository<typeof purchaseOrders> {
	constructor(db: DBClient) {
		super(db, purchaseOrders);
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(purchaseOrders)
			.where(and(eq(purchaseOrders.projectId, projectId), isNull(purchaseOrders.deletedAt)))
			.orderBy(desc(purchaseOrders.createdAt));
	}

	/** Total purchase cost for a project */
	async getProjectPurchaseCost(projectId: string) {
		const rows = await this.db
			.select({ total: sql<number>`coalesce(sum(${invoicesIn.amount}), 0)` })
			.from(invoicesIn)
			.where(and(eq(invoicesIn.projectId, projectId), isNull(invoicesIn.deletedAt)));
		return rows[0]?.total ?? 0;
	}
}

// ---------------------------------------------------------------------------
// SupplierInvoiceRepository (invoicesIn)
// ---------------------------------------------------------------------------

export class SupplierInvoiceRepository extends BaseRepository<typeof invoicesIn> {
	constructor(db: DBClient) {
		super(db, invoicesIn);
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(invoicesIn)
			.where(and(eq(invoicesIn.projectId, projectId), isNull(invoicesIn.deletedAt)))
			.orderBy(desc(invoicesIn.createdAt));
	}
}

// ---------------------------------------------------------------------------
// PaymentRepository
// ---------------------------------------------------------------------------

export class PaymentRepository extends BaseRepository<typeof payments> {
	constructor(db: DBClient) {
		super(db, payments);
	}

	async findByInvoice(invoiceId: string) {
		return this.db
			.select()
			.from(payments)
			.where(and(eq(payments.invoiceId, invoiceId), isNull(payments.deletedAt)))
			.orderBy(desc(payments.paymentDate));
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(payments)
			.where(and(eq(payments.projectId, projectId), isNull(payments.deletedAt)))
			.orderBy(desc(payments.paymentDate));
	}
}

// ---------------------------------------------------------------------------
// DocumentLinkRepository
// ---------------------------------------------------------------------------

export class DocumentLinkRepository {
	constructor(private db: DBClient) {}

	async link(input: {
		fromType: string;
		fromId: string;
		toType: string;
		toId: string;
		linkType: string;
	}) {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		await this.db.insert(arDocumentLinks).values({
			id,
			fromType: input.fromType as any,
			fromId: input.fromId,
			toType: input.toType as any,
			toId: input.toId,
			linkType: input.linkType as any,
			createdAt: now,
			updatedAt: now
		});
		return id;
	}

	async findLinkedDocuments(type: string, id: string) {
		const outgoing = await this.db
			.select()
			.from(arDocumentLinks)
			.where(
				and(
					eq(arDocumentLinks.fromType, type as any),
					eq(arDocumentLinks.fromId, id),
					isNull(arDocumentLinks.deletedAt)
				)
			);
		const incoming = await this.db
			.select()
			.from(arDocumentLinks)
			.where(
				and(
					eq(arDocumentLinks.toType, type as any),
					eq(arDocumentLinks.toId, id),
					isNull(arDocumentLinks.deletedAt)
				)
			);
		return { outgoing, incoming };
	}
}

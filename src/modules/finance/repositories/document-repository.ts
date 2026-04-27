import { and, eq, isNull } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { contracts, purchaseOrders, quotations } from '../../../infrastructure/db/schema';

export class DocumentRepository {
	constructor(private db: DBClient) {}

	async findContractById(projectId: string, contractId: string) {
		const rows = await this.db
			.select()
			.from(contracts)
			.where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId), isNull(contracts.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}

	async findQuotationById(projectId: string, quotationId: string) {
		const rows = await this.db
			.select()
			.from(quotations)
			.where(
				and(
					eq(quotations.id, quotationId),
					eq(quotations.projectId, projectId),
					isNull(quotations.deletedAt)
				)
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async findPurchaseOrderById(projectId: string, purchaseOrderId: string) {
		const rows = await this.db
			.select()
			.from(purchaseOrders)
			.where(
				and(
					eq(purchaseOrders.id, purchaseOrderId),
					eq(purchaseOrders.projectId, projectId),
					isNull(purchaseOrders.deletedAt)
				)
			)
			.limit(1);
		return rows[0] ?? null;
	}
}

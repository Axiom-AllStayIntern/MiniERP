export interface MockPurchaseOrder {
	id: string;
	poNumber: string;
	supplierId: string;
	supplierName: string;
	totalAmount: number;
	currency: string;
	issuedAt: string;
}

export const MOCK_PURCHASE_ORDERS: MockPurchaseOrder[] = [
	{
		id: 'po-2026-0156',
		poNumber: 'PO-2026-0156',
		supplierId: 'sup-axiom-tech',
		supplierName: 'Axiom Tech',
		totalAmount: 12450,
		currency: 'SGD',
		issuedAt: '2026-04-08'
	},
	{
		id: 'po-2026-0162',
		poNumber: 'PO-2026-0162',
		supplierId: 'sup-axiom-tech',
		supplierName: 'Axiom Tech',
		totalAmount: 9800,
		currency: 'SGD',
		issuedAt: '2026-04-19'
	},
	{
		id: 'po-2026-0149',
		poNumber: 'PO-2026-0149',
		supplierId: 'sup-cloudfactor',
		supplierName: 'Cloudfactor SG',
		totalAmount: 4860,
		currency: 'SGD',
		issuedAt: '2026-04-04'
	},
	{
		id: 'po-2026-0173',
		poNumber: 'PO-2026-0173',
		supplierId: 'sup-neon-robotics',
		supplierName: 'Neon Robotics',
		totalAmount: 27800,
		currency: 'SGD',
		issuedAt: '2026-04-12'
	}
];

export interface ScorePurchaseOrderInput {
	supplierId?: string;
	supplierName?: string;
	totalAmount?: number;
	currency?: string;
}

export function scorePurchaseOrder(
	query: ScorePurchaseOrderInput,
	po: MockPurchaseOrder
): number {
	let score = 0;
	if (query.supplierId && query.supplierId === po.supplierId) score += 0.6;
	else if (query.supplierName && po.supplierName.toLowerCase().includes(query.supplierName.toLowerCase())) score += 0.4;

	if (typeof query.totalAmount === 'number') {
		const diff = Math.abs(po.totalAmount - query.totalAmount);
		const tolerance = Math.max(po.totalAmount * 0.02, 1);
		if (diff <= tolerance) score += 0.4;
		else if (diff <= po.totalAmount * 0.1) score += 0.2;
	}

	if (query.currency && po.currency === query.currency) score += 0.05;

	return Math.min(score, 1);
}

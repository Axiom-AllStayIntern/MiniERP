export interface MockSupplier {
	id: string;
	name: string;
	recentInvoiceCount: number;
}

export const MOCK_SUPPLIER_DIRECTORY: MockSupplier[] = [
	{ id: 'sup-axiom-tech', name: 'Axiom Tech', recentInvoiceCount: 14 },
	{ id: 'sup-cloudfactor', name: 'Cloudfactor SG', recentInvoiceCount: 8 },
	{ id: 'sup-neon-robotics', name: 'Neon Robotics', recentInvoiceCount: 3 },
	{ id: 'sup-bridge-cargo', name: 'Bridge Cargo Services', recentInvoiceCount: 5 },
	{ id: 'sup-amber-print', name: 'Amber Print Studio', recentInvoiceCount: 2 }
];

function tokenize(value: string): string[] {
	return value
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 2);
}

export function scoreSupplier(query: string, supplier: MockSupplier): number {
	if (!query) return 0;
	const haystack = supplier.name.toLowerCase();
	const queryLower = query.toLowerCase();
	if (haystack === queryLower) return 1;
	if (haystack.includes(queryLower)) return 0.85;
	if (queryLower.includes(haystack)) return 0.8;

	const queryTokens = new Set(tokenize(query));
	const supplierTokens = tokenize(supplier.name);
	if (queryTokens.size === 0 || supplierTokens.length === 0) return 0;
	let overlap = 0;
	for (const token of supplierTokens) {
		if (queryTokens.has(token)) overlap += 1;
	}
	return overlap / supplierTokens.length;
}

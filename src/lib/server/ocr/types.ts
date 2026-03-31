export type OcrQueueMessage = {
	id: string;
	fileKey: string;
	fileType: string;
	entityType: 'invoice_in' | 'expense' | 'contract' | 'quotation';
	entityId: string;
	projectId: string;
};

export type ExtractedInvoiceFields = {
	invoiceDate: string | null;
	totalAmount: number | null;
	currency: string | null;
	supplierName: string | null;
	gstAmount: number | null;
	poNumber: string | null;
	dueDate: string | null;
	confidence: number;
	rawText: string;
};

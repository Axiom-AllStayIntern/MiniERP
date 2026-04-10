export type OcrQueueMessage = {
	id: string;
	fileKey: string;
	fileType: string;
	entityType: 'invoice_in' | 'expense' | 'contract' | 'quotation';
	entityId: string;
	projectId: string;
};

export type ConfidenceBand = 'low' | 'medium' | 'high';

export type SourceSnippetMap = Partial<
	Record<'supplierName' | 'invoiceDate' | 'dueDate' | 'totalAmount' | 'gstAmount' | 'poNumber', string>
>;

export type ExtractedInvoiceFields = {
	invoiceDate: string | null;
	totalAmount: number | null;
	currency: string | null;
	supplierName: string | null;
	gstAmount: number | null;
	poNumber: string | null;
	dueDate: string | null;
	confidence: number;
	confidenceBand: ConfidenceBand;
	needsReview: boolean;
	validationWarnings: string[];
	sourceSnippets: SourceSnippetMap;
	extractionMethod: 'pdf_text' | 'external_ocr';
	ocrProvider: 'builtin_pdf' | 'external_api' | 'external_api_mock';
	llmProvider: 'heuristic' | 'external_api' | 'workers_ai';
	promptVersion: string;
	rawText: string;
};

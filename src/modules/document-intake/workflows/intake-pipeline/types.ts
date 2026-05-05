/**
 * Shared types for the document-intake pipeline.
 *
 * Each extractor returns Partial<ExtractedFields> â€?only the keys relevant
 * to its document shape. ReviewStep on the client picks the subset it
 * needs per spec (see schemas/intake-field-specs.ts). Keeping one superset type avoids a
 * proliferation of per-category result shapes while still letting each
 * extractor own its own prompt.
 */

import type { Bucket } from '$modules/document-intake/schemas/intake-field-specs';
import type { DocType } from '$platform/ai/ocr/classify';

export type { Bucket, DocType };

export type ExpenseTypeT = 'opex' | 'sales_cost';
export type CategoryDocType = 'invoice' | 'receipt' | 'po';

/** Full superset of fields the UI might want to pre-fill. Every extractor
 *  returns a partial of this shape. */
export interface ExtractedFields {
	// Common â€?invoice/receipt/PO/contract/quotation all share these
	documentDate: string | null;
	dueDate: string | null;
	totalAmount: number | null;
	currency: string | null;
	gstAmount: number | null;

	// Parties
	supplierName: string | null;
	clientName: string | null;

	// Reference numbers â€?populated per doc shape
	invoiceNumber: string | null;
	receiptNumber: string | null;
	poNumber: string | null;
	quotationNumber: string | null;
	contractNumber: string | null;
	trackingNumber: string | null;

	// Contract-specific
	effectiveDate: string | null;
	expiryDate: string | null;
	paymentTerms: string | null;
	scope: string | null;

	// Quotation-specific
	validUntil: string | null;

	// PO / description
	description: string | null;

	// Expense / travel
	staffName: string | null;
	destination: string | null;
	dateStart: string | null;
	dateEnd: string | null;

	// Revenue sub-typing
	invoiceType: 'standard' | 'zero_rate' | 'tax_invoice' | null;
}

export interface ProjectMatch {
	id: string;
	name: string;
	customerName: string | null;
	score: number;
}

/** Final result returned by pipeline.run / pipeline.reclassify. Maps to
 *  the shape the UI's classifyResult state expects. */
export interface IntakeResult {
	bucket: Bucket;
	docType: string;
	expenseType: ExpenseTypeT | null;
	category: string | null;
	categoryDocType: CategoryDocType | null;
	fields: Partial<ExtractedFields>;
	projectMatches: ProjectMatch[];
	confidence: number;
	narration: string;
	provider: {
		classifier: string;
		extractor: string;
	};
}

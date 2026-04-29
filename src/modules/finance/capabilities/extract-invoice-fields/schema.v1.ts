import { z } from 'zod';

/**
 * Invoice extraction LLM output schema (v1).
 *
 * Versioned per ref_files/v4/phase0-6/05 §13. The capability records
 * `schemaVersion: 'v1'` in the audit metadata so a future v2 can land
 * without breaking historical extractions.
 */
export const invoiceExtractionLlmSchemaV1 = z.object({
	supplierName: z.string().nullable(),
	invoiceNumber: z.string().nullable(),
	issueDate: z.string().nullable(),
	dueDate: z.string().nullable(),
	totalAmount: z.number().finite().nullable(),
	gstAmount: z.number().finite().nullable(),
	currency: z.string().nullable(),
	confidence: z.number().min(0).max(1).optional()
});

export type InvoiceExtractionLlmV1 = z.infer<typeof invoiceExtractionLlmSchemaV1>;

export const INVOICE_EXTRACTION_SCHEMA_NAME = 'finance.invoice-extraction';
export const INVOICE_EXTRACTION_SCHEMA_VERSION = 'v1';

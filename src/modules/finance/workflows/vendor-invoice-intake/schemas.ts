import { z } from 'zod';

export const triggerInputSchema = z.object({
	source: z.enum(['quick_action', 'today_brief', 'main_app', 'agent_intent']),
	intentHint: z.string().optional()
});

export const documentIntakeOutputSchema = z.object({
	documentId: z.string(),
	fileName: z.string().optional(),
	storageKey: z.string().optional()
});

export const extractedInvoiceFieldsSchema = z.object({
	documentNumber: z.string(),
	counterpartyName: z.string(),
	currency: z.string().min(1),
	totalAmount: z.number().finite(),
	gstAmount: z.number().finite(),
	issueDate: z.string(),
	dueDate: z.string()
});

export const fieldExtractionOutputSchema = z.object({
	fields: extractedInvoiceFieldsSchema,
	confidence: z.number().min(0).max(1),
	evidence: z.array(
		z.object({
			type: z.literal('extracted_field'),
			refId: z.string(),
			summary: z.string()
		})
	)
});

export const matchingOutputSchema = z.object({
	supplierCandidates: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			matchScore: z.number().min(0).max(1),
			recentInvoiceCount: z.number().int().nonnegative()
		})
	),
	poCandidates: z.array(
		z.object({
			id: z.string(),
			poNumber: z.string(),
			supplierId: z.string(),
			supplierName: z.string(),
			totalAmount: z.number().finite(),
			currency: z.string(),
			matchScore: z.number().min(0).max(1)
		})
	),
	duplicate: z.object({
		isDuplicate: z.boolean(),
		reason: z.string().nullable()
	})
});

export const confirmationDraftSchema = z.object({
	documentId: z.string(),
	supplierId: z.string().nullable(),
	poId: z.string().nullable(),
	projectId: z.string().nullable(),
	fields: extractedInvoiceFieldsSchema
});

export type TriggerInput = z.infer<typeof triggerInputSchema>;
export type DocumentIntakeOutput = z.infer<typeof documentIntakeOutputSchema>;
export type ExtractedInvoiceFields = z.infer<typeof extractedInvoiceFieldsSchema>;
export type FieldExtractionOutput = z.infer<typeof fieldExtractionOutputSchema>;
export type MatchingOutput = z.infer<typeof matchingOutputSchema>;
export type ConfirmationDraft = z.infer<typeof confirmationDraftSchema>;

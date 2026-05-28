import { z } from 'zod';
import { runWorkersVisionJson } from '$platform/ai/ocr/workers-vision-ocr';
import type { FinanceCapability, FinanceCapabilityContext } from '../types';
import {
	FALLBACK_CATEGORY_ID,
	FINANCE_CATEGORY_CATALOG,
	findCategoryById,
	type CategoryDefinition
} from '../../workflows/financial-document-intake/categories';

export interface ClassifyDocumentCategoryInput {
	documentId: string;
	fileName?: string;
	imageBytes: Uint8Array;
	mimeType: string;
}

export interface ClassifyDocumentCategoryOutput {
	categoryId: string | null;
	confidence: number;
	reason?: string;
	provider: 'workers_ai' | 'mock-v1' | 'none';
	modelId?: string;
}

const classifyCategorySchema = z.object({
	categoryId: z.string().nullable(),
	confidence: z.number().min(0).max(1),
	reason: z.string().nullable().optional()
});

const VISION_CATEGORY_PROMPT_VERSION = 'finance-classify-document-category-v1';

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function categoryChoices(): string {
	return FINANCE_CATEGORY_CATALOG
		.filter((category) => category.hasDocument)
		.map((category) => {
			const fields = category.llmFields.length ? ` fields=${category.llmFields.join(', ')}` : '';
			return `- ${category.id}: ${category.label}${category.sublabel ? ` (${category.sublabel})` : ''}; bucket=${category.bucket}; docType=${category.categoryDocType ?? 'none'};${fields}`;
		})
		.join('\n');
}

function isValidDocumentCategory(categoryId: string | null | undefined): categoryId is string {
	if (!categoryId) return false;
	const category = findCategoryById(categoryId);
	return Boolean(category?.hasDocument);
}

function filenameHint(fileName?: string): string {
	return fileName ? `Filename: ${fileName.slice(0, 160)}` : 'Filename: unavailable';
}

export function documentTypeForFinanceCategory(
	category: CategoryDefinition | undefined
): 'supplier_invoice' | 'receipt' | 'purchase_order' | 'customer_invoice' | 'logistics_document' | 'contract' | 'quotation' | 'bank_statement' | 'tax_document' | 'unknown' {
	switch (category?.categoryDocType) {
		case 'invoice':
			return 'supplier_invoice';
		case 'receipt':
			return 'receipt';
		case 'po':
		case 'purchase_order_doc':
			return 'purchase_order';
		case 'invoice_out':
			return 'customer_invoice';
		case 'contract':
			return 'contract';
		case 'quotation':
			return 'quotation';
		default:
			return 'unknown';
	}
}

export const classifyDocumentCategoryCapability: FinanceCapability<
	ClassifyDocumentCategoryInput,
	ClassifyDocumentCategoryOutput
> = {
	id: 'finance.classify-document-category',
	description: 'Classify a document image directly into a finance intake category.',
	riskLevel: 'R1',

	async execute(input, ctx: FinanceCapabilityContext): Promise<ClassifyDocumentCategoryOutput> {
		if (ctx.useMock || !ctx.env?.AI) {
			return {
				categoryId: FALLBACK_CATEGORY_ID,
				confidence: 0.6,
				reason: 'Mock image category classification.',
				provider: 'mock-v1'
			};
		}

		const result = await runWorkersVisionJson(ctx.env, {
			imageBytes: input.imageBytes,
			mimeType: input.mimeType,
			schema: classifyCategorySchema,
			maxTokens: 1024,
			systemPrompt: `You classify one finance document image for SmartFin.

Pick exactly one categoryId from this allow-list, or null if the image is unreadable or none applies:
${categoryChoices()}

Definitions:
- Supplier invoice: a vendor/supplier bills our company; we owe/pay the issuer.
- Customer invoice: our company invoices a customer/client; the customer owes/pays us.
- Receipt: payment proof, card receipt, ride/meal/hotel/logistics receipt, or small expense proof.
- Purchase order / contract / quotation are archive documents unless the category explicitly says expense purchase.

Return JSON only with:
- categoryId: one allowed id string or null
- confidence: number from 0 to 1
- reason: short explanation`,
			userPrompt: `${filenameHint(input.fileName)}
Document id: ${input.documentId}

Look at the image and choose the best categoryId.`
		});

		if (!result.ok) {
			return {
				categoryId: null,
				confidence: 0,
				reason: result.error,
				provider: 'none',
				modelId: result.model
			};
		}

		const categoryId = isValidDocumentCategory(result.value.categoryId)
			? result.value.categoryId
			: null;
		return {
			categoryId,
			confidence: categoryId ? clamp01(result.value.confidence) : 0,
			reason: result.value.reason ?? undefined,
			provider: 'workers_ai',
			modelId: result.model
		};
	}
};

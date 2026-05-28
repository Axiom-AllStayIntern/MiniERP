import { z } from 'zod';
import { runWorkersVisionJson } from '$platform/ai/ocr/workers-vision-ocr';
import type { FinanceCapability, FinanceCapabilityContext } from '../types';
import {
	FALLBACK_CATEGORY_ID,
	FINANCE_CATEGORY_CATALOG,
	categoryIdForDocumentType,
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
	categoryId: z.string().nullable().optional(),
	documentType: z.string().nullable().optional(),
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

function normalizeDocumentType(value: string | null | undefined): Parameters<typeof categoryIdForDocumentType>[0] | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase().replace(/[-\s]/g, '_');
	const aliases: Record<string, Parameters<typeof categoryIdForDocumentType>[0]> = {
		invoice_in: 'supplier_invoice',
		vendor_invoice: 'supplier_invoice',
		supplier_bill: 'supplier_invoice',
		supplier_invoice: 'supplier_invoice',
		bill: 'supplier_invoice',
		ai_subscription: 'supplier_invoice',
		saas: 'supplier_invoice',
		subscription: 'supplier_invoice',
		invoice_out: 'customer_invoice',
		sales_invoice: 'customer_invoice',
		customer_invoice: 'customer_invoice',
		receipt: 'receipt',
		expense_receipt: 'receipt',
		transport: 'receipt',
		taxi: 'receipt',
		grab: 'receipt',
		mrt: 'receipt',
		meal: 'receipt',
		food: 'receipt',
		accommodation: 'receipt',
		hotel: 'receipt',
		gift: 'receipt',
		payment_voucher: 'receipt',
		po: 'purchase_order',
		purchase_order_doc: 'purchase_order',
		purchase_order: 'purchase_order',
		contract: 'contract',
		agreement: 'contract',
		service_agreement: 'contract',
		quotation: 'quotation',
		quote: 'quotation',
		proposal: 'quotation',
		estimate: 'quotation',
		proforma: 'quotation',
		bank_statement: 'bank_statement',
		statement: 'bank_statement',
		tax_document: 'tax_document',
		tax: 'tax_document',
		gst_return: 'tax_document',
		logistics_document: 'logistics_document',
		logistics: 'logistics_document',
		shipping: 'logistics_document',
		courier: 'logistics_document',
		unknown: 'unknown'
	};
	return aliases[normalized] ?? null;
}

function fuzzyMatchCategoryId(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const normalized = raw.trim().toLowerCase().replace(/[-\s]/g, '_');
	return FINANCE_CATEGORY_CATALOG.find(
		(c) => c.hasDocument && (c.id.endsWith('.' + normalized) || c.id === normalized)
	)?.id ?? null;
}

function resolveCategoryId(value: {
	categoryId?: string | null;
	documentType?: string | null;
}): string | null {
	if (isValidDocumentCategory(value.categoryId)) return value.categoryId;
	const fromCategoryAsDocType = normalizeDocumentType(value.categoryId);
	if (fromCategoryAsDocType) return categoryIdForDocumentType(fromCategoryAsDocType);
	const fuzzy = fuzzyMatchCategoryId(value.categoryId);
	if (fuzzy) return fuzzy;
	const fromDocType = normalizeDocumentType(value.documentType);
	return fromDocType ? categoryIdForDocumentType(fromDocType) : null;
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

CRITICAL: categoryId MUST be one of the exact id strings listed above. Do NOT invent IDs.
If uncertain, set categoryId to null and use documentType as fallback.

Return JSON only with:
- categoryId: one allowed id string or null
- documentType: optional fallback, one of supplier_invoice, customer_invoice, receipt, purchase_order, contract, quotation, bank_statement, tax_document, logistics_document, unknown
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

		const categoryId = resolveCategoryId(result.value);
		const invalidCategory =
			result.value.categoryId && !categoryId
				? ` Model returned unsupported categoryId "${result.value.categoryId}".`
				: '';
		return {
			categoryId,
			confidence: categoryId ? clamp01(result.value.confidence) : 0,
			reason: `${result.value.reason ?? 'Vision classifier completed.'}${invalidCategory}`.trim(),
			provider: 'workers_ai',
			modelId: result.model
		};
	}
};

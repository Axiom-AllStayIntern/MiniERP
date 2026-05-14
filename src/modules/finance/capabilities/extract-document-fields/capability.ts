/**
 * extract-document-fields — generalized document field extraction (Phase 3).
 *
 * Replaces the Phase-2 `finance.extract-invoice-fields` (which hard-coded the
 * supplier-invoice shape). The inbox path is intentionally LLM-only for real
 * extracted text: finance documents vary too much for regex extraction to be a
 * safe source of user-confirmable values.
 *
 * Output is category-field oriented for the Inbox pipeline: keys match the
 * selected category's `llmFields` (`invoice_number`, `vendor`,
 * `tracking_number`, etc.). Legacy workflow callers can request the old
 * common field projection via `outputShape: 'legacy'`.
 */
import type { ZodType } from 'zod';
import { runStructuredOutput } from '../../../../platform/ai/ai-runtime';
import {
	findCategoryById,
	type CategoryDefinition,
	type CategoryDocType
} from '../../workflows/financial-document-intake/categories';
import type { FinanceEvidence } from '../../agent/types';
import type { FinanceCapability, FinanceCapabilityContext } from '../types';
import {
	buildEvidence,
	pickFixture,
	type ExtractionProvider
} from '../extract-invoice-fields/mock';
import {
	contractSchemaV1,
	customerInvoiceSchemaV1,
	invoiceSchemaV1,
	poSchemaV1,
	quotationSchemaV1,
	receiptSchemaV1,
	EXTRACT_DOCUMENT_FIELDS_SCHEMA_VERSION,
	type ContractLlmV1,
	type CustomerInvoiceLlmV1,
	type InvoiceLlmV1,
	type PoLlmV1,
	type QuotationLlmV1,
	type ReceiptLlmV1
} from './schemas';
import {
	buildDocumentUserPrompt,
	CONTRACT_SYSTEM_PROMPT,
	CUSTOMER_INVOICE_SYSTEM_PROMPT,
	EXTRACT_DOCUMENT_FIELDS_PROMPT_VERSION,
	INVOICE_SYSTEM_PROMPT,
	PO_SYSTEM_PROMPT,
	QUOTATION_SYSTEM_PROMPT,
	RECEIPT_SYSTEM_PROMPT
} from './prompts';

const MIN_TEXT_LENGTH_FOR_REAL_EXTRACT = 32;

interface CapabilityContextWithEnv extends FinanceCapabilityContext {
	env?: Env;
}

export interface ExtractDocumentFieldsInput {
	documentId: string;
	fileName?: string;
	text?: string;
	artifactConfidence?: number;
	/** Category id from the workflow state, e.g. `expense.sales_cost.invoice`.
	 *  When absent the capability defaults to invoice extraction (Phase 2 behavior). */
	categoryId?: string;
	/** Legacy finance workflow still expects documentNumber/counterpartyName. Inbox leaves this unset. */
	outputShape?: 'category' | 'legacy';
}

export interface ExtractDocumentFieldsOutput {
	fields: Record<string, unknown>;
	confidence: number;
	evidence: FinanceEvidence[];
	provider: ExtractionProvider;
}

type CommonFields = {
	documentNumber?: string | null;
	counterpartyName?: string | null;
	currency?: string | null;
	totalAmount?: number | null;
	gstAmount?: number | null;
	issueDate?: string | null;
	dueDate?: string | null;
	recipientName?: string | null;
	clientName?: string | null;
	description?: string | null;
	trackingNumber?: string | null;
	serviceName?: string | null;
	period?: string | null;
	destination?: string | null;
	subtotal?: number | null;
	poNumber?: string | null;
	paymentTerms?: string | null;
	validUntil?: string | null;
	lineItems?: Array<Record<string, unknown>> | null;
};

// ---------------------------------------------------------------------------
// LLM dispatch (per categoryDocType)
// ---------------------------------------------------------------------------

interface LlmConfig<T> {
	systemPrompt: string;
	schema: ZodType<T>;
	schemaName: string;
	mapToFields: (value: T) => CommonFields | null;
	confidenceFromValue: (value: T) => number | undefined;
}

function hasAnyExtractedValue(fields: CommonFields): boolean {
	return Object.values(fields).some((value) => {
		if (Array.isArray(value)) return value.length > 0;
		return value !== null && value !== undefined && value !== '';
	});
}

function configForDocType(docType: CategoryDocType): LlmConfig<unknown> | null {
	if (docType === 'invoice') {
		return {
			systemPrompt: INVOICE_SYSTEM_PROMPT,
			schema: invoiceSchemaV1 as ZodType<unknown>,
			schemaName: 'finance.invoice-extraction',
			mapToFields: (raw) => {
				const v = raw as InvoiceLlmV1;
				if (
					!v.invoiceNumber ||
					!v.supplierName ||
					v.totalAmount === null ||
					!v.issueDate ||
					!v.currency
				) return null;
				return {
					documentNumber: v.invoiceNumber,
					counterpartyName: v.supplierName,
					currency: v.currency.toUpperCase(),
					totalAmount: v.totalAmount,
					gstAmount: v.gstAmount ?? 0,
					issueDate: v.issueDate,
					dueDate: v.dueDate ?? v.issueDate,
					serviceName: v.serviceName ?? null,
					period: v.period ?? null
				};
			},
			confidenceFromValue: (raw) => (raw as InvoiceLlmV1).confidence
		};
	}
	if (docType === 'receipt') {
		return {
			systemPrompt: RECEIPT_SYSTEM_PROMPT,
			schema: receiptSchemaV1 as ZodType<unknown>,
			schemaName: 'finance.receipt-extraction',
			mapToFields: (raw) => {
				const v = raw as ReceiptLlmV1;
				if (
					!v.vendor ||
					v.totalAmount === null ||
					!v.date ||
					!v.currency
				) return null;
				return {
					documentNumber: v.receiptNumber ?? `RCT-${v.date}`,
					counterpartyName: v.vendor,
					currency: v.currency.toUpperCase(),
					totalAmount: v.totalAmount,
					gstAmount: v.gstAmount ?? 0,
					issueDate: v.date,
					dueDate: v.date,
					recipientName: v.recipientName ?? null,
					destination: v.destination ?? null,
					trackingNumber: v.trackingNumber ?? null
				};
			},
			confidenceFromValue: (raw) => (raw as ReceiptLlmV1).confidence
		};
	}
	if (docType === 'po' || docType === 'purchase_order_doc') {
		return {
			systemPrompt: PO_SYSTEM_PROMPT,
			schema: poSchemaV1 as ZodType<unknown>,
			schemaName: 'finance.po-extraction',
			mapToFields: (raw) => {
				const v = raw as PoLlmV1;
				const fields: CommonFields = {
					documentNumber: v.poNumber ?? null,
					counterpartyName: v.supplierName ?? null,
					clientName: v.clientName ?? null,
					currency: v.currency?.toUpperCase() ?? null,
					totalAmount: v.totalAmount ?? null,
					gstAmount: 0,
					issueDate: v.date ?? null,
					dueDate: v.date ?? null,
					description: v.description ?? null,
					lineItems: v.lineItems ?? null
				};
				return hasAnyExtractedValue(fields) ? fields : null;
			},
			confidenceFromValue: (raw) => (raw as PoLlmV1).confidence
		};
	}
	if (docType === 'invoice_out') {
		return {
			systemPrompt: CUSTOMER_INVOICE_SYSTEM_PROMPT,
			schema: customerInvoiceSchemaV1 as ZodType<unknown>,
			schemaName: 'finance.customer-invoice-extraction',
			mapToFields: (raw) => {
				const v = raw as CustomerInvoiceLlmV1;
				if (
					!v.invoiceNumber ||
					!v.customerName ||
					v.totalAmount === null ||
					!v.invoiceDate ||
					!v.currency
				) return null;
				return {
					documentNumber: v.invoiceNumber,
					counterpartyName: v.customerName,
					currency: v.currency.toUpperCase(),
					totalAmount: v.totalAmount,
					gstAmount: v.gstAmount ?? 0,
					issueDate: v.invoiceDate,
					dueDate: v.invoiceDueDate ?? v.invoiceDate,
					subtotal: v.subtotal ?? null,
					poNumber: v.poNumber ?? null
				};
			},
			confidenceFromValue: (raw) => (raw as CustomerInvoiceLlmV1).confidence
		};
	}
	if (docType === 'contract') {
		return {
			systemPrompt: CONTRACT_SYSTEM_PROMPT,
			schema: contractSchemaV1 as ZodType<unknown>,
			schemaName: 'finance.contract-extraction',
			mapToFields: (raw) => {
				const v = raw as ContractLlmV1;
				const fields: CommonFields = {
					documentNumber: v.contractNumber ?? null,
					counterpartyName: v.clientName ?? null,
					clientName: v.clientName ?? null,
					currency: v.currency?.toUpperCase() ?? null,
					totalAmount: v.amount ?? null,
					gstAmount: 0,
					issueDate: v.effectiveDate ?? null,
					dueDate: v.expiryDate ?? null,
					description: v.scope ?? null,
					paymentTerms: v.paymentTerms ?? null
				};
				return hasAnyExtractedValue(fields) ? fields : null;
			},
			confidenceFromValue: (raw) => (raw as ContractLlmV1).confidence
		};
	}
	if (docType === 'quotation') {
		return {
			systemPrompt: QUOTATION_SYSTEM_PROMPT,
			schema: quotationSchemaV1 as ZodType<unknown>,
			schemaName: 'finance.quotation-extraction',
			mapToFields: (raw) => {
				const v = raw as QuotationLlmV1;
				const fields: CommonFields = {
					documentNumber: v.quotationNumber ?? null,
					counterpartyName: v.clientName ?? null,
					clientName: v.clientName ?? null,
					currency: v.currency?.toUpperCase() ?? null,
					totalAmount: v.amount ?? null,
					gstAmount: 0,
					issueDate: v.date ?? null,
					validUntil: v.validUntil ?? null,
					lineItems: v.lineItems ?? null
				};
				return hasAnyExtractedValue(fields) ? fields : null;
			},
			confidenceFromValue: (raw) => (raw as QuotationLlmV1).confidence
		};
	}
	return null;
}

async function tryLlmExtraction(
	text: string,
	docType: CategoryDocType,
	ctx: CapabilityContextWithEnv,
	categoryId: string,
	documentId: string
): Promise<{ fields: CommonFields; confidence: number; provider: ExtractionProvider } | null> {
	if (!ctx.env) return null;
	const cfg = configForDocType(docType);
	if (!cfg) return null;

	const result = await runStructuredOutput<unknown>({
		task: `finance.extractDocumentFields.${docType ?? 'unknown'}`,
		messages: [
			{ role: 'system', content: cfg.systemPrompt },
			{ role: 'user', content: buildDocumentUserPrompt(text) }
		],
		schema: cfg.schema,
		schemaName: cfg.schemaName,
		schemaVersion: EXTRACT_DOCUMENT_FIELDS_SCHEMA_VERSION,
		modelHint: { capability: 'structured_extraction', priority: 'quality' },
		metadata: {
			tenantId: ctx.tenantId ?? 'default',
			userId: ctx.userId,
			capabilityId: 'finance.extract-document-fields',
			promptVersion: EXTRACT_DOCUMENT_FIELDS_PROMPT_VERSION,
			schemaVersion: EXTRACT_DOCUMENT_FIELDS_SCHEMA_VERSION,
			riskLevel: 'R2',
			inputRefs: [`document:${documentId}`, `category:${categoryId}`]
		},
		env: ctx.env
	});

	if (result.status !== 'success') return null;
	const fields = cfg.mapToFields(result.result.value);
	if (!fields) return null;
	const confidence = cfg.confidenceFromValue(result.result.value) ?? 0.8;
	const provider: ExtractionProvider =
		result.result.meta.providerId === 'workers_ai' ? 'workers_ai' : 'external_api';
	return { fields, confidence, provider };
}

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

function buildEvidenceForFields(provider: ExtractionProvider, fields: Record<string, unknown>): FinanceEvidence[] {
	const labels = Object.keys(fields);
	return labels.map((field) => ({
		type: 'extracted_field',
		refId: `${provider}://${field}`,
		summary: `Extracted ${field} via ${provider}`
	}));
}

function setIfValue(output: Record<string, unknown>, key: string, value: unknown) {
	if (value === null || value === undefined || value === '') return;
	output[key] = value;
}

function categoryValue(key: string, fields: CommonFields): unknown {
	switch (key) {
		case 'invoice_number':
		case 'receipt_number':
		case 'contract_number':
		case 'quotation_number':
			return fields.documentNumber;
		case 'po_number':
			return fields.poNumber ?? fields.documentNumber;
		case 'supplier_name':
		case 'vendor':
			return fields.counterpartyName;
		case 'recipient_name':
		case 'staff_name':
			return fields.recipientName ?? fields.counterpartyName;
		case 'customer_name':
		case 'client_name':
			return fields.clientName ?? fields.counterpartyName;
		case 'date':
		case 'invoice_date':
		case 'effective_date':
			return fields.issueDate;
		case 'expiry_date':
		case 'due_date':
		case 'invoice_due_date':
			return fields.dueDate;
		case 'valid_until':
			return fields.validUntil;
		case 'amount':
		case 'invoice_amount':
			return fields.totalAmount;
		case 'currency':
		case 'invoice_currency':
			return fields.currency;
		case 'gst_amount':
		case 'invoice_gst_amount':
			return fields.gstAmount;
		case 'invoice_subtotal':
			return fields.subtotal;
		case 'description':
		case 'scope':
			return fields.description;
		case 'payment_terms':
			return fields.paymentTerms;
		case 'line_items':
			return fields.lineItems;
		case 'tracking_number':
			return fields.trackingNumber;
		case 'service_name':
			return fields.serviceName;
		case 'period':
			return fields.period;
		case 'destination':
			return fields.destination;
		default:
			return undefined;
	}
}

function projectForCategory(fields: CommonFields, category: CategoryDefinition | null): Record<string, unknown> {
	if (!category) return { ...fields };
	const output: Record<string, unknown> = {};
	for (const key of category.llmFields) setIfValue(output, key, categoryValue(key, fields));
	return output;
}

function outputFor(
	fields: CommonFields,
	category: CategoryDefinition | null,
	outputShape: ExtractDocumentFieldsInput['outputShape']
): Record<string, unknown> {
	if (outputShape === 'legacy') {
		return {
			documentNumber: fields.documentNumber,
			counterpartyName: fields.counterpartyName,
			currency: fields.currency,
			totalAmount: fields.totalAmount,
			gstAmount: fields.gstAmount,
			issueDate: fields.issueDate,
			dueDate: fields.dueDate
		};
	}
	return projectForCategory(fields, category);
}

function resolveDocType(input: ExtractDocumentFieldsInput): {
	docType: CategoryDocType;
	category: CategoryDefinition | null;
} {
	if (input.categoryId) {
		const cat = findCategoryById(input.categoryId);
		if (cat) return { docType: cat.categoryDocType, category: cat };
	}
	return { docType: 'invoice', category: null };
}

export const extractDocumentFieldsCapability: FinanceCapability<
	ExtractDocumentFieldsInput,
	ExtractDocumentFieldsOutput
> = {
	id: 'finance.extract-document-fields',
	description:
		'Extract structured fields from a finance or archive document per the workflow-selected category.',
	riskLevel: 'R2',

	async execute(input, ctx) {
		const ctxWithEnv = ctx as CapabilityContextWithEnv;
		const { docType, category } = resolveDocType(input);

		// 1. No usable text, or a direct unit/demo call without runtime env → fixture mock fallback.
		if (!input.text || input.text.length < MIN_TEXT_LENGTH_FOR_REAL_EXTRACT || !ctxWithEnv.env) {
			const fixture = pickFixture({ documentId: input.documentId, fileName: input.fileName });
			const fields = outputFor(fixture.fields, category, input.outputShape);
			return {
				fields,
				confidence: fixture.confidence,
				evidence:
					input.outputShape === 'legacy'
						? buildEvidence(fixture.fields)
						: buildEvidenceForFields('mock-v1', fields),
				provider: 'mock-v1'
			};
		}

		// 2. Real extracted text always goes through the category-specific LLM schema.
		const llm = await tryLlmExtraction(
			input.text,
			docType,
			ctxWithEnv,
			category?.id ?? input.categoryId ?? 'unknown',
			input.documentId
		);
		if (llm) {
			const fields = outputFor(llm.fields, category, input.outputShape);
			return {
				fields,
				confidence: llm.confidence,
				evidence: buildEvidenceForFields(llm.provider, fields),
				provider: llm.provider
			};
		}

		// 3. LLM failed or returned an unusable shape. Leave fields blank instead
		// of falling back to regex/mock values.
		const fields: Record<string, unknown> = {};
		return {
			fields,
			confidence: 0,
			evidence: [],
			provider: 'none'
		};
	}
};

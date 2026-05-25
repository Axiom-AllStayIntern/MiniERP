import type { DocumentClassificationResult } from '../../schemas/document-artifact.schema';
import { buildClassification } from './mock';
import { callAiJsonWithSource } from '$platform/ai/json-provider';
import { normalizeDocumentText, smartTruncate } from '$platform/ai/text-preprocessing';

export interface ClassifyDocumentInput {
	text: string;
	fileName?: string;
	mimeType?: string;
}

export type ClassifyDocumentOutput = DocumentClassificationResult;

export interface ClassifyDocumentContext {
	tenantId?: string;
	userId?: string;
	useMock?: boolean;
	env?: Env;
}

type LlmDocumentType =
	| 'supplier_invoice'
	| 'customer_invoice'
	| 'receipt'
	| 'purchase_order'
	| 'contract'
	| 'quotation'
	| 'bank_statement'
	| 'tax_document'
	| 'logistics_document'
	| 'unknown';

const DOCUMENT_TYPES: LlmDocumentType[] = [
	'supplier_invoice',
	'customer_invoice',
	'receipt',
	'purchase_order',
	'contract',
	'quotation',
	'bank_statement',
	'tax_document',
	'logistics_document',
	'unknown'
];

function clamp01(value: unknown): number {
	const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function normalizeDocumentType(value: unknown): LlmDocumentType {
	if (typeof value !== 'string') return 'unknown';
	const normalized = value.trim().toLowerCase().replace(/[-\s]/g, '_');
	const aliases: Record<string, LlmDocumentType> = {
		invoice_in: 'supplier_invoice',
		vendor_invoice: 'supplier_invoice',
		invoice_out: 'customer_invoice',
		sales_invoice: 'customer_invoice',
		expense: 'receipt',
		quote: 'quotation',
		po: 'purchase_order'
	};
	const mapped = aliases[normalized] ?? normalized;
	return DOCUMENT_TYPES.includes(mapped as LlmDocumentType) ? (mapped as LlmDocumentType) : 'unknown';
}

function filenameHint(fileName?: string): string {
	if (!fileName) return 'No filename hint.';
	return `Filename hint: ${fileName.slice(0, 160)}`;
}

function readEnv(env: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (env as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

function tenantNameHints(env: Env): string {
	return readEnv(env, 'OCR_TENANT_COMPANY_NAMES') || 'Axiom, Axiom Pte Ltd, Axiom Pte. Ltd.';
}

async function classifyWithLlm(
	input: ClassifyDocumentInput,
	env: Env
): Promise<DocumentClassificationResult | null> {
	const tenantNames = tenantNameHints(env);
	const result = await callAiJsonWithSource(env, {
		promptVersion: 'document-intake-classify-v2',
		system: `Classify one financial document for SmartFin. Our company / tenant names are: ${tenantNames}.

Return only JSON with:
- documentType: one of ${DOCUMENT_TYPES.join(', ')}
- confidence: number from 0 to 1
- reason: short explanation

Definitions:
- supplier_invoice: a vendor/supplier bills our company (${tenantNames}); we owe/pay the issuer.
- customer_invoice: our company (${tenantNames}) invoices a customer/client; the customer owes/pays us.
- receipt: payment receipt, card receipt, ride/meal/hotel/logistics receipt, or small expense proof.
- purchase_order: a purchase order document.
- contract: agreement or contract.
- quotation: quote, quotation, proposal, or pricing offer.
- bank_statement: bank account statement.
- tax_document: GST/tax/IRAS filing or tax notice.
- logistics_document: bill of lading, airway bill, delivery note, or tracking document that is not a receipt.
- unknown: too ambiguous.

For invoices, decide by economic direction and party roles, not by the words "Tax Invoice" alone.`,
		user: `${filenameHint(input.fileName)}\n\n${smartTruncate(normalizeDocumentText(input.text), 12000)}`
	});

	if (!result.json || typeof result.json !== 'object' || Array.isArray(result.json)) return null;
	const parsed = result.json as Record<string, unknown>;
	const documentType = normalizeDocumentType(parsed.documentType);
	const confidence = clamp01(parsed.confidence);
	const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 240) : undefined;
	return {
		documentType,
		confidence,
		possibleTypes: [{ documentType, confidence }],
		reason,
		modelId: result.provider === 'workers_ai' ? 'workers_ai' : result.provider,
		promptVersion: 'document-intake-classify-v2',
		schemaVersion: 'v2'
	};
}

export const classifyDocumentCapability = {
	id: 'document-intake.classify-document',
	description:
		'Classify a document into supplier_invoice / customer_invoice / receipt / purchase_order / contract / etc. using LLM classification.',
	riskLevel: 'R1' as const,

	async execute(
		input: ClassifyDocumentInput,
		ctx: ClassifyDocumentContext
	): Promise<ClassifyDocumentOutput> {
		if (!ctx.useMock && ctx.env) {
			const llm = await classifyWithLlm(input, ctx.env);
			if (llm) return llm;
			return {
				documentType: 'unknown',
				confidence: 0,
				possibleTypes: [],
				reason: 'LLM classification unavailable; heuristic fallback disabled.',
				modelId: 'none',
				promptVersion: 'document-intake-classify-v2',
				schemaVersion: 'v2'
			};
		}
		return buildClassification(input);
	}
};

import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { callAiJsonWithSource, type AiProviderUsed } from '$platform/ai/json-provider';
import { applyExtractAliases, llmExtractionHasUsableSignal } from '$platform/ai/ocr/llm-json-normalize';

type DocType =
	| 'contract'
	| 'quotation'
	| 'purchase_order'
	| 'invoice_out'
	| 'invoice_in'
	| 'expense'
	| 'other';

type LlmExtractPayload = {
	docType?: DocType;
	text?: string;
};

function readEnv(platformEnv: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (platformEnv as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

type LlmExtractionResult = {
	contractNo?: string | null;
	contractDate?: string | null;
	contractAmount?: number | null;
	contractCurrency?: string | null;
	contractPartyA?: string | null;
	contractPartyB?: string | null;
	contractStartDate?: string | null;
	contractEndDate?: string | null;
	contractPaymentTerms?: string | null;
	quotationRef?: string | null;
	quotationDate?: string | null;
	quotationAmount?: number | null;
	quotationCurrency?: string | null;
	sourceType?: string | null;
	poNumber?: string | null;
	poDate?: string | null;
	poCurrency?: string | null;
	supplierName?: string | null;
	customerName?: string | null;
	invoiceNo?: string | null;
	invoiceDate?: string | null;
	invoiceAmount?: number | null;
	invoiceCurrency?: string | null;
	invoiceDueDate?: string | null;
	invoiceGstAmount?: number | null;
	/** GST registration number - indicates valid tax invoice */
	invoiceGstRegNo?: string | null;
	invoiceSubtotal?: number | null;
	invoiceLineItems?: Array<{
		description: string;
		quantity?: number;
		unitPrice?: number;
		amount: number;
	}> | null;
	expenseCategory?: string | null;
	expenseSubcategory?: string | null;
	expenseAmount?: number | null;
	expenseCurrency?: string | null;
	expenseDate?: string | null;
	expenseStaffName?: string | null;
	expenseVendorName?: string | null;
	/** cogs | opex */
	expenseCostLayer?: string | null;
	/** For receipts: transport, meal, accommodation, gift, service, other */
	expenseCategoryHint?: string | null;
	/** Receipt or ticket number */
	expenseReceiptNumber?: string | null;
	/** Payment method hint from receipt (e.g. GrabPay, VISA **1234, cash) */
	expensePaymentMethodHint?: string | null;
	/** Per extracted field: 0â€?00 (model or heuristic). Keys match JSON field names (e.g. supplierName). */
	fieldConfidence?: Record<string, number>;
	/** Optional overall band (legacy / summary). */
	confidence?: 'low' | 'medium' | 'high';
};

function normalizeAmount(input: unknown): number | null {
	if (typeof input === 'number' && Number.isFinite(input)) return input;
	if (typeof input !== 'string') return null;
	const num = Number.parseFloat(input.replace(/,/g, ''));
	return Number.isFinite(num) ? num : null;
}

function normalizeDate(input: unknown): string | null {
	if (typeof input !== 'string') return null;
	const trimmed = input.trim();
	if (!trimmed) return null;
	const iso = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
	const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
	if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
	return null;
}

function pickCurrency(text: string): string | null {
	const match = text.match(/\b(SGD|USD|CNY|MYR|EUR)\b/i);
	return match ? match[1].toUpperCase() : null;
}

function clampConfidencePercent(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

/** Parse LLM `fieldConfidence` object; values may be number or numeric string. */
function parseFieldConfidence(raw: unknown): Record<string, number> | undefined {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const out: Record<string, number> = {};
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		let n: number | null = null;
		if (typeof v === 'number' && Number.isFinite(v)) n = v;
		else if (typeof v === 'string') {
			const t = v.trim();
			if (t && /^-?\d+(\.\d+)?$/.test(t)) n = Number.parseFloat(t);
		}
		if (n !== null) out[k] = clampConfidencePercent(n);
	}
	return Object.keys(out).length ? out : undefined;
}

function heuristicExtract(docType: DocType, text: string): LlmExtractionResult {
	const compact = text.replace(/\r/g, '\n');
	const amountMatch =
		compact.match(
			/(?:grand total|invoice total|total amount|total|amount due|contract amount)\s*[:\-]?\s*(?:sgd|usd|cny|myr|eur|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i
		) ?? compact.match(/(?:sgd|usd|cny|myr|eur|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i);

	const dateMatch =
		compact.match(/\b(20[0-9]{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12][0-9]|3[01])\b/) ??
		compact.match(/\b(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](20[0-9]{2})\b/);
	const dateRaw = dateMatch?.[0] ?? '';

	const contractNo = compact.match(
		/(?:contract|agreement)\s*(?:no|number|#)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]*)/i
	)?.[1];
	const quotationRef = compact.match(
		/(?:quotation|quote|rfq)\s*(?:no|number|#|ref)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]*)/i
	)?.[1];
	const poNumber = compact.match(
		/(?:po|purchase order)\s*(?:no|number|#)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]*)/i
	)?.[1];
	const invoiceNo = compact.match(
		/(?:invoice|bill)\s*(?:no|number|#)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]*)/i
	)?.[1];
	const customerName = compact.match(/(?:bill to|customer|client)\s*[:\-]?\s*([^\n]+)/i)?.[1]?.trim() ?? null;
	const supplierName = compact.match(/(?:supplier|vendor|from)\s*[:\-]?\s*([^\n]+)/i)?.[1]?.trim() ?? null;
	const amount = normalizeAmount(amountMatch?.[1] ?? null);
	const date = normalizeDate(dateRaw);
	const dueDate = normalizeDate(
		compact.match(/(?:due date|payment due)\s*[:\-]?\s*([0-9]{4}[\/\-][0-9]{2}[\/\-][0-9]{2}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i)?.[1] ??
			null
	);
	const gstAmount = normalizeAmount(
		compact.match(/(?:gst|tax)\s*(?:amount)?\s*[:\-]?\s*(?:sgd|usd|cny|myr|eur|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)?.[1] ??
			null
	);
	const currency = pickCurrency(compact);

	const H = { label: 76, date: 70, amount: 68, currency: 62, party: 60, po: 64, gst: 58, synthetic: 52 };

	if (docType === 'contract') {
		const fieldConfidence: Record<string, number> = {};
		if (contractNo) fieldConfidence.contractNo = H.label;
		if (date) fieldConfidence.contractDate = H.date;
		if (amount != null) fieldConfidence.contractAmount = H.amount;
		if (currency) fieldConfidence.contractCurrency = H.currency;
		return {
			contractNo: contractNo ?? null,
			contractDate: date,
			contractAmount: amount,
			contractCurrency: currency,
			fieldConfidence,
			confidence: 'medium'
		};
	}
	if (docType === 'purchase_order') {
		const fieldConfidence: Record<string, number> = {};
		if (poNumber) fieldConfidence.poNumber = H.label;
		if (date) fieldConfidence.poDate = H.date;
		if (currency) fieldConfidence.poCurrency = H.currency;
		if (supplierName) fieldConfidence.supplierName = H.party;
		if (amount != null) fieldConfidence.contractAmount = H.amount;
		return {
			poNumber: poNumber ?? null,
			poDate: date,
			poCurrency: currency,
			supplierName,
			contractAmount: amount,
			fieldConfidence,
			confidence: 'medium'
		};
	}
	if (docType === 'quotation') {
		const qRef = quotationRef ?? contractNo ?? poNumber ?? null;
		const fieldConfidence: Record<string, number> = {};
		if (qRef) fieldConfidence.quotationRef = H.label;
		if (date) fieldConfidence.quotationDate = H.date;
		if (amount != null) fieldConfidence.quotationAmount = H.amount;
		if (currency) fieldConfidence.quotationCurrency = H.currency;
		fieldConfidence.sourceType = H.synthetic;
		if (customerName) fieldConfidence.customerName = H.party;
		return {
			quotationRef: qRef,
			quotationDate: date,
			quotationAmount: amount,
			quotationCurrency: currency,
			sourceType: 'file_upload',
			customerName,
			fieldConfidence,
			confidence: 'medium'
		};
	}
	if (docType === 'expense') {
		const tLo = compact.toLowerCase();
		const merchant =
			compact.match(/(?:merchant|paid\s+to|from)\s*[:\-]?\s*([^\n]+)/i)?.[1]?.trim() ??
			supplierName ??
			null;
		const fieldConfidence: Record<string, number> = {};
		if (merchant) fieldConfidence.expenseCategory = H.party;
		if (date) fieldConfidence.expenseDate = H.date;
		if (amount != null) fieldConfidence.expenseAmount = H.amount;
		if (currency) fieldConfidence.expenseCurrency = H.currency;
		return {
			expenseCategory: merchant,
			expenseSubcategory: null,
			expenseAmount: amount,
			expenseCurrency: currency,
			expenseDate: date,
			expenseStaffName: null,
			expenseCostLayer: /\b(meal|restaurant|grab|bd|sales|coffee|subscription|software|saas)\b/i.test(tLo)
				? 'opex'
				: 'cogs',
			fieldConfidence,
			confidence: 'medium'
		};
	}
	if (docType === 'invoice_in' || docType === 'invoice_out') {
		const fieldConfidence: Record<string, number> = {};
		if (invoiceNo) fieldConfidence.invoiceNo = H.label;
		if (date) fieldConfidence.invoiceDate = H.date;
		if (amount != null) fieldConfidence.invoiceAmount = H.amount;
		if (currency) fieldConfidence.invoiceCurrency = H.currency;
		if (dueDate) fieldConfidence.invoiceDueDate = H.date;
		if (gstAmount != null) fieldConfidence.invoiceGstAmount = H.gst;
		if (poNumber) fieldConfidence.poNumber = H.po;
		if (supplierName) fieldConfidence.supplierName = H.party;
		if (customerName) fieldConfidence.customerName = H.party;
		return {
			invoiceNo: invoiceNo ?? null,
			invoiceDate: date,
			invoiceAmount: amount,
			invoiceCurrency: currency,
			invoiceDueDate: dueDate,
			invoiceGstAmount: gstAmount,
			poNumber: poNumber ?? null,
			supplierName,
			customerName,
			fieldConfidence,
			confidence: 'medium'
		};
	}
	return { confidence: 'low' };
}

function tenantNameHints(env: Env): string {
	const raw = readEnv(env, 'OCR_TENANT_COMPANY_NAMES').trim();
	if (raw) return raw;
	return 'Axiom, Axiom Pte Ltd, Axiom Pte. Ltd.';
}

function buildSystemPrompt(docType: DocType, tenantNames: string): string {
	const invoiceRole =
		docType === 'invoice_in'
			? `Role: SUPPLIER invoice (we are the buyer). supplierName = party who ISSUED the invoice (vendor we pay). customerName = our company (${tenantNames}) when shown as Bill-To / Invoice-To. GST is typically charged TO us on their supply.`
			: docType === 'invoice_out'
				? `Role: OUR sales invoice (we are the seller). customerName = external party billed (they pay us). supplierName should be null unless the document clearly labels another supplier; do not put the vendor as customerName. GST is typically output tax on our sale.`
				: '';

	return `You are a financial document extractor for ERP input.
Return ONLY valid JSON.
Document type: ${docType}
${invoiceRole ? `\n${invoiceRole}\n` : ''}
For contract return keys:
contractNo, contractDate, contractAmount, contractCurrency, contractPartyA, contractPartyB, contractStartDate, contractEndDate, contractPaymentTerms, fieldConfidence, confidence (optional)
- For Chinese-labeled contracts: first party / Party A â†?contractPartyA; second party / Party B â†?contractPartyB; stated contract total â†?contractAmount

For purchase_order return keys:
poNumber, poDate, poCurrency, supplierName, contractAmount, fieldConfidence, confidence (optional)

For quotation return keys:
quotationRef, quotationDate, quotationAmount, quotationCurrency, sourceType, customerName, fieldConfidence, confidence (optional)

For invoice_in / invoice_out return keys:
invoiceNo, invoiceDate, invoiceAmount, invoiceCurrency, invoiceDueDate, invoiceGstAmount, invoiceGstRegNo, invoiceSubtotal, poNumber, supplierName, customerName, fieldConfidence, confidence (optional)
- invoiceGstRegNo: GST registration number if present (indicates valid tax invoice for input tax claim)
- For Chinese-labeled invoices: VAT or tax amount line â†?invoiceGstAmount; taxpayer / GST registration number â†?invoiceGstRegNo
- Extract line_items if available as invoiceLineItems: [{description, quantity, unitPrice, amount}]

For expense return keys:
expenseCategory, expenseSubcategory, expenseAmount, expenseCurrency, expenseDate, expenseStaffName, expenseVendorName, expenseCostLayer, expenseCategoryHint, expenseReceiptNumber, expensePaymentMethodHint, fieldConfidence, confidence (optional)
- expenseCostLayer: "cogs" for direct project costs (materials, logistics, workshop), "opex" for operating expenses (transport, meal, accommodation, subscription, etc.)
- expenseCategoryHint: one of "transport", "meal", "accommodation", "gift", "service", "other" - for receipt type classification
- For Grab receipts: expenseVendorName = "Grab", infer category from GrabCar/GrabFood
- For airline/train tickets: expenseCategoryHint = "transport"
- For meal receipts: expenseCategoryHint = "meal"
- For hotel receipts: expenseCategoryHint = "accommodation"

Rules:
- date format must be YYYY-MM-DD or null
- amount must be number or null
- currency: look for $ signs, currency codes (SGD, USD, CNY), or infer from language (Chinese doc â†?likely CNY)
- fieldConfidence: REQUIRED object. For every field you output with a non-null value, include a key with the SAME name as that field mapping to an integer 0-100 = your confidence that value is correct (based on label clarity, OCR ambiguity, cross-checks in the text). Omit keys for null fields. Example: {"contractNo": 88, "contractDate": 91, "contractAmount": 72}
- confidence (optional): one of low, medium, high for the whole extraction summary
- unknown values must be null`;
}

function mapParsedToExtractionResult(parsed: Record<string, unknown>): LlmExtractionResult {
	const fieldConfidence = parseFieldConfidence(parsed.fieldConfidence);

	const expenseLayerRaw = typeof parsed.expenseCostLayer === 'string' ? parsed.expenseCostLayer.toLowerCase() : '';
	const expenseCostLayer = expenseLayerRaw === 'opex' ? 'opex' : expenseLayerRaw === 'cogs' ? 'cogs' : null;

	// Parse line items if present
	let invoiceLineItems = null;
	if (Array.isArray(parsed.invoiceLineItems)) {
		invoiceLineItems = parsed.invoiceLineItems
			.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
			.map((item) => ({
				description: typeof item.description === 'string' ? item.description : '',
				quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
				unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : undefined,
				amount: typeof item.amount === 'number' ? item.amount : 0
			}));
	}

	return {
		// Contract fields
		contractNo: typeof parsed.contractNo === 'string' ? parsed.contractNo : null,
		contractDate: normalizeDate(parsed.contractDate),
		contractAmount: normalizeAmount(parsed.contractAmount),
		contractCurrency: typeof parsed.contractCurrency === 'string' ? parsed.contractCurrency : null,
		contractPartyA: typeof parsed.contractPartyA === 'string' ? parsed.contractPartyA : null,
		contractPartyB: typeof parsed.contractPartyB === 'string' ? parsed.contractPartyB : null,
		contractStartDate: normalizeDate(parsed.contractStartDate),
		contractEndDate: normalizeDate(parsed.contractEndDate),
		contractPaymentTerms: typeof parsed.contractPaymentTerms === 'string' ? parsed.contractPaymentTerms : null,
		// Quotation fields
		quotationRef: typeof parsed.quotationRef === 'string' ? parsed.quotationRef : null,
		quotationDate: normalizeDate(parsed.quotationDate),
		quotationAmount: normalizeAmount(parsed.quotationAmount),
		quotationCurrency: typeof parsed.quotationCurrency === 'string' ? parsed.quotationCurrency : null,
		sourceType: typeof parsed.sourceType === 'string' ? parsed.sourceType : null,
		// PO fields
		poNumber: typeof parsed.poNumber === 'string' ? parsed.poNumber : null,
		poDate: normalizeDate(parsed.poDate),
		poCurrency: typeof parsed.poCurrency === 'string' ? parsed.poCurrency : null,
		// Common party fields
		supplierName: typeof parsed.supplierName === 'string' ? parsed.supplierName : null,
		customerName: typeof parsed.customerName === 'string' ? parsed.customerName : null,
		// Invoice fields
		invoiceNo: typeof parsed.invoiceNo === 'string' ? parsed.invoiceNo : null,
		invoiceDate: normalizeDate(parsed.invoiceDate),
		invoiceAmount: normalizeAmount(parsed.invoiceAmount),
		invoiceCurrency: typeof parsed.invoiceCurrency === 'string' ? parsed.invoiceCurrency : null,
		invoiceDueDate: normalizeDate(parsed.invoiceDueDate),
		invoiceGstAmount: normalizeAmount(parsed.invoiceGstAmount),
		invoiceGstRegNo: typeof parsed.invoiceGstRegNo === 'string' ? parsed.invoiceGstRegNo : null,
		invoiceSubtotal: normalizeAmount(parsed.invoiceSubtotal),
		invoiceLineItems,
		// Expense fields
		expenseCategory: typeof parsed.expenseCategory === 'string' ? parsed.expenseCategory : null,
		expenseSubcategory: typeof parsed.expenseSubcategory === 'string' ? parsed.expenseSubcategory : null,
		expenseAmount: normalizeAmount(parsed.expenseAmount),
		expenseCurrency: typeof parsed.expenseCurrency === 'string' ? parsed.expenseCurrency : null,
		expenseDate: normalizeDate(parsed.expenseDate),
		expenseStaffName: typeof parsed.expenseStaffName === 'string' ? parsed.expenseStaffName : null,
		expenseVendorName: typeof parsed.expenseVendorName === 'string' ? parsed.expenseVendorName : null,
		expenseCostLayer,
		expenseCategoryHint: typeof parsed.expenseCategoryHint === 'string' ? parsed.expenseCategoryHint : null,
		expenseReceiptNumber: typeof parsed.expenseReceiptNumber === 'string' ? parsed.expenseReceiptNumber : null,
		expensePaymentMethodHint: typeof parsed.expensePaymentMethodHint === 'string' ? parsed.expensePaymentMethodHint : null,
		// Confidence
		fieldConfidence,
		confidence:
			parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
				? parsed.confidence
				: 'medium'
	};
}

async function runLlmExtract(
	docType: DocType,
	text: string,
	env: Env
): Promise<{ result: LlmExtractionResult | null; provider: AiProviderUsed }> {
	const promptVersion = readEnv(env, 'OCR_PROMPT_VERSION') || 'v1';
	const tenantNames = tenantNameHints(env);
	const { json: parsedUnknown, provider } = await callAiJsonWithSource(env, {
		system: buildSystemPrompt(docType, tenantNames),
		user: text,
		promptVersion
	});
	if (!parsedUnknown || typeof parsedUnknown !== 'object' || Array.isArray(parsedUnknown)) {
		return { result: null, provider: 'none' };
	}
	const parsed = applyExtractAliases(parsedUnknown as Record<string, unknown>, docType);
	const mapped = mapParsedToExtractionResult(parsed);

	const signal = llmExtractionHasUsableSignal(docType, mapped as unknown as Record<string, unknown>);
	if (!signal) {
		return { result: null, provider };
	}
	return { result: mapped, provider };
}

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const payload = (await request.json()) as LlmExtractPayload;
	const docType = payload.docType ?? 'other';
	const text = payload.text?.trim() ?? '';
	if (!text) return fail('Text is required', 400);

	const llm = await runLlmExtract(docType, text, platform.env);
	if (llm.result) {
		const apiProvider = llm.provider === 'workers_ai' ? 'workers_ai' : 'external_api';
		return ok({ provider: apiProvider, result: llm.result });
	}

	const fallback = heuristicExtract(docType, text);
	return ok({ provider: 'heuristic', result: fallback });
};


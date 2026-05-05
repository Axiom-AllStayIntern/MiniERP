/**
 * Top-level document classifier â€?LLM-first, heuristic fallback.
 *
 * Extracted from /api/ocr/llm-classify so it can be called both over HTTP
 * (existing clients) and directly from server code (e.g. /api/intake/classify
 * which chains this with field extraction + project match). HTTP contract of
 * the existing endpoint is preserved via a thin wrapper.
 *
 * Behaviour notes:
 * - 7 docTypes: contract | quotation | purchase_order | invoice_out | invoice_in | expense | other
 * - Tenant-aware invoice_in vs invoice_out: relies on OCR_TENANT_COMPANY_NAMES env
 *   (defaults to "Axiom") to decide who is issuer vs bill-to.
 * - Heuristic fallback runs when the LLM is unavailable or returns garbage.
 */

import { applyClassifyAliases } from './llm-json-normalize';
import { callAiJsonWithSource, type AiProviderUsed } from '$platform/ai/json-provider';

export type DocType =
	| 'contract'
	| 'quotation'
	| 'purchase_order'
	| 'invoice_out'
	| 'invoice_in'
	| 'expense'
	| 'other';

export const DOC_TYPES: DocType[] = [
	'contract',
	'quotation',
	'purchase_order',
	'invoice_out',
	'invoice_in',
	'expense',
	'other'
];

export type ClassifyResult = {
	docType: DocType;
	/** 0â€?00 */
	confidence: number;
	reason?: string;
};

export type ClassifyOutcome = {
	provider: AiProviderUsed | 'heuristic';
	result: ClassifyResult;
};

function readEnv(env: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (env as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

function clampPct(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

export function normalizeDocTypeHint(raw: unknown): DocType | undefined {
	if (typeof raw !== 'string') return undefined;
	const v = raw.trim().toLowerCase().replace(/-/g, '_');
	if (DOC_TYPES.includes(v as DocType)) return v as DocType;
	return undefined;
}

function normalizeDocTypeFromModel(raw: unknown, fallback: DocType): DocType {
	if (typeof raw !== 'string') return fallback;
	const v = raw.trim().toLowerCase().replace(/-/g, '_');
	const aliases: Record<string, DocType> = {
		contract: 'contract',
		quotation: 'quotation',
		quote: 'quotation',
		purchase_order: 'purchase_order',
		purchaseorder: 'purchase_order',
		invoice_out: 'invoice_out',
		customer_invoice: 'invoice_out',
		sales_invoice: 'invoice_out',
		invoice_in: 'invoice_in',
		supplier_invoice: 'invoice_in',
		vendor_invoice: 'invoice_in',
		expense: 'expense',
		receipt: 'expense',
		card_receipt: 'expense',
		payment_receipt: 'expense',
		other: 'other'
	};
	return aliases[v] ?? (DOC_TYPES.includes(v as DocType) ? (v as DocType) : fallback);
}

function tenantNameHints(env: Env): string {
	const raw = readEnv(env, 'OCR_TENANT_COMPANY_NAMES').trim();
	if (raw) return raw;
	return 'Axiom, Axiom Pte Ltd, Axiom Pte. Ltd.';
}

function tenantRegex(env: Env): RegExp {
	const custom = readEnv(env, 'OCR_TENANT_NAME_REGEX').trim();
	if (custom) {
		try {
			return new RegExp(custom, 'i');
		} catch {
			// fall through
		}
	}
	return /\baxiom(\s+pte\.?\s*ltd\.?)?\b/i;
}

function buildClassifySystemPrompt(hint: DocType | undefined, tenantNames: string): string {
	const hintLine =
		hint && hint !== 'other'
			? `Optional filename/UI hint (may be wrong): "${hint}". Prefer document body over hint when they conflict.`
			: 'No filename hint.';
	return `You classify financial documents for an AR system used by our company (${tenantNames} â€?the "tenant" / ERP owner).

Return ONLY valid JSON with keys: docType (string), confidence (integer 0-100), reason (short string, optional).

docType must be exactly one of:
- contract â€?service/goods agreement, master agreement, contract number
- quotation â€?quote, proposal, RFQ, pricing offer
- purchase_order â€?PO issued to a vendor to buy goods/services
- invoice_out â€?OUR sales invoice: WE (the tenant) are the seller/issuer; a CUSTOMER owes us money; output tax / we collect payment; "Bill To" is typically the external customer (not us).
- invoice_in â€?SUPPLIER/vendor invoice: another party bills US (the tenant); WE are the buyer; input tax / GST charged TO us on their charges; we must PAY them; "Bill To" / "Invoice To" often lists ${tenantNames.split(',')[0]?.trim() ?? 'our company'}.
- expense â€?company card / petty cash receipt, ride-hail trip, subscription receipt, retail slip; not a formal supplier tax invoice and not employee reimbursement (those are payroll), small unstructured spend
- other â€?packing list, delivery note, unclear scan, non-financial

${hintLine}

Critical rule for invoices (invoice_in vs invoice_out):
- If the economic flow is "vendor charges the tenant" (tenant pays supplier, GST is the tenant's purchase / expense side) â†?invoice_in.
- If the economic flow is "tenant charges a client" (tenant receives revenue, GST on sales) â†?invoice_out.
- Do NOT use only the words "Tax Invoice"; decide from who issues the invoice vs who is the payer/receiver of the supply.
- If the tenant appears as Bill-To / Customer of the issuing vendor, lean invoice_in. If the tenant appears as From / Issuer / Seller and someone else is billed, lean invoice_out.

Other rules:
- Use headers, titles ("Tax Invoice", "Purchase Order"), party blocks, GST registration labels, and remit-to vs bill-to.
- If text is too short or ambiguous, use other with low confidence.
- confidence = how sure you are of docType (not OCR quality).`;
}

function heuristicClassify(text: string, hint: DocType | undefined, env: Env): ClassifyResult {
	const slice = text.slice(0, 12000);
	const t = slice.toLowerCase();
	const tenantRx = tenantRegex(env);
	const mentionsTenant = tenantRx.test(slice);
	const scores: Record<DocType, number> = {
		contract: 0,
		quotation: 0,
		purchase_order: 0,
		invoice_out: 0,
		invoice_in: 0,
		expense: 0,
		other: 0
	};

	if (/\b(master\s+)?service\s+agreement\b|\bcontract\s+agreement\b|\bthis\s+agreement\b/i.test(t)) scores.contract += 5;
	if (/\bcontract\b/.test(t) && /\b(agreement|whereas|effective\s+date|parties)\b/.test(t)) scores.contract += 3;
	if (/\bquotation\b|\brfq\b|\brequest\s+for\s+quot/i.test(t)) scores.quotation += 4;
	if (/\bquote\b/.test(t) && /\b(valid|price|total|amount)\b/.test(t)) scores.quotation += 2;
	if (/\bpurchase\s+order\b|\bp\.?\s*o\.?\s*(no|number|#)/i.test(slice)) scores.purchase_order += 5;

	const expenseCues =
		/\b(receipt|payment\s+received|thank\s+you\s+for\s+your\s+(purchase|payment)|grab|gojek|taxi|uber|ntuc|fairprice|subscription|chatgpt|openai|cursor)\b/i.test(
			slice
		) || /\b(total\s+paid|amount\s+paid)\b/i.test(t);
	if (expenseCues && !/\btax\s+invoice\b/i.test(t)) scores.expense += 4;

	const hasInvoice = /\binvoice\b|\btax\s+invoice\b|\bcommercial\s+invoice\b/i.test(slice);
	const supplierCues =
		/\b(supplier|vendor|remit\s+to|payable\s+to)\b/i.test(t) ||
		/\b(supplier|vendor)\s*(name|address|gst)/i.test(slice);
	const customerCues =
		/\b(bill\s+to|sold\s+to|customer|client|debit\s+note\s+to)\b/i.test(t) ||
		/\b(amount\s+due|please\s+remit)\b/i.test(t);

	const billToIdx = t.search(/\bbill\s+to\b|\binvoice\s+to\b|\bship\s+to\b/);
	const billToWindow = billToIdx >= 0 ? slice.slice(billToIdx, billToIdx + 600) : '';
	const tenantInBillTo = billToWindow.length > 0 && tenantRx.test(billToWindow);
	const tenantNearIssuer =
		/(?:^|\n)\s*(?:from|issuer|sold\s+by|supplier|vendor)\s*[:\s][^\n]{0,120}/i.exec(slice);
	const tenantAsIssuer = tenantNearIssuer !== null && tenantRx.test(tenantNearIssuer[0] ?? '');

	if (hasInvoice) {
		if (mentionsTenant) {
			if (tenantInBillTo && !tenantAsIssuer) scores.invoice_in += 7;
			if (tenantAsIssuer) scores.invoice_out += 7;
		}
		if (supplierCues && !customerCues) scores.invoice_in += 5;
		else if (customerCues && !supplierCues) scores.invoice_out += 5;
		else if (supplierCues && customerCues) {
			if (tenantInBillTo && !tenantAsIssuer) scores.invoice_in += 4;
			else if (tenantAsIssuer) scores.invoice_out += 4;
			else {
				scores.invoice_in += 2;
				scores.invoice_out += 2;
			}
		} else {
			if (tenantInBillTo && !tenantAsIssuer) scores.invoice_in += 3;
			else if (tenantAsIssuer) scores.invoice_out += 3;
			else {
				scores.invoice_out += 2;
				scores.invoice_in += 1;
			}
		}
	}

	if (hint && hint !== 'other') scores[hint] += 2;

	let best: DocType = 'other';
	let max = 0;
	for (const dt of DOC_TYPES) {
		if (dt === 'other') continue;
		if (scores[dt] > max) {
			max = scores[dt];
			best = dt;
		}
	}

	if (max === 0) {
		if (hint && hint !== 'other') {
			return {
				docType: hint,
				confidence: 44,
				reason: 'Weak text signals; applied filename/UI hint.'
			};
		}
		return { docType: 'other', confidence: 38, reason: 'Insufficient cues in text.' };
	}

	const confidence = clampPct(46 + Math.min(max, 7) * 7);
	return {
		docType: best,
		confidence,
		reason: 'Keyword/heuristic scoring on extracted text.'
	};
}

async function callExternalClassify(
	text: string,
	hint: DocType | undefined,
	env: Env
): Promise<{ result: ClassifyResult | null; provider: AiProviderUsed }> {
	const promptVersion = readEnv(env, 'OCR_PROMPT_VERSION') || 'v1';
	const tenantNames = tenantNameHints(env);
	const system = `${buildClassifySystemPrompt(hint, tenantNames)}\nPrompt version: ${promptVersion}`;
	const { json: parsedUnknown, provider } = await callAiJsonWithSource(env, {
		system,
		user: text.slice(0, 12000),
		promptVersion
	});
	if (!parsedUnknown || typeof parsedUnknown !== 'object' || Array.isArray(parsedUnknown)) {
		return { result: null, provider };
	}
	const parsed = applyClassifyAliases(parsedUnknown as Record<string, unknown>);

	const docType = normalizeDocTypeFromModel(parsed.docType, 'other');
	let confidence = 55;
	if (typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)) {
		confidence = clampPct(parsed.confidence);
	} else if (typeof parsed.confidence === 'string') {
		const n = Number.parseFloat(parsed.confidence.trim());
		if (Number.isFinite(n)) confidence = clampPct(n);
	}

	const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined;
	return { result: { docType, confidence, reason }, provider };
}

/**
 * Classify a document from its OCR'd raw text. Returns the classifier result
 * plus which provider produced it (external LLM / workers_ai / heuristic
 * fallback). Safe to call without AI configured â€?it will fall back.
 */
export async function classifyDocType(
	rawText: string,
	hint: DocType | undefined,
	env: Env
): Promise<ClassifyOutcome> {
	const llm = await callExternalClassify(rawText, hint, env);
	if (llm.result) {
		const provider = llm.provider === 'workers_ai' ? 'workers_ai' : 'external_api';
		return { provider, result: llm.result };
	}
	const fallback = heuristicClassify(rawText, hint, env);
	return { provider: 'heuristic', result: fallback };
}

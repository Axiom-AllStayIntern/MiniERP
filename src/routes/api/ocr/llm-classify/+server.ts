import type { RequestHandler } from './$types';

import { fail, ok } from '$lib/server/http';

type DocType = 'contract' | 'quotation' | 'purchase_order' | 'invoice_out' | 'invoice_in' | 'other';

const DOC_TYPES: DocType[] = [
	'contract',
	'quotation',
	'purchase_order',
	'invoice_out',
	'invoice_in',
	'other'
];

type ClassifyPayload = {
	text?: string;
	/** Filename or UI guess; model may override */
	hintDocType?: DocType | string;
};

type ClassifyResult = {
	docType: DocType;
	/** 0–100 */
	confidence: number;
	reason?: string;
};

function readEnv(platformEnv: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (platformEnv as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

function clampPct(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

function normalizeHint(raw: unknown): DocType | undefined {
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
		other: 'other'
	};
	return aliases[v] ?? (DOC_TYPES.includes(v as DocType) ? (v as DocType) : fallback);
}

function buildClassifySystemPrompt(hint: DocType | undefined): string {
	const hintLine = hint && hint !== 'other' ? `Optional filename/UI hint (may be wrong): "${hint}". Prefer document body over hint when they conflict.` : 'No filename hint.';
	return `You classify financial documents for an AR system.
Return ONLY valid JSON with keys: docType (string), confidence (integer 0-100), reason (short string, optional).

docType must be exactly one of:
- contract — service/goods agreement, master agreement, contract number
- quotation — quote, proposal, RFQ, pricing offer
- purchase_order — PO issued to a vendor to buy goods/services
- invoice_out — sales invoice you issue to a customer (they owe you); bill-to / customer-facing
- invoice_in — supplier/vendor invoice (you pay them); remit-to, vendor tax invoice
- other — packing list, delivery note, unclear scan, non-financial

${hintLine}

Rules:
- Use headers, titles ("Tax Invoice", "Purchase Order"), and who is billed vs who bills.
- If text is too short or ambiguous, use other with low confidence.
- confidence = how sure you are of docType (not OCR quality).`;
}

function heuristicClassify(text: string, hint: DocType | undefined): ClassifyResult {
	const slice = text.slice(0, 12000);
	const t = slice.toLowerCase();
	const scores: Record<DocType, number> = {
		contract: 0,
		quotation: 0,
		purchase_order: 0,
		invoice_out: 0,
		invoice_in: 0,
		other: 0
	};

	if (/\b(master\s+)?service\s+agreement\b|\bcontract\s+agreement\b|\bthis\s+agreement\b/i.test(t)) scores.contract += 5;
	if (/\bcontract\b/.test(t) && /\b(agreement|whereas|effective\s+date|parties)\b/.test(t)) scores.contract += 3;
	if (/\bquotation\b|\brfq\b|\brequest\s+for\s+quot/i.test(t)) scores.quotation += 4;
	if (/\bquote\b/.test(t) && /\b(valid|price|total|amount)\b/.test(t)) scores.quotation += 2;
	if (/\bpurchase\s+order\b|\bp\.?\s*o\.?\s*(no|number|#)/i.test(slice)) scores.purchase_order += 5;

	const hasInvoice = /\binvoice\b|\btax\s+invoice\b|\bcommercial\s+invoice\b/i.test(slice);
	const supplierCues =
		/\b(supplier|vendor|remit\s+to|payable\s+to)\b/i.test(t) ||
		/\b(supplier|vendor)\s*(name|address|gst)/i.test(slice);
	const customerCues =
		/\b(bill\s+to|sold\s+to|customer|client|debit\s+note\s+to)\b/i.test(t) ||
		/\b(amount\s+due|please\s+remit)\b/i.test(t);
	if (hasInvoice) {
		if (supplierCues && !customerCues) scores.invoice_in += 5;
		else if (customerCues && !supplierCues) scores.invoice_out += 5;
		else if (supplierCues && customerCues) {
			scores.invoice_in += 2;
			scores.invoice_out += 2;
		} else {
			scores.invoice_out += 2;
			scores.invoice_in += 1;
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
): Promise<ClassifyResult | null> {
	const provider = readEnv(env, 'LLM_PROVIDER').toLowerCase();
	const apiUrl = readEnv(env, 'LLM_API_URL');
	const apiKey = readEnv(env, 'LLM_API_KEY');
	const promptVersion = readEnv(env, 'OCR_PROMPT_VERSION') || 'v1';
	if (provider !== 'external' || !apiUrl) return null;

	const openAiModel = readEnv(env, 'OPENAI_MODEL') || 'gpt-4o-mini';
	const isOpenAiChatEndpoint = /api\.openai\.com\/v1\/chat\/completions/i.test(apiUrl);
	const system = `${buildClassifySystemPrompt(hint)}\nPrompt version: ${promptVersion}`;

	const response = await fetch(
		apiUrl,
		isOpenAiChatEndpoint
			? {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
					},
					body: JSON.stringify({
						model: openAiModel,
						temperature: 0,
						response_format: { type: 'json_object' },
						messages: [
							{ role: 'system', content: system },
							{ role: 'user', content: text.slice(0, 12000) }
						]
					})
				}
			: {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
					},
					body: JSON.stringify({
						promptVersion,
						system,
						input: text.slice(0, 12000)
					})
				}
	);

	if (!response.ok) return null;
	const raw = await response.text();
	let parsed: Record<string, unknown> | null = null;
	try {
		const json = JSON.parse(raw) as Record<string, unknown>;
		if (isOpenAiChatEndpoint) {
			const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
			const content = choices?.[0]?.message?.content;
			if (!content) return null;
			parsed = JSON.parse(content) as Record<string, unknown>;
		} else {
			parsed = json;
		}
	} catch {
		return null;
	}
	if (!parsed) return null;

	const docType = normalizeDocTypeFromModel(parsed.docType, 'other');
	let confidence = 55;
	if (typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)) {
		confidence = clampPct(parsed.confidence);
	} else if (typeof parsed.confidence === 'string') {
		const n = Number.parseFloat(parsed.confidence.trim());
		if (Number.isFinite(n)) confidence = clampPct(n);
	}

	const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined;
	return { docType, confidence, reason };
}

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const payload = (await request.json()) as ClassifyPayload;
	const text = payload.text?.trim() ?? '';
	if (!text) return fail('Text is required', 400);

	const hint = normalizeHint(payload.hintDocType);

	const external = await callExternalClassify(text, hint, platform.env);
	if (external) {
		return ok({ provider: 'external_api', result: external });
	}

	const fallback = heuristicClassify(text, hint);
	return ok({ provider: 'heuristic', result: fallback });
};

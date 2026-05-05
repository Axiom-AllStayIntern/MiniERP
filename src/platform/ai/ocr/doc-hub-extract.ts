import { callAiJsonWithSource } from '$platform/ai/json-provider';

export type DocHubDocType = 'contract' | 'quotation' | 'purchase_order';

export type ContractExtracted = {
	contract_number: string | null;
	client_name: string | null;
	effective_date: string | null;
	expiry_date: string | null;
	amount: number | null;
	currency: string | null;
	payment_terms: string | null;
	scope: string | null;
};

export type QuotationExtracted = {
	quotation_number: string | null;
	client_name: string | null;
	date: string | null;
	valid_until: string | null;
	amount: number | null;
	currency: string | null;
	line_items: Array<Record<string, unknown>> | null;
};

export type PurchaseOrderExtracted = {
	po_number: string | null;
	supplier_name: string | null;
	client_name: string | null;
	date: string | null;
	amount: number | null;
	currency: string | null;
	description: string | null;
	line_items: Array<Record<string, unknown>> | null;
};

export type DocHubExtracted =
	| ({ docType: 'contract' } & ContractExtracted)
	| ({ docType: 'quotation' } & QuotationExtracted)
	| ({ docType: 'purchase_order' } & PurchaseOrderExtracted);

function toStr(v: unknown): string | null {
	return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function toNum(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim()) {
		const n = Number(v.replace(/,/g, ''));
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function toLineItems(v: unknown): Array<Record<string, unknown>> | null {
	if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
	return null;
}

function buildSystemPrompt(docType: DocHubDocType): string {
	if (docType === 'contract') {
		return `You extract structured fields from a business contract document.
Return ONLY a JSON object with these exact keys:
{
  "contract_number": string|null,
  "client_name": string|null,
  "effective_date": "YYYY-MM-DD"|null,
  "expiry_date": "YYYY-MM-DD"|null,
  "amount": number|null,
  "currency": "SGD"|"USD"|"CNY"|"MYR"|"EUR"|null,
  "payment_terms": string|null,
  "scope": string|null
}
Rules:
- effective_date is the contract start date; expiry_date is the contract end date or expiry.
- Use null for unknown fields. Keep dates as YYYY-MM-DD.
- currency must be one of the ISO codes listed; map S$→SGD, ¥/RMB→CNY, US$→USD, RM→MYR, €→EUR.
- scope: summarise the contract scope/subject in 1-2 sentences if possible.`;
	}

	if (docType === 'quotation') {
		return `You extract structured fields from a business quotation or quote document.
Return ONLY a JSON object with these exact keys:
{
  "quotation_number": string|null,
  "client_name": string|null,
  "date": "YYYY-MM-DD"|null,
  "valid_until": "YYYY-MM-DD"|null,
  "amount": number|null,
  "currency": "SGD"|"USD"|"CNY"|"MYR"|"EUR"|null,
  "line_items": [{"description": string, "qty": number|null, "unit_price": number|null, "amount": number|null}]|null
}
Rules:
- date is when the quotation was issued; valid_until is the quotation expiry date.
- line_items: extract each line item as an object; use null for the whole array if none visible.
- Use null for unknown fields. Keep dates as YYYY-MM-DD.
- currency must be one of the ISO codes listed.`;
	}

	// purchase_order
	return `You extract structured fields from a Purchase Order (PO) document.
Return ONLY a JSON object with these exact keys:
{
  "po_number": string|null,
  "supplier_name": string|null,
  "client_name": string|null,
  "date": "YYYY-MM-DD"|null,
  "amount": number|null,
  "currency": "SGD"|"USD"|"CNY"|"MYR"|"EUR"|null,
  "description": string|null,
  "line_items": [{"description": string, "qty": number|null, "unit_price": number|null, "amount": number|null}]|null
}
Rules:
- po_number is the PO reference number; supplier_name is the vendor; client_name is the buyer.
- description: brief description of the goods/services ordered.
- line_items: extract each line item; use null for the whole array if none visible.
- Use null for unknown fields. Keep dates as YYYY-MM-DD.
- currency must be one of the ISO codes listed.`;
}

function normalizeContract(obj: Record<string, unknown>): ContractExtracted {
	return {
		contract_number: toStr(obj.contract_number),
		client_name: toStr(obj.client_name),
		effective_date: toStr(obj.effective_date),
		expiry_date: toStr(obj.expiry_date),
		amount: toNum(obj.amount),
		currency: toStr(obj.currency),
		payment_terms: toStr(obj.payment_terms),
		scope: toStr(obj.scope)
	};
}

function normalizeQuotation(obj: Record<string, unknown>): QuotationExtracted {
	return {
		quotation_number: toStr(obj.quotation_number),
		client_name: toStr(obj.client_name),
		date: toStr(obj.date),
		valid_until: toStr(obj.valid_until),
		amount: toNum(obj.amount),
		currency: toStr(obj.currency),
		line_items: toLineItems(obj.line_items)
	};
}

function normalizePurchaseOrder(obj: Record<string, unknown>): PurchaseOrderExtracted {
	return {
		po_number: toStr(obj.po_number),
		supplier_name: toStr(obj.supplier_name),
		client_name: toStr(obj.client_name),
		date: toStr(obj.date),
		amount: toNum(obj.amount),
		currency: toStr(obj.currency),
		description: toStr(obj.description),
		line_items: toLineItems(obj.line_items)
	};
}

/**
 * Runs a doc-type-specific LLM extraction pass on raw OCR text.
 * Returns typed extracted fields for contract / quotation / purchase_order.
 */
export async function extractDocHubFields(
	rawText: string,
	docType: DocHubDocType,
	env: Env
): Promise<DocHubExtracted> {
	const system = buildSystemPrompt(docType);
	const { json } = await callAiJsonWithSource(env, { system, user: rawText });

	const obj =
		json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};

	if (docType === 'contract') {
		return { docType: 'contract', ...normalizeContract(obj) };
	}
	if (docType === 'quotation') {
		return { docType: 'quotation', ...normalizeQuotation(obj) };
	}
	return { docType: 'purchase_order', ...normalizePurchaseOrder(obj) };
}

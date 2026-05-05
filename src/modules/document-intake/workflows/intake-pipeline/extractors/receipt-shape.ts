/**
 * Receipt-shape extractor. Variants share field set but vary prompt
 * context to bias the LLM toward each scenario's likely fields.
 *   â€?transport      â€?Grab / taxi / MRT receipt
 *   â€?meal           â€?restaurant / cafe receipt
 *   â€?accommodation  â€?hotel / lodging receipt
 *   â€?gift           â€?gift shop / florist receipt
 *   â€?logistics      â€?courier / shipping receipt (trackingNumber key)
 *   â€?sales_cost     â€?formal payment receipt from a supplier
 *   â€?others         â€?generic business expense receipt
 */

import { callAiJsonWithSource } from '$platform/ai/json-provider';
import type { ExtractedFields } from '../types';

export type ReceiptVariant =
	| 'transport'
	| 'meal'
	| 'accommodation'
	| 'gift'
	| 'logistics'
	| 'sales_cost'
	| 'others';

const BASE_SCHEMA = `{
  "supplierName": string|null,
  "documentDate": "YYYY-MM-DD"|null,
  "totalAmount": number|null,
  "currency": "SGD"|"USD"|"CNY"|"MYR"|"EUR"|null,
  "gstAmount": number|null,
  "receiptNumber": string|null,
  "trackingNumber": string|null,
  "staffName": string|null,
  "destination": string|null
}`;

const BASE_RULES = `Rules:
- supplierName = merchant / vendor / service provider name.
- Currency: normalise S$â†’SGD, Â¥/RMBâ†’CNY, US$â†’USD, RMâ†’MYR, â‚¬â†’EUR.
- staffName: only populate if a specific employee name appears on the receipt.
- Be conservative â€?prefer null over guessing.`;

function buildPrompt(variant: ReceiptVariant): string {
	const common = `You extract fields from an OCR'd receipt. Return ONLY a JSON object with these exact keys. Use null for anything not clearly present.

${BASE_SCHEMA}

${BASE_RULES}`;

	if (variant === 'transport') {
		return `${common}

Context: Transport expense receipt (Grab / Gojek / Uber / taxi / MRT / Comfort Delgro / ride-hail). supplierName = the ride-hail app or transport provider. trackingNumber is NOT relevant here â€?leave null.`;
	}
	if (variant === 'meal') {
		return `${common}

Context: Meal expense receipt (restaurant / cafe / food delivery / Toast Box / Starbucks / foodpanda / deliveroo). supplierName = the restaurant or platform.`;
	}
	if (variant === 'accommodation') {
		return `${common}

Context: Hotel / lodging receipt (Marina Bay Sands / Hilton / Marriott / Airbnb / Booking.com / Agoda). supplierName = the hotel or host platform. destination = city/country of the stay when stated.`;
	}
	if (variant === 'gift') {
		return `${common}

Context: Gift purchase receipt (gift shop / florist / FTD). supplierName = the shop.`;
	}
	if (variant === 'logistics') {
		return `${common}

Context: Courier / shipping / logistics receipt (DHL / FedEx / SingPost / UPS / SF Express / Ninja Van). supplierName = the courier. **trackingNumber is a KEY field** â€?look for "Tracking No.", "AWB", "Waybill", "Consignment No."`;
	}
	if (variant === 'sales_cost') {
		return `${common}

Context: Formal payment receipt from a supplier, confirming we (the tenant) paid them for project-related work. receiptNumber is often labelled "Receipt No.", "OR No.", or "Payment Ref". supplierName = the paid supplier.`;
	}
	// others
	return `${common}

Context: Generic business expense receipt.`;
}

function toStr(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	const t = v.trim();
	return t === '' || t.toLowerCase() === 'null' ? null : t;
}

function toNum(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim()) {
		const n = Number(v.replace(/,/g, ''));
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function normCurrency(v: unknown): string | null {
	const s = toStr(v);
	if (!s) return null;
	const up = s.toUpperCase();
	if (['SGD', 'USD', 'CNY', 'MYR', 'EUR'].includes(up)) return up;
	const aliases: Record<string, string> = {
		S$: 'SGD',
		US$: 'USD',
		'Â¥': 'CNY',
		RMB: 'CNY',
		RM: 'MYR',
		EUR: 'EUR'
	};
	return aliases[up] ?? (up.length === 3 ? up : null);
}

function heuristic(rawText: string, variant: ReceiptVariant): Partial<ExtractedFields> {
	const r: Partial<ExtractedFields> = {};
	const dateMatch = rawText.match(/(?:date)[:\s]+(\d{4}-\d{2}-\d{2})/i);
	if (dateMatch?.[1]) r.documentDate = dateMatch[1];
	const totalMatch = rawText.match(
		/(?:total|amount\s*paid)[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
	);
	if (totalMatch?.[1]) r.totalAmount = toNum(totalMatch[1]);
	const gstMatch = rawText.match(/gst[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
	if (gstMatch?.[1]) r.gstAmount = toNum(gstMatch[1]);
	const curMatch = rawText.match(/\b(SGD|USD|CNY|MYR|EUR|S\$|US\$|RMB|RM)\b/i);
	if (curMatch?.[1]) r.currency = normCurrency(curMatch[1]);
	if (variant === 'logistics') {
		const tm = rawText.match(/(?:tracking|awb|waybill|consignment)\s*(?:no\.?|number|#)?[:\s]+([A-Z0-9-]+)/i);
		if (tm?.[1]) r.trackingNumber = tm[1];
	}
	if (variant === 'sales_cost') {
		const rm = rawText.match(/(?:receipt|or)\s*(?:no\.?|number|#)?[:\s]+([A-Z0-9-]+)/i);
		if (rm?.[1]) r.receiptNumber = rm[1];
	}
	return r;
}

export async function extractReceipt(
	rawText: string,
	variant: ReceiptVariant,
	env: Env
): Promise<Partial<ExtractedFields>> {
	try {
		const { json } = await callAiJsonWithSource(env, {
			system: buildPrompt(variant),
			user: rawText.slice(0, 12000),
			promptVersion: `intake-receipt-${variant}-v1`
		});
		if (!json || typeof json !== 'object' || Array.isArray(json)) {
			return heuristic(rawText, variant);
		}
		const p = json as Record<string, unknown>;
		return {
			supplierName: toStr(p.supplierName),
			documentDate: toStr(p.documentDate),
			totalAmount: toNum(p.totalAmount),
			currency: normCurrency(p.currency),
			gstAmount: toNum(p.gstAmount),
			receiptNumber: toStr(p.receiptNumber),
			trackingNumber: toStr(p.trackingNumber),
			staffName: toStr(p.staffName),
			destination: toStr(p.destination)
		};
	} catch {
		return heuristic(rawText, variant);
	}
}

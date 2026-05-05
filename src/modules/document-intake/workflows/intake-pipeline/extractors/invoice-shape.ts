/**
 * Invoice-shape extractor. Three variants share the same field set but
 * different prompt framing for accuracy:
 *   â€?revenue        â€?OUR customer invoice (we are the seller)
 *   â€?sales_cost     â€?supplier invoice billing us for project work
 *   â€?ai_subscription â€?SaaS subscription invoice
 */

import { callAiJsonWithSource } from '$platform/ai/json-provider';
import type { ExtractedFields } from '../types';

export type InvoiceVariant = 'revenue' | 'sales_cost' | 'ai_subscription';

const BASE_SCHEMA = `{
  "invoiceNumber": string|null,
  "supplierName": string|null,
  "clientName": string|null,
  "documentDate": "YYYY-MM-DD"|null,
  "dueDate": "YYYY-MM-DD"|null,
  "totalAmount": number|null,
  "currency": "SGD"|"USD"|"CNY"|"MYR"|"EUR"|null,
  "gstAmount": number|null,
  "invoiceType": "standard"|"zero_rate"|"tax_invoice"|null
}`;

const BASE_RULES = `Rules:
- supplierName = who issues the invoice (the seller/biller).
- clientName = who is billed (the buyer/payer).
- Currency: normalise S$â†’SGD, Â¥/RMBâ†’CNY, US$â†’USD, RMâ†’MYR, â‚¬â†’EUR.
- invoiceType: "tax_invoice" if GST % line is shown; "zero_rate" for zero-rated exports; else "standard".
- Be conservative â€?leave null rather than guess. Accuracy over recall.`;

function buildPrompt(variant: InvoiceVariant): string {
	const common = `You extract fields from an OCR'd invoice. Return ONLY a JSON object with these exact keys. Use null for anything not clearly present.

${BASE_SCHEMA}

${BASE_RULES}`;

	if (variant === 'revenue') {
		return `${common}

Context: This is OUR customer invoice â€?our company (the tenant) is the SELLER. The clientName field = the external customer we billed. supplierName may be null or our own name; don't get confused by that.`;
	}
	if (variant === 'sales_cost') {
		return `${common}

Context: This is a SUPPLIER invoice. Another company is billing us (the tenant) for project-related work. supplierName = the vendor issuing the invoice. clientName is us (the tenant) and usually not needed.`;
	}
	// ai_subscription
	return `${common}

Context: This is a SaaS / AI service subscription invoice (ChatGPT, OpenAI, Cursor, Anthropic, Cloudflare, AWS, Vercel, GitHub, Figma, Notion, Stripe, etc.). supplierName = the SaaS vendor name. dueDate often indicates the NEXT billing date. Invoices are usually recurring monthly.`;
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

function normInvoiceType(v: unknown): 'standard' | 'zero_rate' | 'tax_invoice' | null {
	const s = toStr(v);
	if (!s) return null;
	const lower = s.toLowerCase().replace(/[-\s]/g, '_');
	if (lower === 'standard' || lower === 'zero_rate' || lower === 'tax_invoice') {
		return lower as 'standard' | 'zero_rate' | 'tax_invoice';
	}
	if (lower.includes('zero')) return 'zero_rate';
	if (lower.includes('tax')) return 'tax_invoice';
	return 'standard';
}

/** Regex fallback â€?covers the "AI is down" / "very short text" cases. */
function heuristic(rawText: string): Partial<ExtractedFields> {
	const r: Partial<ExtractedFields> = {};
	const invoiceMatch = rawText.match(/invoice\s*(?:no\.?|number|#)?[:\s]+([A-Z0-9-]+)/i);
	if (invoiceMatch?.[1]) r.invoiceNumber = invoiceMatch[1];
	const dateMatch = rawText.match(/(?:invoice|document|issue)\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i);
	if (dateMatch?.[1]) r.documentDate = dateMatch[1];
	const dueMatch = rawText.match(/due\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i);
	if (dueMatch?.[1]) r.dueDate = dueMatch[1];
	const totalMatch = rawText.match(
		/(?:total|amount\s*due|grand\s*total)[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
	);
	if (totalMatch?.[1]) r.totalAmount = toNum(totalMatch[1]);
	const gstMatch = rawText.match(/(?:gst|tax)\s*(?:amount)?[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
	if (gstMatch?.[1]) r.gstAmount = toNum(gstMatch[1]);
	const curMatch = rawText.match(/\b(SGD|USD|CNY|MYR|EUR|S\$|US\$|RMB|RM)\b/i);
	if (curMatch?.[1]) r.currency = normCurrency(curMatch[1]);
	return r;
}

export async function extractInvoice(
	rawText: string,
	variant: InvoiceVariant,
	env: Env
): Promise<Partial<ExtractedFields>> {
	try {
		const { json } = await callAiJsonWithSource(env, {
			system: buildPrompt(variant),
			user: rawText.slice(0, 12000),
			promptVersion: `intake-invoice-${variant}-v1`
		});
		if (!json || typeof json !== 'object' || Array.isArray(json)) {
			return heuristic(rawText);
		}
		const p = json as Record<string, unknown>;
		return {
			invoiceNumber: toStr(p.invoiceNumber),
			supplierName: toStr(p.supplierName),
			clientName: toStr(p.clientName),
			documentDate: toStr(p.documentDate),
			dueDate: toStr(p.dueDate),
			totalAmount: toNum(p.totalAmount),
			currency: normCurrency(p.currency),
			gstAmount: toNum(p.gstAmount),
			invoiceType: normInvoiceType(p.invoiceType)
		};
	} catch {
		return heuristic(rawText);
	}
}

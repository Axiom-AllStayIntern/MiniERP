import type { ExtractedInvoiceFields } from './types';

function pickCurrency(text: string): string | null {
	const match = text.match(/\b(SGD|USD|CNY|MYR|EUR)\b/i);
	return match ? match[1].toUpperCase() : null;
}

function pickNumber(text: string, pattern: RegExp): number | null {
	const match = text.match(pattern);
	if (!match?.[1]) return null;
	const normalized = match[1].replace(/,/g, '');
	const parsed = Number.parseFloat(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function pickDate(text: string, pattern: RegExp): string | null {
	const match = text.match(pattern);
	return match?.[1] ?? null;
}

export async function extractStructuredInvoiceFields(rawText: string): Promise<ExtractedInvoiceFields> {
	const invoiceDate = pickDate(rawText, /invoice\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i);
	const dueDate = pickDate(rawText, /due\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i);
	const totalAmount = pickNumber(rawText, /(?:total|amount\s*due)[:\s$]+([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
	const gstAmount = pickNumber(rawText, /(?:gst|tax)\s*(?:amount)?[:\s$]+([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
	const supplierNameMatch = rawText.match(/supplier[:\s]+([^\n]+)/i);
	const poMatch = rawText.match(/po(?:\s*number)?[:\s#-]+([A-Z0-9-]+)/i);

	return {
		invoiceDate,
		totalAmount,
		currency: pickCurrency(rawText),
		supplierName: supplierNameMatch?.[1]?.trim() ?? null,
		gstAmount,
		poNumber: poMatch?.[1] ?? null,
		dueDate,
		confidence: 0.5,
		rawText
	};
}

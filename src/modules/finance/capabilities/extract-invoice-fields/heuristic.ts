/**
 * Pure-function heuristic extractor over OCR text.
 *
 * Designed for the small set of supplier-invoice formats SmartFin sees in
 * Phase 2 (SG SMB invoices, Workers AI vision OCR, PDF text-layer dumps).
 * Pattern coverage is intentionally narrow — when the heuristic misses a
 * field the capability falls through to the LLM path.
 */

export interface HeuristicInvoiceFields {
	supplierName: string | null;
	invoiceNumber: string | null;
	issueDate: string | null;
	dueDate: string | null;
	totalAmount: number | null;
	gstAmount: number | null;
	currency: string | null;
}

export interface HeuristicResult {
	fields: HeuristicInvoiceFields;
	filledCount: number;
	confidence: number;
}

const SUPPLIER_BLOCKLIST = /^(invoice|tax\s*invoice|bill|receipt|statement)$/i;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const AMOUNT_RE = /([0-9][0-9,]*(?:\.[0-9]{1,2}))/;
const CURRENCY_RE = /\b(SGD|USD|CNY|MYR|EUR|HKD|GBP|JPY)\b/i;

function pickFirstMatch(text: string, ...patterns: RegExp[]): string | null {
	for (const re of patterns) {
		const match = text.match(re);
		if (match?.[1]) return match[1].trim();
	}
	return null;
}

function pickAmount(text: string, ...patterns: RegExp[]): number | null {
	for (const re of patterns) {
		const match = text.match(re);
		if (match?.[1]) {
			const normalized = match[1].replace(/,/g, '');
			const parsed = Number.parseFloat(normalized);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	return null;
}

function pickSupplierName(text: string): string | null {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

	for (const line of lines.slice(0, 8)) {
		if (line.length < 3 || line.length > 80) continue;
		if (SUPPLIER_BLOCKLIST.test(line)) continue;
		// Heuristic: a supplier line usually has at least one letter and isn't
		// purely a date or amount. Often ends with "Pte Ltd", "Ltd", "Inc",
		// "LLC", etc.
		if (/[a-zA-Z]/.test(line) && !DATE_RE.test(line)) {
			return line;
		}
	}
	return null;
}

function pickCurrency(text: string): string | null {
	const match = text.match(CURRENCY_RE);
	return match ? match[1].toUpperCase() : null;
}

function pickInvoiceNumber(text: string): string | null {
	return pickFirstMatch(
		text,
		/\b(INV-\d{2,}[-_]?\d{2,4})\b/i,
		/\binvoice\s*(?:no\.?|number|#|:)\s*([A-Z][A-Z0-9-]{3,})/i,
		/\b(?:tax\s+)?invoice\s+([A-Z][A-Z0-9-]{4,})/i,
		/\b(CF-\d{4}-Q?\d-\d{4})\b/i,
		/\b(NR-\d{4}-\d{3,4})\b/i,
		/\b([A-Z]{2,4}-\d{4}-\d{3,4})\b/
	);
}

function pickIssueDate(text: string): string | null {
	return pickFirstMatch(
		text,
		/issue\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i,
		/issued\s*on[:\s]+(\d{4}-\d{2}-\d{2})/i,
		/issue[:\s]+(\d{4}-\d{2}-\d{2})/i,
		/date\s*issued[:\s]+(\d{4}-\d{2}-\d{2})/i,
		/invoice\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i
	);
}

function pickDueDate(text: string): string | null {
	return pickFirstMatch(
		text,
		/due\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i,
		/payment\s*due[:\s]+(\d{4}-\d{2}-\d{2})/i,
		/due[:\s]+(\d{4}-\d{2}-\d{2})/i
	);
}

function pickTotal(text: string): number | null {
	return pickAmount(
		text,
		/\btotal\s*payable[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2}))/i,
		/\btotal[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2}))/i,
		/\bamount\s*due[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2}))/i,
		/\bgrand\s*total[:\s$]*([0-9][0-9,]*(?:\.[0-9]{1,2}))/i
	);
}

function pickGst(text: string): number | null {
	return pickAmount(
		text,
		/\bgst\s*\d+%[:\s]*([0-9][0-9,]*(?:\.[0-9]{1,2}))/i,
		/\bgst\s*\(\d+%\)[:\s]*([0-9][0-9,]*(?:\.[0-9]{1,2}))/i,
		/\bgst\s*amount[:\s]*([0-9][0-9,]*(?:\.[0-9]{1,2}))/i,
		/\bgst[:\s]+([0-9][0-9,]*(?:\.[0-9]{1,2}))/i,
		/\btax[:\s]+([0-9][0-9,]*(?:\.[0-9]{1,2}))/i
	);
}

export function runHeuristicExtraction(rawText: string): HeuristicResult {
	const fields: HeuristicInvoiceFields = {
		supplierName: pickSupplierName(rawText),
		invoiceNumber: pickInvoiceNumber(rawText),
		issueDate: pickIssueDate(rawText),
		dueDate: pickDueDate(rawText),
		totalAmount: pickTotal(rawText),
		gstAmount: pickGst(rawText),
		currency: pickCurrency(rawText)
	};

	const filledCount = Object.values(fields).filter((v) => v !== null).length;

	let confidence = 0;
	if (filledCount >= 6) confidence = 0.88;
	else if (filledCount >= 4) confidence = 0.7;
	else if (filledCount >= 2) confidence = 0.4;
	else confidence = 0.1;

	return { fields, filledCount, confidence };
}

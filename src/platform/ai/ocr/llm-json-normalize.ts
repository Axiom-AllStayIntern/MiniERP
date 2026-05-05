/**
 * Weak models (e.g. Workers AI Llama) often return:
 * - snake_case keys vs our camelCase schema
 * - JSON nested under `extracted` / `data`
 * - wrong docType keys for classify
 *
 * External GPT usually follows the prompt exactly; we normalize so both paths map the same way.
 */

/** Merge nested object one level (nested wins on key conflict). */
export function unwrapLlmJsonObject(parsed: Record<string, unknown>): Record<string, unknown> {
	const nested = parsed.extracted ?? parsed.data;
	if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
		return { ...parsed, ...(nested as Record<string, unknown>) };
	}
	return { ...parsed };
}

export function applyClassifyAliases(parsed: Record<string, unknown>): Record<string, unknown> {
	const o = unwrapLlmJsonObject(parsed);
	if (o.docType == null && typeof o.document_type === 'string') o.docType = o.document_type;
	if (o.docType == null && typeof o.type === 'string') o.docType = o.type;
	return o;
}

type ExtractDocType =
	| 'contract'
	| 'quotation'
	| 'purchase_order'
	| 'invoice_out'
	| 'invoice_in'
	| 'expense'
	| 'other';

/** Copy alias → canonical key only if canonical is missing. */
export function applyExtractAliases(parsed: Record<string, unknown>, docType: ExtractDocType): Record<string, unknown> {
	const o = unwrapLlmJsonObject(parsed);

	const copy = (from: string, to: string) => {
		if (o[to] !== undefined && o[to] !== null) return;
		if (o[from] === undefined || o[from] === null) return;
		o[to] = o[from];
	};

	// Common across doc types
	copy('invoice_no', 'invoiceNo');
	copy('invoice_number', 'invoiceNo');
	copy('invoice_date', 'invoiceDate');
	copy('due_date', 'invoiceDueDate');
	copy('gst_amount', 'invoiceGstAmount');
	copy('tax_amount', 'invoiceGstAmount');
	copy('supplier_name', 'supplierName');
	copy('vendor_name', 'supplierName');
	copy('customer_name', 'customerName');
	copy('bill_to', 'customerName');
	copy('po_number', 'poNumber');
	copy('purchase_order_number', 'poNumber');
	copy('contract_no', 'contractNo');
	copy('contract_number', 'contractNo');
	copy('contract_date', 'contractDate');
	copy('quotation_ref', 'quotationRef');
	copy('quote_ref', 'quotationRef');
	copy('expense_date', 'expenseDate');
	copy('merchant', 'expenseCategory');
	copy('field_confidence', 'fieldConfidence');

	if (docType === 'invoice_in' || docType === 'invoice_out') {
		copy('total', 'invoiceAmount');
		copy('total_amount', 'invoiceAmount');
		copy('amount', 'invoiceAmount');
		copy('grand_total', 'invoiceAmount');
		copy('invoice_total', 'invoiceAmount');
	}
	if (docType === 'purchase_order') {
		copy('total_amount', 'contractAmount');
		copy('total', 'contractAmount');
		copy('amount', 'contractAmount');
	}
	if (docType === 'quotation') {
		copy('total_amount', 'quotationAmount');
		copy('total', 'quotationAmount');
	}
	if (docType === 'contract') {
		copy('total_amount', 'contractAmount');
		copy('amount', 'contractAmount');
	}
	if (docType === 'expense') {
		copy('total_amount', 'expenseAmount');
		copy('total', 'expenseAmount');
		copy('amount', 'expenseAmount');
	}

	return o;
}

function nonEmptyScalar(v: unknown): boolean {
	if (v === null || v === undefined) return false;
	if (typeof v === 'string') return v.trim().length > 0;
	if (typeof v === 'number') return Number.isFinite(v);
	return false;
}

/** True if mapped extraction has at least one business field (or fieldConfidence); else treat as LLM miss and use heuristic. */
export function llmExtractionHasUsableSignal(docType: ExtractDocType, r: Record<string, unknown>): boolean {
	const fc = r.fieldConfidence;
	if (fc && typeof fc === 'object' && !Array.isArray(fc) && Object.keys(fc as Record<string, unknown>).length > 0) {
		return true;
	}

	switch (docType) {
		case 'contract':
			return (
				nonEmptyScalar(r.contractNo) ||
				nonEmptyScalar(r.contractDate) ||
				nonEmptyScalar(r.contractAmount)
			);
		case 'quotation':
			return (
				nonEmptyScalar(r.quotationRef) ||
				nonEmptyScalar(r.quotationAmount) ||
				nonEmptyScalar(r.quotationDate)
			);
		case 'purchase_order':
			return (
				nonEmptyScalar(r.poNumber) ||
				nonEmptyScalar(r.supplierName) ||
				nonEmptyScalar(r.contractAmount)
			);
		case 'invoice_in':
		case 'invoice_out':
			return (
				nonEmptyScalar(r.invoiceNo) ||
				nonEmptyScalar(r.invoiceAmount) ||
				nonEmptyScalar(r.supplierName) ||
				nonEmptyScalar(r.customerName) ||
				nonEmptyScalar(r.invoiceDate)
			);
		case 'expense':
			return (
				nonEmptyScalar(r.expenseAmount) ||
				nonEmptyScalar(r.expenseCategory) ||
				nonEmptyScalar(r.expenseDate)
			);
		case 'other':
			return Object.keys(r).some((k) => {
				if (k === 'confidence' || k === 'fieldConfidence') return false;
				return nonEmptyScalar(r[k]);
			});
		default:
			return false;
	}
}

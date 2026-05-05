/**
 * Thin wrappers over the existing extractDocHubFields helper â€?reshapes
 * its snake_case output into the intake pipeline's camelCase ExtractedFields
 * partial. Existing prompts are already good; no reason to re-author them.
 */

import { extractDocHubFields } from '$platform/ai/ocr/doc-hub-extract';
import type { ExtractedFields } from '../types';

export async function extractContract(
	rawText: string,
	env: Env
): Promise<Partial<ExtractedFields>> {
	const r = await extractDocHubFields(rawText, 'contract', env);
	if (r.docType !== 'contract') return {};
	return {
		contractNumber: r.contract_number,
		clientName: r.client_name,
		effectiveDate: r.effective_date,
		expiryDate: r.expiry_date,
		totalAmount: r.amount,
		currency: r.currency,
		paymentTerms: r.payment_terms,
		scope: r.scope
	};
}

export async function extractQuotation(
	rawText: string,
	env: Env
): Promise<Partial<ExtractedFields>> {
	const r = await extractDocHubFields(rawText, 'quotation', env);
	if (r.docType !== 'quotation') return {};
	return {
		quotationNumber: r.quotation_number,
		clientName: r.client_name,
		documentDate: r.date,
		validUntil: r.valid_until,
		totalAmount: r.amount,
		currency: r.currency
	};
}

export async function extractPo(rawText: string, env: Env): Promise<Partial<ExtractedFields>> {
	const r = await extractDocHubFields(rawText, 'purchase_order', env);
	if (r.docType !== 'purchase_order') return {};
	return {
		poNumber: r.po_number,
		supplierName: r.supplier_name,
		clientName: r.client_name,
		documentDate: r.date,
		totalAmount: r.amount,
		currency: r.currency,
		description: r.description
	};
}

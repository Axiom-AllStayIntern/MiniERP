import type { RequestHandler } from '@sveltejs/kit';

import { fail, ok } from '$platform/http';
import { runOcrPipeline } from '$platform/ai/ocr/pipeline';
import { extractDocumentFieldsCapability } from '$modules/finance';

/**
 * POST /api/finance/invoice-from-po/extract
 *
 * Accepts a PO file (PDF/image/docx), runs OCR + LLM extraction using the
 * existing extract-document-fields capability with the PO category, and
 * returns fields mapped for the customer invoice generation form.
 * Does NOT persist anything.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) {
		return fail('Missing or empty file field "file"', 400);
	}

	const bytes = await file.arrayBuffer();
	const fileType = file.type || 'application/octet-stream';
	const clientRawText = String(form.get('rawText') || '');

	let extracted: Awaited<ReturnType<typeof runOcrPipeline>>;
	try {
		extracted = await runOcrPipeline(fileType, bytes, platform.env, {
			fileName: file.name,
			rawTextOverride: clientRawText || undefined
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return fail(`OCR pipeline failed: ${message}`, 500);
	}

	const rawText = extracted.rawText?.trim() ?? '';
	if (!rawText || rawText.length < 32) {
		return fail('No text could be extracted from this file. Try a clearer scan or a different file.', 400);
	}

	const documentId = `po-extract-${Date.now()}`;
	let result: Awaited<ReturnType<typeof extractDocumentFieldsCapability.execute>>;
	try {
		result = await extractDocumentFieldsCapability.execute(
			{
				documentId,
				fileName: file.name,
				text: rawText,
				categoryId: 'document_only.purchase_order_doc',
				outputShape: 'category'
			},
			{
				tenantId: 'default',
				userId: 'system',
				env: platform.env
			}
		);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return fail(`PO field extraction failed: ${message}`, 500);
	}

	if (!result.fields || Object.keys(result.fields).length === 0) {
		return fail('Could not extract fields from this PO. Try a clearer scan or enter fields manually.', 400);
	}

	const f = result.fields;
	const str = (v: unknown): string | null =>
		typeof v === 'string' && v.trim() ? v.trim() : null;
	const num = (v: unknown): number | null =>
		typeof v === 'number' && Number.isFinite(v) ? v : null;

	const rawLineItems = Array.isArray(f.line_items) ? f.line_items : [];
	const lineItems = rawLineItems.map((item: Record<string, unknown>) => ({
		itemName: str(item.description) ?? '',
		description: '',
		qty: num(item.qty) ?? 1,
		uom: 'EA',
		unitPrice: num(item.unitPrice) ?? num(item.amount) ?? 0
	}));

	return ok({
		fileName: file.name,
		provider: result.provider,
		confidence: result.confidence,
		suggestions: {
			clientName: str(f.client_name) ?? null,
			poNumber: str(f.po_number) ?? null,
			currency: str(f.currency) ?? 'SGD',
			date: str(f.date) ?? null,
			totalAmount: num(f.amount) ?? null,
			supplierName: str(f.supplier_name) ?? null,
			description: str(f.description) ?? null,
			lineItems
		},
		sourceQuotes: result.sourceQuotes,
		rawTextPreview: rawText.slice(0, 4000),
		rawTextLength: rawText.length
	});
};

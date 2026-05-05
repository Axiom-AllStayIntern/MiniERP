import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { runOcrPipeline } from '$platform/ai/ocr/pipeline';

/**
 * POST /api/finance/revenue-invoice/detect
 *
 * OCR + `invoice_out` structured extraction (same LLM path as `/api/ocr/llm-extract`)
 * without persisting storage or DB rows.
 */
export const POST: RequestHandler = async ({ request, platform, fetch }) => {
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
		const stack = e instanceof Error ? e.stack : '';
		return fail(`OCR pipeline failed: ${message}`, 500, {
			message,
			stack: stack?.slice(0, 1500) ?? '',
			fileType,
			fileSize: bytes.byteLength
		});
	}

	const text = extracted.rawText?.trim() ?? '';
	if (!text) {
		return fail('No text could be extracted from this file. Try a clearer scan or enter fields manually.', 400);
	}

	let llmProvider = 'heuristic';
	let llmResult: Record<string, unknown> | null = null;

	try {
		const llmRes = await fetch(new URL('/api/ocr/llm-extract', request.url), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ docType: 'invoice_out', text })
		});
		const llmJson = (await llmRes.json()) as {
			ok?: boolean;
			data?: { provider?: string; result?: Record<string, unknown> };
			error?: string;
		};
		if (llmRes.ok && llmJson.ok && llmJson.data?.result && typeof llmJson.data.result === 'object') {
			llmProvider = llmJson.data.provider ?? 'heuristic';
			llmResult = llmJson.data.result;
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return fail(`Invoice field extraction failed: ${message}`, 500, { message });
	}

	const r = llmResult ?? {};
	const num = (v: unknown): number | null =>
		typeof v === 'number' && Number.isFinite(v) ? v : null;
	const strOrNull = (v: unknown): string | null =>
		typeof v === 'string' && v.trim() ? v.trim() : null;

	const suggestions = {
		invoiceNo: strOrNull(r.invoiceNo),
		invoiceDate: strOrNull(r.invoiceDate),
		invoiceDueDate: strOrNull(r.invoiceDueDate),
		invoiceCurrency: strOrNull(r.invoiceCurrency),
		invoiceAmount: num(r.invoiceAmount),
		invoiceGstAmount: num(r.invoiceGstAmount),
		customerName: strOrNull(r.customerName),
		poNumber: strOrNull(r.poNumber)
	};

	return ok({
		fileName: file.name,
		fileType,
		ocr: {
			extractionMethod: extracted.extractionMethod,
			ocrProvider: extracted.ocrProvider,
			llmProvider: extracted.llmProvider,
			warnings: extracted.validationWarnings ?? []
		},
		llm: { provider: llmProvider, result: llmResult },
		suggestions,
		rawTextPreview: extracted.rawText?.slice(0, 8000) ?? '',
		rawTextLength: extracted.rawText?.length ?? 0
	});
};


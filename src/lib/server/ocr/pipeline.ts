import { extractStructuredInvoiceFields } from './llm-extract';
import { extractWithExternalOcr } from './ocr-api';
import { extractPdfText } from './pdf-extract';
import type { ExtractedInvoiceFields } from './types';

export async function runOcrPipeline(fileType: string, data: ArrayBuffer): Promise<ExtractedInvoiceFields> {
	let text = '';
	let confidence = 0;

	if (fileType.includes('pdf')) {
		text = await extractPdfText(data);
		confidence = text.length > 0 ? 0.7 : 0.1;
	} else {
		const result = await extractWithExternalOcr(data);
		text = result.text;
		confidence = result.confidence ?? 0.2;
	}

	const structured = await extractStructuredInvoiceFields(text);
	return {
		...structured,
		confidence: Math.max(structured.confidence, confidence)
	};
}

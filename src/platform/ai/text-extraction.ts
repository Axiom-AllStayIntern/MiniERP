/**
 * Text extraction abstraction (Phase 2).
 *
 * Hides three concrete OCR / parse paths behind a single function so
 * Document Intake's `processDocument` doesn't care whether the file was a
 * PDF with a text layer, a scanned image, or â€?when running offline /
 * without an AI binding â€?a mock fixture.
 *
 * Output shape conforms to `TextExtractionResult` in
 * `src/modules/document-intake/schemas/document-artifact.schema.ts`
 * (doc 04 Â§11). Callers persist this directly into the artifact.
 */
import { runWorkersVisionOcr } from './ocr/workers-vision-ocr';
import type { TextExtractionResult } from '../../modules/document-intake/schemas/document-artifact.schema';
import type { FileServiceContract } from '../files/file.types';
import { pickMockFixtureText } from './text-extraction-fixtures';

export interface ExtractTextInput {
	fileRef: {
		key: string;
		mimeType: string;
		fileName?: string;
		sizeBytes?: number;
	};
	fileService: FileServiceContract;
	env: Env;
	/**
	 * Force the mock branch. Useful for local dev without a Workers AI binding
	 * and for the scratch verification drivers.
	 */
	useMock?: boolean;
}

const PDF_BYTE_READ_LIMIT = 50_000;
const MIN_USEFUL_PDF_TEXT = 48;

function decodePdfHeuristicBytes(bytes: Uint8Array): string {
	const slice = bytes.byteLength > PDF_BYTE_READ_LIMIT ? bytes.slice(0, PDF_BYTE_READ_LIMIT) : bytes;
	const decoder = new TextDecoder('utf-8', { fatal: false });
	return decoder
		.decode(slice)
		.replace(/\u0000/g, ' ')
		.replace(/\ufffd+/g, ' ')
		.replace(/\s{4,}/g, '   ')
		.trim();
}

function isPdfMime(mime: string, fileName?: string): boolean {
	if (mime.toLowerCase().includes('pdf')) return true;
	return Boolean(fileName?.toLowerCase().endsWith('.pdf'));
}

function isImageMime(mime: string, fileName?: string): boolean {
	if (mime.toLowerCase().startsWith('image/')) return true;
	return Boolean(fileName && /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(fileName));
}

function buildMockResult(input: ExtractTextInput): TextExtractionResult {
	const fixture = pickMockFixtureText({
		fileName: input.fileRef.fileName,
		key: input.fileRef.key
	});
	return {
		method: 'manual',
		status: 'success',
		text: fixture.text,
		confidence: fixture.confidence,
		provider: 'mock-v1',
		language: 'en'
	};
}

function buildFailure(code: string, message: string, method: TextExtractionResult['method']): TextExtractionResult {
	return {
		method,
		status: 'failed',
		error: { code, message }
	};
}

/**
 * Run text extraction. Phase 2 supports three paths:
 *  - PDF with a text layer (heuristic byte decode â€?same approach as the
 *    existing `$platform/ai/ocr/pipeline.ts:extractPdfText`).
 *  - Image (Workers AI vision via `runWorkersVisionOcr`).
 *  - Mock fixture (filename keyword lookup) when caller opts in or when the
 *    AI binding is missing.
 *
 * Scanned PDFs fall through to `needs_manual_review` in Phase 2; rasterized
 * page-1 vision fallback lands in Phase 4 alongside async processing.
 */
export async function extractTextFromBlob(
	input: ExtractTextInput
): Promise<TextExtractionResult> {
	const { fileRef, fileService, env } = input;

	if (input.useMock) {
		return buildMockResult(input);
	}

	if (isPdfMime(fileRef.mimeType, fileRef.fileName)) {
		const bytes = await fileService.getBytes(fileRef.key);
		if (!bytes) return buildFailure('blob_not_found', `No object at ${fileRef.key}`, 'pdf_text');
		const text = decodePdfHeuristicBytes(bytes);
		if (text.length >= MIN_USEFUL_PDF_TEXT) {
			return {
				method: 'pdf_text',
				status: 'success',
				text,
				confidence: 0.7,
				provider: 'builtin_pdf'
			};
		}
		// Scanned PDF: page-1 raster + vision is a Phase 4 follow-up. For now
		// we return a clean partial result so the artifact lands in
		// `needs_manual_review`.
		return {
			method: 'pdf_text',
			status: 'partial',
			text,
			confidence: 0.2,
			provider: 'builtin_pdf',
			error: {
				code: 'low_text_yield',
				message: 'PDF text layer was empty or unreadable; OCR fallback not wired in Phase 2.'
			}
		};
	}

	if (isImageMime(fileRef.mimeType, fileRef.fileName)) {
		if (!env.AI) {
			// No AI binding â€?fall back to mock fixture so local dev still works.
			return buildMockResult(input);
		}
		const bytes = await fileService.getBytes(fileRef.key);
		if (!bytes) return buildFailure('blob_not_found', `No object at ${fileRef.key}`, 'vision_model');
		const result = await runWorkersVisionOcr(env, {
			imageBytes: bytes,
			mimeType: fileRef.mimeType
		});
		if (!result.ok) {
			return buildFailure('vision_failed', result.error, 'vision_model');
		}
		return {
			method: 'vision_model',
			status: 'success',
			text: result.text,
			confidence: 0.85,
			provider: 'workers_ai',
			providerJobId: result.model
		};
	}

	return buildFailure(
		'unsupported_format',
		`MIME type ${fileRef.mimeType || 'unknown'} is not supported by Phase 2 extraction.`,
		'manual'
	);
}


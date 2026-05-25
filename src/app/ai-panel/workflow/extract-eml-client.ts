/**
 * Client-side EML extraction for the upload pipeline.
 *
 * EML is a container format. The actual financial document (invoice PDF,
 * PO DOCX, etc.) lives inside as an attachment. This module:
 *   1. Parses the EML (browser-compatible platform parser)
 *   2. Scores attachments with keyword heuristics to find the financial document
 *   3. Extracts text from the selected attachment using the same methods as
 *      direct-upload (pdfjs for PDFs, DOCX XML for Word files)
 *   4. Prepends a minimal email context header (From / Subject) so the LLM
 *      knows the provenance
 *
 * Result is structurally identical to clientExtractedText for a direct PDF/DOCX
 * upload — the server classify + extract-fields pipeline sees no difference.
 */

import { parseEmlStructured } from '$platform/files/eml/parse-eml';

// ---------------------------------------------------------------------------
// Attachment scoring (keyword heuristics — no LLM on client)
// ---------------------------------------------------------------------------

const FINANCIAL_KEYWORDS = [
	'invoice', 'inv', 'receipt', 'payment', 'purchase', 'order',
	'quotation', 'quote', 'contract', 'statement', 'remittance',
	'proforma', 'delivery', 'bill', 'tax', 'po', 'do'
];

const KNOWN_IMAGE_RE = /^image\/(png|jpe?g|webp|gif|bmp|tiff?)$/i;

function effectiveMime(mimeType: string, filename: string): string {
	if (mimeType !== 'application/octet-stream') return mimeType;
	const lower = filename.toLowerCase();
	if (lower.endsWith('.pdf')) return 'application/pdf';
	if (lower.endsWith('.docx'))
		return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	if (lower.endsWith('.doc')) return 'application/msword';
	return mimeType;
}

function scoreAttachment(filename: string, mime: string, bodyText: string, subject: string): number {
	// Outlook decoration images — never score
	if (/^Outlook-[A-Za-z0-9]/i.test(filename)) return 0;

	const eMime = effectiveMime(mime, filename);

	let score = 0;
	if (eMime === 'application/pdf') score += 3;
	else if (
		eMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
		eMime === 'application/msword'
	) score += 2;
	else if (KNOWN_IMAGE_RE.test(eMime)) score += 2;
	else return 0;

	const name = filename.toLowerCase();
	const context = (bodyText + ' ' + subject).toLowerCase();

	for (const kw of FINANCIAL_KEYWORDS) {
		if (name.includes(kw)) { score += 5; break; }
	}

	const nameNoExt = name.replace(/\.[^.]+$/, '');
	if (nameNoExt.length >= 6 && context.includes(nameNoExt)) score += 4;
	if (FINANCIAL_KEYWORDS.some((kw) => context.includes(kw))) score += 1;

	return score;
}

// ---------------------------------------------------------------------------
// PDF text extraction (pdfjs) — passed in as a callback to avoid bundling
// pdfjs here; the caller (UploadStep.svelte) already has pdfjs loaded.
// ---------------------------------------------------------------------------

export type PdfExtractor = (file: File) => Promise<string>;
export type PdfPageRenderer = (file: File) => Promise<File | null>;
export type DocxExtractor = (file: File) => Promise<string>;

export interface EmlClientExtractionResult {
	/** The composed rawText: email context header + extracted attachment text. */
	text: string;
	/** 'pdfjs' when the primary attachment was a PDF extracted via pdfjs. */
	method: 'pdfjs' | 'vision_first_page' | 'manual';
	/**
	 * When set, the caller should upload this File instead of the original EML.
	 * Used when the best attachment is a scanned PDF rasterized to JPEG for
	 * server-side vision OCR.
	 */
	overrideUploadFile?: File;
}

const MIN_USEFUL_TEXT = 48;
const MAX_TOTAL_ATTACHMENTS = 3;
const MIN_RELEVANCE_SCORE = 3;
const EMAIL_CONTEXT_CAP = 800;

export async function extractEmlClientText(
	emlFile: File,
	extractors: {
		pdf: PdfExtractor;
		pdfPageRender: PdfPageRenderer;
		docx: DocxExtractor;
	}
): Promise<EmlClientExtractionResult> {
	const raw = new TextDecoder('utf-8', { fatal: false }).decode(
		new Uint8Array(await emlFile.arrayBuffer())
	);

	const structured = parseEmlStructured(raw);
	const { subject, from, bodyText, attachments } = structured;

	// Score and sort attachments
	const scored = attachments
		.filter((a) => a.bytes && a.bytes.byteLength > 0)
		.map((a) => ({
			att: a,
			mime: effectiveMime(a.mimeType, a.filename),
			score: scoreAttachment(a.filename, a.mimeType, bodyText, subject)
		}))
		.filter(({ score }) => score >= MIN_RELEVANCE_SCORE)
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_TOTAL_ATTACHMENTS);

	// Build email context prefix (short — attachment content is the primary signal)
	const ctxLines: string[] = [];
	if (from) ctxLines.push(`From: ${from.slice(0, 150)}`);
	if (subject) ctxLines.push(`Subject: ${subject.slice(0, 150)}`);
	if (bodyText) {
		const body = bodyText.length > EMAIL_CONTEXT_CAP
			? bodyText.slice(0, EMAIL_CONTEXT_CAP) + '[...]'
			: bodyText;
		ctxLines.push('', body);
	}
	const emailContext = ctxLines.join('\n');

	// Try to extract text from each scored attachment in priority order
	for (const { att, mime } of scored) {
		const attBytes = att.bytes!;
		const ab = attBytes.buffer.slice(attBytes.byteOffset, attBytes.byteOffset + attBytes.byteLength) as ArrayBuffer;
		const blob = new Blob([ab], { type: mime });
		const attFile = new File([blob], att.filename, { type: mime });

		// PDF — pdfjs text layer (same path as direct PDF upload)
		if (mime === 'application/pdf') {
			const pdfText = await extractors.pdf(attFile).catch(() => '');
			if (pdfText.length >= MIN_USEFUL_TEXT) {
				return {
					text: [emailContext, `--- ${att.filename} ---`, pdfText]
						.filter(Boolean).join('\n\n'),
					method: 'pdfjs'
				};
			}
			// Scanned PDF: rasterize page 1, let server vision OCR handle it.
			// Upload the JPEG instead of the EML so the server processes it directly.
			const jpeg = await extractors.pdfPageRender(attFile).catch(() => null);
			if (jpeg) {
				return {
					text: emailContext,
					method: 'vision_first_page',
					overrideUploadFile: jpeg
				};
			}
		}

		// DOCX
		if (
			mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
			mime === 'application/msword'
		) {
			const docxText = await extractors.docx(attFile).catch(() => '');
			if (docxText.length >= MIN_USEFUL_TEXT) {
				return {
					text: [emailContext, `--- ${att.filename} ---`, docxText]
						.filter(Boolean).join('\n\n'),
					method: 'manual'
				};
			}
		}

		// Image — server vision OCR will handle; include email context only
		if (KNOWN_IMAGE_RE.test(mime)) {
			return { text: emailContext, method: 'manual' };
		}
	}

	// No extractable attachment found — return email context alone (server fallback)
	return { text: emailContext, method: 'manual' };
}

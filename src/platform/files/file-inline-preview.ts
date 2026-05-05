/**
 * Inline preview surface for files served via `/api/files?key=…`.
 * PDF/image use native iframe/img; text-like types use `/api/files/text-preview`.
 */

export type FileInlinePreviewKind = 'pdf' | 'image' | 'text' | 'none' | 'other';

function fileNameFromHints(fileNameHint: string | null | undefined, storageKey: string | null | undefined): string {
	const h = fileNameHint?.trim();
	if (h) return h;
	if (!storageKey) return '';
	const tail = storageKey.split('/').pop() ?? '';
	try {
		const dec = decodeURIComponent(tail);
		return dec.replace(/^[0-9a-f-]{36}_/i, '').trim() || dec;
	} catch {
		return tail;
	}
}

/** Extension from file name (lowercase, no dot) */
function extFromName(name: string): string {
	const m = /\.([a-z0-9]+)$/i.exec(name.trim());
	return (m?.[1] ?? '').toLowerCase();
}

/**
 * Decide how to preview a file in the browser.
 * `documentsFileType` is the coarse `documents.file_type` bucket (`pdf` | `image` | …).
 */
export function inferFileInlinePreviewKind(input: {
	fileViewUrl: string | null | undefined;
	fileNameHint?: string | null | undefined;
	storageKey?: string | null | undefined;
	contentType?: string | null | undefined;
	documentsFileType?: string | null | undefined;
}): FileInlinePreviewKind {
	if (!input.fileViewUrl) return 'none';

	const fn = fileNameFromHints(input.fileNameHint, input.storageKey).toLowerCase();
	const ct = (input.contentType ?? '').toLowerCase();
	const ext = extFromName(fn);

	if (ct.includes('pdf') || fn.endsWith('.pdf') || input.documentsFileType === 'pdf') return 'pdf';
	if (
		ct.startsWith('image/') ||
		/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fn) ||
		input.documentsFileType === 'image'
	) {
		return 'image';
	}

	if (
		ext === 'docx' ||
		ct.includes('wordprocessingml.document') ||
		(ct === 'application/zip' && fn.endsWith('.docx'))
	) {
		return 'text';
	}

	if (
		/^(txt|csv|md|eml|json|log|tsv)$/i.test(ext) ||
		ct === 'text/plain' ||
		ct.includes('text/csv') ||
		ct === 'message/rfc822'
	) {
		return 'text';
	}

	if (/\.(doc|xls|ppt)$/i.test(fn) || /\.(xlsx|pptx)$/i.test(fn)) {
		return 'other';
	}

	return 'other';
}

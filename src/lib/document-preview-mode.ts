/**
 * Inline preview mode for document detail pages.
 * Prefer upload metadata; fall back to the file path (R2 key often ends with `*_OriginalName.pdf`).
 */
export type DocumentPreviewUpload = { fileName?: string; contentType?: string } | null | undefined;

export function documentPreviewMode(opts: {
	fileViewUrl: string | null | undefined;
	fileUrl: string | null | undefined;
	upload: DocumentPreviewUpload;
}): 'pdf' | 'image' | 'none' | 'other' {
	const { fileViewUrl, fileUrl, upload } = opts;
	if (!fileViewUrl) return 'none';

	const fn = (upload?.fileName ?? '').toLowerCase();
	const ct = (upload?.contentType ?? '').toLowerCase();
	if (ct.includes('pdf') || fn.endsWith('.pdf')) return 'pdf';
	if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fn)) return 'image';

	const key = (fileUrl ?? '').toLowerCase();
	if (!key || key.startsWith('manual://')) return 'other';

	const last = key.split('/').pop() ?? '';
	const base = last.includes('_') ? last.slice(last.indexOf('_') + 1) : last;
	const nameForExt = base || last;
	if (nameForExt.endsWith('.pdf')) return 'pdf';
	if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(nameForExt)) return 'image';

	return 'other';
}

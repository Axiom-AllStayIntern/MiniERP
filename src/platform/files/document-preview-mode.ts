/**
 * Inline preview mode for document detail pages (contracts, quotations, POs, etc.).
 * Prefer upload metadata; fall back to the file path (R2 key often ends with `*_OriginalName.pdf`).
 */
import { inferFileInlinePreviewKind, type FileInlinePreviewKind } from '$platform/files/file-inline-preview';

export type { FileInlinePreviewKind };

export type DocumentPreviewUpload = { fileName?: string; contentType?: string } | null | undefined;

export function documentPreviewMode(opts: {
	fileViewUrl: string | null | undefined;
	fileUrl: string | null | undefined;
	upload: DocumentPreviewUpload;
}): FileInlinePreviewKind {
	const { fileViewUrl, fileUrl, upload } = opts;
	return inferFileInlinePreviewKind({
		fileViewUrl,
		fileNameHint: upload?.fileName,
		storageKey: fileUrl,
		contentType: upload?.contentType,
		documentsFileType: null
	});
}

/** R2 object keys served through GET /api/files */
export function r2FileUrls(key: string | null | undefined): {
	fileViewUrl: string | null;
	fileDownloadUrl: string | null;
} {
	if (!key || key.startsWith('manual://')) {
		return { fileViewUrl: null, fileDownloadUrl: null };
	}
	const enc = encodeURIComponent(key);
	return {
		fileViewUrl: `/api/files?key=${enc}`,
		fileDownloadUrl: `/api/files?key=${enc}&download=1`
	};
}

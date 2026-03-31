export async function extractPdfText(data: ArrayBuffer): Promise<string> {
	const bytes = new Uint8Array(data);
	const decoder = new TextDecoder('utf-8', { fatal: false });
	const snippet = decoder.decode(bytes.slice(0, Math.min(bytes.length, 8000)));

	// Placeholder implementation for MVP architecture skeleton.
	return snippet.replace(/\u0000/g, ' ').trim();
}

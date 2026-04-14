/**
 * Calls a local (or LAN) HTTP service running PaddleOCR.
 * Expected: POST multipart field `file` → JSON `{ "text": "..." }` or plain text body.
 */

export type PaddleOcrHttpResult = { ok: true; text: string } | { ok: false; error: string };

/** `PADDLE_OCR_URL` may be `http://127.0.0.1:8765` or full path `http://127.0.0.1:8765/ocr`. */
function resolvePaddleEndpoint(configured: string): string {
	const u = configured.trim().replace(/\/+$/, '');
	if (/\/ocr$/i.test(u)) return u;
	return `${u}/ocr`;
}

export async function runPaddleOcrHttp(
	baseUrl: string,
	input: { imageBytes: Uint8Array; mimeType: string; fileName: string }
): Promise<PaddleOcrHttpResult> {
	const endpoint = resolvePaddleEndpoint(baseUrl);
	const copy = new Uint8Array(input.imageBytes.byteLength);
	copy.set(input.imageBytes);
	const blob = new Blob([copy], { type: input.mimeType });
	const fd = new FormData();
	fd.append('file', blob, input.fileName || 'upload');

	try {
		const res = await fetch(endpoint, { method: 'POST', body: fd });
		const ct = res.headers.get('content-type') ?? '';

		if (!res.ok) {
			const errBody = await res.text().catch(() => '');
			return {
				ok: false,
				error: `Paddle OCR HTTP ${res.status}: ${errBody.slice(0, 200) || res.statusText}`
			};
		}

		if (ct.includes('application/json')) {
			const json = (await res.json()) as Record<string, unknown>;
			if (typeof json.text === 'string' && json.text.trim()) {
				return { ok: true, text: json.text.trim() };
			}
			if (Array.isArray(json.lines)) {
				const text = json.lines
					.map((l) => (typeof l === 'string' ? l : ''))
					.filter(Boolean)
					.join('\n');
				if (text.trim()) return { ok: true, text: text.trim() };
			}
			return { ok: false, error: 'Paddle OCR JSON missing "text" or "lines".' };
		}

		const text = (await res.text()).trim();
		if (text) return { ok: true, text };
		return { ok: false, error: 'Paddle OCR returned empty body.' };
	} catch (e) {
		return {
			ok: false,
			error: e instanceof Error ? e.message : 'Paddle OCR request failed (network?).'
		};
	}
}

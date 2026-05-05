import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { extractDocxPlainText, tryExtractDocxPlainText } from '$platform/files/docx/extract-plain-text';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHARS = 120_000;

function extFromKey(key: string): string {
	const seg = key.split('/').pop() ?? key;
	const name = (() => {
		try {
			return decodeURIComponent(seg);
		} catch {
			return seg;
		}
	})();
	const m = /\.([a-z0-9]+)$/i.exec(name);
	return (m?.[1] ?? '').toLowerCase();
}

function decodeUtf8(buf: ArrayBuffer): string {
	return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform?.env?.R2) {
		return fail('R2 storage is not bound in this runtime.', 503);
	}

	const key = url.searchParams.get('key')?.trim();
	if (!key) {
		return fail('Missing key', 400);
	}

	const object = await platform.env.R2.get(key);
	if (!object) {
		return fail('File not found in R2.', 404);
	}

	const size = object.size;
	if (typeof size === 'number' && size > MAX_BYTES) {
		return fail(`File too large for text preview (max ${MAX_BYTES / (1024 * 1024)} MB).`, 413);
	}

	const buf = await object.arrayBuffer();
	if (buf.byteLength > MAX_BYTES) {
		return fail(`File too large for text preview (max ${MAX_BYTES / (1024 * 1024)} MB).`, 413);
	}

	const ext = extFromKey(key);
	let text: string;

	const docxQuick = tryExtractDocxPlainText(buf);
	if (docxQuick) {
		text = docxQuick;
	} else if (/^(txt|csv|md|eml|json|log|tsv|html|htm)$/i.test(ext)) {
		text = decodeUtf8(buf);
	} else if (ext === 'docx') {
		try {
			text = extractDocxPlainText(buf);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fail(`Could not read this .docx: ${msg}`, 422);
		}
	} else {
		return fail(
			'Text preview is not available for this file type. Use Download or open the file locally (e.g. Excel for .xlsx).',
			415
		);
	}

	const trimmed = text.trim();
	if (!trimmed) {
		return ok({ text: '', truncated: false, empty: true as const });
	}

	const truncated = trimmed.length > MAX_CHARS;
	const out = truncated ? trimmed.slice(0, MAX_CHARS) : trimmed;
	return ok({ text: out, truncated, empty: false as const });
};


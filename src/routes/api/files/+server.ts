import type { RequestHandler } from './$types';

import { fail } from '$platform/http';

function guessContentTypeFromKey(key: string): string {
	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	const map: Record<string, string> = {
		pdf: 'application/pdf',
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		webp: 'image/webp',
		gif: 'image/gif',
		txt: 'text/plain; charset=utf-8',
		csv: 'text/csv; charset=utf-8',
		doc: 'application/msword',
		docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		xls: 'application/vnd.ms-excel',
		xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	};
	return map[ext] ?? 'application/octet-stream';
}

function fileNameFromKey(key: string): string {
	const seg = key.split('/').pop() ?? 'file';
	const uuidPrefix = /^[0-9a-f-]{36}-/i;
	return seg.replace(uuidPrefix, '') || 'file';
}

/** R2 ReadableStream â†?Response() can 500 under SvelteKit/Miniflare; buffer modest files instead. */
const MAX_BUFFER_BYTES = 32 * 1024 * 1024;

function asciiFileName(name: string): string {
	const cleaned = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
	return cleaned.slice(0, 180) || 'file';
}

export const GET: RequestHandler = async ({ platform, url }) => {
	try {
		if (!platform?.env?.R2) {
			return new Response(
				'R2 storage is not bound in this runtime. Use `npm run dev:cf` (wrangler dev) locally, or deploy to Cloudflare with an R2 bucket binding named `R2`.',
				{
					status: 503,
					headers: { 'Content-Type': 'text/plain; charset=utf-8' }
				}
			);
		}

		const key = url.searchParams.get('key')?.trim();
		if (!key) {
			return fail('Missing key', 400);
		}

		const object = await platform.env.R2.get(key);
		if (!object) {
			return fail('File not found in R2 (key may be wrong or the object was deleted).', 404);
		}

		const headers = new Headers();
		// Do not call object.writeHttpMetadata() or read object.body before arrayBuffer():
		// R2ObjectBody follows Fetch Body semantics; touching .body first can lock the stream
		// and cause "Body has already been used" on Miniflare / Workers.
		const hm = object.httpMetadata;
		if (hm) {
			if (hm instanceof Headers) {
				hm.forEach((value, name) => {
					headers.set(name, value);
				});
			} else {
				if (hm.contentType) headers.set('Content-Type', hm.contentType);
				if (hm.contentLanguage) headers.set('Content-Language', hm.contentLanguage);
				if (hm.contentDisposition) headers.set('Content-Disposition', hm.contentDisposition);
				if (hm.contentEncoding) headers.set('Content-Encoding', hm.contentEncoding);
				if (hm.cacheControl) headers.set('Cache-Control', hm.cacheControl);
			}
		}
		if (!headers.has('Content-Type')) {
			headers.set('Content-Type', guessContentTypeFromKey(key));
		}
		const etag = object.httpEtag;
		if (etag && /^[\x21\x23-\x7E]+$/.test(etag)) {
			headers.set('etag', etag);
		}
		const dispName = asciiFileName(fileNameFromKey(key));
		const asAttachment =
			url.searchParams.get('download') === '1' || url.searchParams.get('attachment') === '1';
		headers.set(
			'Content-Disposition',
			asAttachment ? `attachment; filename="${dispName}"` : `inline; filename="${dispName}"`
		);
		headers.set('Cache-Control', 'private, max-age=300');

		const size = object.size;
		if (typeof size === 'number' && size === 0) {
			return new Response(null, { status: 204, headers });
		}

		const bufferable =
			typeof size !== 'number' || size <= MAX_BUFFER_BYTES;

		if (bufferable) {
			const buf = await object.arrayBuffer();
			return new Response(buf, { headers });
		}

		return new Response(object.body, { headers });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[api/files] R2 read error:', message);
		return fail('Failed to read file from storage', 500, message);
	}
};


/**
 * Minimal RFC 2822 / MIME parser for .eml files.
 *
 * Produces readable plain text for AI classification + field extraction:
 *   - Email metadata: From, To, Subject, Date
 *   - Body text (text/plain preferred over text/html), thread-noise stripped
 *   - Attachment manifest (names + types, no binary content) — backward-compat path
 *   - Recursive: handles multipart/*, message/rfc822, nested structures
 *
 * Works in Cloudflare Workers and browsers (no Node.js APIs).
 *
 * Two public APIs:
 *   emlToPlainText()      — sync, backward-compat, body + attachment names only
 *   parseEmlStructured()  — returns EmlAttachment[] with decoded bytes for
 *                           compose-eml-extraction.ts to score & select
 */

const MAX_RECURSION = 5;
const MAX_ATTACHMENTS = 20;
/** Cap bytes captured per attachment to avoid blowing up memory on huge PDFs. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
/** Only capture bytes for the first N binary attachments (scoring picks from these).
 *  Oversized attachments also count toward this limit so we don't keep attempting
 *  expensive decode-then-discard on every subsequent large part. */
const MAX_BYTE_ATTACHMENTS = 5;
/** Stop accumulating body text parts once we have this many characters total.
 *  Prevents deeply-nested multipart emails from building huge strings before
 *  compose-eml-extraction.ts truncates at 1000 chars. */
const MAX_BODY_CHARS = 100_000;

type HeaderMap = Map<string, string>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EmlAttachment {
	filename: string;
	mimeType: string;
	/** Decoded binary bytes — only populated for PDF / image / DOCX parts
	 *  up to MAX_ATTACHMENT_BYTES. Undefined for text attachments or when the
	 *  part is too large. */
	bytes?: Uint8Array;
}

export interface EmlParseResult {
	subject: string;
	from: string;
	to: string;
	date: string;
	bodyText: string;
	attachments: string[]; // backward-compat: "filename (mime/type)"
}

export interface EmlStructuredResult {
	subject: string;
	from: string;
	to: string;
	date: string;
	/** Cleaned body text with quoted reply chains stripped. */
	bodyText: string;
	attachments: EmlAttachment[];
}

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

function splitHeadersAndBody(raw: string): [headers: string, body: string] {
	const crlfIdx = raw.indexOf('\r\n\r\n');
	if (crlfIdx >= 0) return [raw.slice(0, crlfIdx), raw.slice(crlfIdx + 4)];
	const lfIdx = raw.indexOf('\n\n');
	if (lfIdx >= 0) return [raw.slice(0, lfIdx), raw.slice(lfIdx + 2)];
	return [raw, ''];
}

function unfoldHeaders(block: string): string {
	return block.replace(/\r?\n[ \t]+/g, ' ');
}

function parseHeaderBlock(block: string): HeaderMap {
	const map: HeaderMap = new Map();
	for (const line of unfoldHeaders(block).split(/\r?\n/)) {
		const colon = line.indexOf(':');
		if (colon < 1) continue;
		const name = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();
		if (!map.has(name)) map.set(name, value);
	}
	return map;
}

interface ParsedContentType {
	type: string;
	params: Map<string, string>;
}

function parseContentType(raw: string): ParsedContentType {
	const parts = raw.split(';').map((s) => s.trim());
	const type = (parts[0] || 'text/plain').toLowerCase();
	const params = new Map<string, string>();
	for (let i = 1; i < parts.length; i++) {
		const eq = parts[i].indexOf('=');
		if (eq < 0) continue;
		const k = parts[i].slice(0, eq).trim().toLowerCase();
		let v = parts[i].slice(eq + 1).trim();
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			v = v.slice(1, -1);
		}
		params.set(k, v);
	}
	return { type, params };
}

// ---------------------------------------------------------------------------
// Content decoding
// ---------------------------------------------------------------------------

function decodeQPToBytes(input: string): Uint8Array {
	const joined = input.replace(/=\r?\n/g, '');
	const bytes: number[] = [];
	let i = 0;
	while (i < joined.length) {
		if (joined[i] === '=' && i + 2 < joined.length) {
			const code = parseInt(joined.slice(i + 1, i + 3), 16);
			if (!isNaN(code)) {
				bytes.push(code);
				i += 3;
				continue;
			}
		}
		bytes.push(joined.charCodeAt(i) & 0xff);
		i++;
	}
	return new Uint8Array(bytes);
}

function decodeQP(input: string, charset = 'utf-8'): string {
	return new TextDecoder(charset, { fatal: false }).decode(decodeQPToBytes(input));
}

function decodeBase64Text(b64: string, charset = 'utf-8'): string {
	try {
		const binary = atob(b64.replace(/\s/g, ''));
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder(charset, { fatal: false }).decode(bytes);
	} catch {
		return b64;
	}
}

/**
 * Estimate decoded byte size from the encoded representation.
 * Used to skip decoding before allocating memory.
 *   base64:           decoded ≈ stripped_length × 0.75
 *   quoted-printable: conservative upper bound = raw length (usually smaller)
 *   7bit/8bit:        1 byte per char
 */
function estimateDecodedBytes(body: string, cte: string): number {
	if (cte === 'base64') {
		return Math.ceil(body.replace(/\s/g, '').length * 0.75);
	}
	return body.length;
}

/** Decode a MIME part body to raw bytes (for binary attachments). */
function decodeBinaryPart(body: string, cte: string): Uint8Array {
	if (cte === 'base64') {
		try {
			const binary = atob(body.replace(/\s/g, ''));
			return Uint8Array.from(binary, (c) => c.charCodeAt(0));
		} catch {
			return new Uint8Array(0);
		}
	}
	if (cte === 'quoted-printable') {
		return decodeQPToBytes(body);
	}
	return Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff);
}

function decodeEncodedWord(word: string): string {
	const m = /^=\?([^?]+)\?([BQbq])\?([^?]*)\?=$/.exec(word);
	if (!m) return word;
	const [, charset, enc, text] = m;
	try {
		if (enc.toLowerCase() === 'b') {
			return decodeBase64Text(text, charset);
		}
		if (enc.toLowerCase() === 'q') {
			return decodeQP(text.replace(/_/g, ' '), charset);
		}
	} catch {
		// fall through
	}
	return word;
}

function decodeHeaderValue(value: string): string {
	return value.replace(/=\?[^?]+\?[BQbq]\?[^?]*\?=/g, (m) => decodeEncodedWord(m));
}

function stripHtml(html: string): string {
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/\r?\n\s*\r?\n\s*\r?\n/g, '\n\n')
		.trim();
}

// ---------------------------------------------------------------------------
// Thread / quoted-reply stripping
// ---------------------------------------------------------------------------

/**
 * Remove quoted reply chains from a decoded email body.
 *
 * Strips:
 *  - Lines starting with ">" (inline quoted text)
 *  - "On [date], [name] wrote:" blocks (Gmail / Apple Mail style)
 *  - "-----Original Message-----" / "---------- Forwarded message ---------"
 *  - Long underscore separators (Outlook forward/reply dividers)
 *
 * Everything after the first thread marker is discarded — we only need
 * the most-recent reply, which carries the actionable financial context.
 */
export function stripQuotedReplies(text: string): string {
	const lines = text.split('\n');
	const result: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Hard stop: common thread / forward separator lines
		if (
			/^-{4,}\s*(original message|forwarded message)\s*[-]*/i.test(trimmed) ||
			/^_{8,}\s*$/.test(trimmed)
		) break;

		// Hard stop: "On [date/name] ... wrote:" — check this + next 3 lines
		// to handle wrapped long lines.
		if (/^on\s+\S/i.test(trimmed)) {
			const lookahead = lines.slice(i, i + 4).join(' ');
			if (/\bwrote:\s*$/i.test(lookahead)) break;
		}

		// Skip "> " quoted lines but keep going (inline quotes mid-body).
		if (trimmed.startsWith('>')) continue;

		result.push(line);
	}

	return result.join('\n').trim();
}

// ---------------------------------------------------------------------------
// MIME tree walking
// ---------------------------------------------------------------------------

function getAttachmentName(headers: HeaderMap): string | null {
	for (const h of ['content-disposition', 'content-type']) {
		const val = headers.get(h) || '';
		const m = /(?:filename\*?|name)=(?:"([^"]+)"|([^\s;]+))/i.exec(val);
		if (m) return (m[1] || m[2] || '').trim() || null;
	}
	return null;
}

/** MIME types we can attempt to extract text from (PDF, images, DOCX).
 *  Also handles application/octet-stream when the filename extension
 *  reveals the true type — common for Outlook-attached PDFs.
 *  Only known image subtypes are matched — Outlook embeds decorative objects
 *  with non-standard types like "image/outlook-bizsafe en" that we cannot
 *  extract and should not count against the byte-attachment slot limit. */
function isExtractableMime(mime: string, filename?: string): boolean {
	if (mime === 'application/pdf') return true;
	if (/^image\/(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(mime)) return true;
	if (
		mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
		mime === 'application/msword'
	) return true;
	if (mime === 'application/octet-stream' && filename) {
		const lower = filename.toLowerCase();
		return lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc');
	}
	return false;
}

/**
 * True for Outlook-generated inline decoration attachments (logos, social icons,
 * certification badges). These are structural email decoration embedded via CID
 * and should not consume byte-attachment decode slots.
 */
function isDecorationAttachment(filename: string, headers: HeaderMap): boolean {
	if (/^Outlook-[A-Za-z0-9]/i.test(filename)) return true;
	// Inline CID parts without an explicit attachment disposition are embedded
	// decorations (email signatures, banners). Real attachments declare
	// content-disposition: attachment.
	const cd = (headers.get('content-disposition') || '').toLowerCase().trim();
	const hasCid = headers.has('content-id');
	if (hasCid && (!cd || cd.startsWith('inline'))) return true;
	return false;
}

/** Internal context threaded through recursive calls. */
interface WalkContext {
	textParts: string[];
	attachments: EmlAttachment[];
	byteAttachmentCount: number;
}

function walkPart(raw: string, depth: number, ctx: WalkContext): void {
	if (depth > MAX_RECURSION) return;

	const [headerBlock, body] = splitHeadersAndBody(raw);
	const headers = parseHeaderBlock(headerBlock);
	const ctRaw = headers.get('content-type') || 'text/plain';
	const { type, params } = parseContentType(ctRaw);
	const cte = (headers.get('content-transfer-encoding') || '7bit').toLowerCase().trim();
	const charset = params.get('charset') || 'utf-8';

	// Multipart: recurse into sub-parts
	if (type.startsWith('multipart/')) {
		const boundary = params.get('boundary');
		if (!boundary) return;
		const subParts = splitMultipartBody(body, boundary);

		// multipart/alternative: prefer text/plain over text/html
		if (type === 'multipart/alternative') {
			const subCtx: WalkContext = { textParts: [], attachments: ctx.attachments, byteAttachmentCount: ctx.byteAttachmentCount };
			let plainText = '';
			let htmlText = '';
			for (const part of subParts) {
				const [ph] = splitHeadersAndBody(part);
				const { type: pt } = parseContentType(parseHeaderBlock(ph).get('content-type') || '');
				const partCtx: WalkContext = { textParts: [], attachments: ctx.attachments, byteAttachmentCount: ctx.byteAttachmentCount };
				walkPart(part, depth + 1, partCtx);
				ctx.byteAttachmentCount = partCtx.byteAttachmentCount;
				if (pt === 'text/plain') plainText = partCtx.textParts.join('\n\n');
				else if (pt === 'text/html') htmlText = partCtx.textParts.join('\n\n');
			}
			const chosen = plainText || htmlText;
			if (chosen) ctx.textParts.push(chosen);
			void subCtx;
			return;
		}

		for (const part of subParts) {
			const partCtx: WalkContext = { textParts: [], attachments: ctx.attachments, byteAttachmentCount: ctx.byteAttachmentCount };
			walkPart(part, depth + 1, partCtx);
			ctx.byteAttachmentCount = partCtx.byteAttachmentCount;
			if (partCtx.textParts.length > 0) ctx.textParts.push(...partCtx.textParts);
		}
		return;
	}

	// Nested RFC 2822 message
	if (type === 'message/rfc822') {
		walkPart(body, depth + 1, ctx);
		return;
	}

	// Binary / non-text attachment
	if (!type.startsWith('text/')) {
		if (ctx.attachments.length < MAX_ATTACHMENTS) {
			const filename = getAttachmentName(headers) ?? `[${type.split('/')[1] ?? 'file'}]`;
			let bytes: Uint8Array | undefined;
			const decoration = isDecorationAttachment(filename, headers);
			if (!decoration && isExtractableMime(type, filename) && ctx.byteAttachmentCount < MAX_BYTE_ATTACHMENTS) {
				// Always consume one slot — prevents repeated decode attempts on
				// oversized attachments when MAX_BYTE_ATTACHMENTS > 1.
				ctx.byteAttachmentCount++;
				const estimated = estimateDecodedBytes(body, cte);
				if (estimated <= MAX_ATTACHMENT_BYTES) {
					// Only decode once we know it fits.
					const decoded = decodeBinaryPart(body, cte);
					if (decoded.byteLength > 0) bytes = decoded;
				}
			}
			// Decoration attachments are still listed (the routing LLM needs the
			// full filename manifest) but carry no bytes — they won't be extracted.
			ctx.attachments.push({ filename, mimeType: type, bytes });
		}
		return;
	}

	// Text attachment (Content-Disposition: attachment for .txt etc.)
	const cd = (headers.get('content-disposition') || '').toLowerCase();
	if (cd.startsWith('attachment')) {
		if (ctx.attachments.length < MAX_ATTACHMENTS) {
			const filename = getAttachmentName(headers) ?? `[text/${type.split('/')[1]}]`;
			ctx.attachments.push({ filename, mimeType: type });
		}
		return;
	}

	// Inline text content — decode and collect
	let text: string;
	if (cte === 'base64') {
		text = decodeBase64Text(body, charset);
	} else if (cte === 'quoted-printable') {
		text = decodeQP(body, charset);
	} else {
		try {
			const bytes = Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff);
			text = new TextDecoder(charset, { fatal: false }).decode(bytes);
		} catch {
			text = body;
		}
	}

	const decoded = type === 'text/html' ? stripHtml(text) : text.trim();
	if (decoded) {
		// Enforce body char budget: stop accumulating once we have enough context.
		const accumulated = ctx.textParts.reduce((n, p) => n + p.length, 0);
		if (accumulated < MAX_BODY_CHARS) {
			const remaining = MAX_BODY_CHARS - accumulated;
			ctx.textParts.push(decoded.length > remaining ? decoded.slice(0, remaining) : decoded);
		}
	}
}

/**
 * Split a multipart MIME body into raw part strings.
 * Lines before the first boundary delimiter (preamble) are discarded.
 */
function splitMultipartBody(body: string, boundary: string): string[] {
	const delim = '--' + boundary;
	const terminator = delim + '--';
	const parts: string[] = [];
	let current: string[] | null = null;

	for (const rawLine of body.split(/\r?\n/)) {
		const line = rawLine.trimEnd();
		if (line === terminator) {
			if (current !== null) parts.push(current.join('\n'));
			break;
		}
		if (line === delim) {
			if (current !== null) parts.push(current.join('\n'));
			current = [];
			continue;
		}
		if (current !== null) current.push(rawLine);
	}
	return parts;
}

// ---------------------------------------------------------------------------
// Public parsers
// ---------------------------------------------------------------------------

/**
 * Structured parse: returns EmlAttachment[] with decoded bytes.
 * Used by compose-eml-extraction.ts to score and select relevant attachments.
 * Body text has quoted reply chains stripped.
 */
export function parseEmlStructured(rawText: string): EmlStructuredResult {
	const [headerBlock] = splitHeadersAndBody(rawText);
	const headers = parseHeaderBlock(headerBlock);

	const subject = decodeHeaderValue(headers.get('subject') || '');
	const from = decodeHeaderValue(headers.get('from') || '');
	const to = decodeHeaderValue(headers.get('to') || '');
	const date = headers.get('date') || '';

	const ctx: WalkContext = { textParts: [], attachments: [], byteAttachmentCount: 0 };
	walkPart(rawText, 0, ctx);

	const rawBody = ctx.textParts.join('\n\n');
	const bodyText = stripQuotedReplies(rawBody);

	return { subject, from, to, date, bodyText, attachments: ctx.attachments };
}

/**
 * Backward-compatible parse: returns string[] attachment names.
 * Body text has quoted reply chains stripped.
 */
export function parseEml(rawText: string): EmlParseResult {
	const structured = parseEmlStructured(rawText);
	return {
		subject: structured.subject,
		from: structured.from,
		to: structured.to,
		date: structured.date,
		bodyText: structured.bodyText,
		attachments: structured.attachments.map((a) => `${a.filename} (${a.mimeType})`)
	};
}

/**
 * Convert raw EML bytes to plain text for AI extraction.
 * Sync, backward-compatible. Body thread-noise is stripped.
 * Does NOT extract attachment content — use composeEmlText() for that.
 *
 * Output format:
 *   From: sender@example.com
 *   To: recipient@example.com
 *   Subject: Invoice INV-001
 *   Date: ...
 *
 *   [body text]
 *
 *   Attachments:
 *   - INV-001.pdf (application/pdf)
 */
export function emlToPlainText(rawBytes: Uint8Array): string {
	const raw = new TextDecoder('utf-8', { fatal: false }).decode(rawBytes);
	const { subject, from, to, date, bodyText, attachments } = parseEml(raw);

	const lines: string[] = [];
	if (from) lines.push(`From: ${from}`);
	if (to) lines.push(`To: ${to}`);
	if (subject) lines.push(`Subject: ${subject}`);
	if (date) lines.push(`Date: ${date}`);
	if (lines.length) lines.push('');
	if (bodyText) lines.push(bodyText);
	if (attachments.length > 0) {
		lines.push('');
		lines.push('Attachments:');
		for (const att of attachments) lines.push(`- ${att}`);
	}

	return lines.join('\n').trim();
}

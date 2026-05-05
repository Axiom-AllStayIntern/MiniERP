import type { RequestHandler } from './$types';

import { callExternalLlmJson } from '$platform/ai/ocr/external-llm-json';
import { fail, ok } from '$platform/http';

type AttachmentRow = {
	filename: string;
	mimeType: string;
	sizeBytes: number;
};

type RankPayload = {
	/** Context label for the model; optional, defaults to generic business mail */
	emailType?: string;
	attachments?: AttachmentRow[];
};

export type RankedAttachment = {
	filename: string;
	/** 0â€? */
	confidence: number;
	reason?: string;
};

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(1, Math.max(0, n));
}

function buildRankSystemPrompt(emailTypeLabel: string): string {
	return `You rank email attachments by how likely they are to be the primary business document. Use only filename, size, and MIME â€?do not invent file contents.

Email intent label: ${emailTypeLabel}

Return a single JSON object (JSON only, no markdown):
{ "ranked": [ { "filename": "x.pdf", "confidence": 0.9, "reason": "filename mentions invoice" } ] }

Rules:
- ranked is highest priority first; filenames must come from the user list only.
- confidence is a decimal from 0 to 1.
- reason: short English phrase.`;
}

function buildRankUserMessage(rows: AttachmentRow[]): string {
	const lines = rows.map((r) => {
		const size =
			r.sizeBytes < 1024
				? `${r.sizeBytes} B`
				: r.sizeBytes < 1024 * 1024
					? `${(r.sizeBytes / 1024).toFixed(1)} KB`
					: `${(r.sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
		return `${r.filename} | ${size} | ${r.mimeType || 'application/octet-stream'}`;
	});
	return lines.join('\n');
}

function scoreRow(r: AttachmentRow): { confidence: number; reason: string } {
	const n = `${r.filename} ${r.mimeType}`.toLowerCase();
	const hits: string[] = [];
	if (/invoice|bill|tax/.test(n)) hits.push('invoice/tax');
	if (/\.pdf$/i.test(r.filename)) hits.push('pdf');
	if (/po|purchase/.test(n)) hits.push('po');
	if (/quote|quotation/.test(n)) hits.push('quote');
	if (/contract/.test(n)) hits.push('contract');
	let c = 0.35;
	if (hits.length) c += Math.min(0.45, hits.length * 0.12);
	if (/\.(pdf|xlsx?|docx?)$/i.test(r.filename)) c += 0.08;
	return { confidence: clamp01(c), reason: hits.length ? hits.join(', ') : 'generic attachment' };
}

function heuristicRank(rows: AttachmentRow[]): RankedAttachment[] {
	const scored = rows.map((r) => {
		const { confidence, reason } = scoreRow(r);
		return { filename: r.filename, confidence, reason };
	});
	scored.sort((a, b) => b.confidence - a.confidence);
	return scored;
}

function parseRankRows(arr: unknown[], allowed: Set<string>): RankedAttachment[] {
	const out: RankedAttachment[] = [];
	for (const item of arr) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const row = item as Record<string, unknown>;
		if (typeof row.filename !== 'string' || !row.filename.trim()) continue;
		const fn = row.filename.trim();
		if (!allowed.has(fn)) continue;
		let confidence = 0.5;
		if (typeof row.confidence === 'number' && Number.isFinite(row.confidence)) confidence = clamp01(row.confidence);
		else if (typeof row.confidence === 'string') {
			const n = Number.parseFloat(row.confidence.trim());
			if (Number.isFinite(n)) confidence = clamp01(n);
		}
		const reason = typeof row.reason === 'string' ? row.reason.slice(0, 200) : undefined;
		out.push({ filename: fn, confidence, reason });
	}
	return out;
}

function parseRankModelJson(parsed: unknown, allowed: Set<string>): RankedAttachment[] | null {
	if (Array.isArray(parsed)) {
		const out = parseRankRows(parsed, allowed);
		return out.length ? out : null;
	}
	if (!parsed || typeof parsed !== 'object') return null;
	const o = parsed as Record<string, unknown>;
	if (!Array.isArray(o.ranked)) return null;
	const out = parseRankRows(o.ranked, allowed);
	return out.length ? out : null;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const payload = (await request.json()) as RankPayload;
	const emailTypeLabel = (payload.emailType?.trim() || 'business-related').slice(0, 80);
	const rows = Array.isArray(payload.attachments)
		? payload.attachments
				.filter(
					(a): a is AttachmentRow =>
						a != null &&
						typeof a === 'object' &&
						typeof (a as AttachmentRow).filename === 'string' &&
						(a as AttachmentRow).filename.trim().length > 0
				)
				.map((a) => ({
					filename: a.filename.trim(),
					mimeType: typeof a.mimeType === 'string' ? a.mimeType : 'application/octet-stream',
					sizeBytes: typeof a.sizeBytes === 'number' && Number.isFinite(a.sizeBytes) ? Math.max(0, a.sizeBytes) : 0
				}))
		: [];

	if (!rows.length) {
		return ok({ provider: 'heuristic', result: { ranked: [] as RankedAttachment[] } });
	}

	const allowed = new Set(rows.map((r) => r.filename));
	const user = buildRankUserMessage(rows);
	const external = await callExternalLlmJson(platform.env, buildRankSystemPrompt(emailTypeLabel), user);
	const parsed = parseRankModelJson(external, allowed);
	if (parsed) {
		return ok({ provider: 'external_api', result: { ranked: parsed } });
	}

	return ok({ provider: 'heuristic', result: { ranked: heuristicRank(rows) } });
};


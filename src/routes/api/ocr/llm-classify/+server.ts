import type { RequestHandler } from './$types';

import { classifyDocType, normalizeDocTypeHint } from '$platform/ai/ocr/classify';
import { fail, ok } from '$platform/http';

type ClassifyPayload = {
	text?: string;
	/** Filename or UI guess; model may override. */
	hintDocType?: string;
};

/**
 * Thin HTTP wrapper around {@link classifyDocType}. Kept for backwards
 * compatibility with any external callers; new server code should call
 * `classifyDocType` directly.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const payload = (await request.json()) as ClassifyPayload;
	const text = payload.text?.trim() ?? '';
	if (!text) return fail('Text is required', 400);

	const hint = normalizeDocTypeHint(payload.hintDocType);
	const outcome = await classifyDocType(text, hint, platform.env);

	return ok({ provider: outcome.provider, result: outcome.result });
};


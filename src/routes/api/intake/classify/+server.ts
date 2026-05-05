import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { runIntakePipeline } from '$modules/document-intake/workflows/intake-pipeline/pipeline';

/**
 * Thin HTTP entrypoint â€?delegates all work to the document-intake
 * pipeline module. See `$modules/document-intake/workflows/intake-pipeline/pipeline.ts`.
 */

type Payload = {
	rawText?: string;
	fileName?: string;
	hintDocType?: string;
};

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);

	const payload = (await event.request.json()) as Payload;
	const rawText = payload.rawText?.trim() ?? '';
	if (!rawText) return fail('rawText is required', 400);
	if (rawText.length < 20) {
		return fail('rawText too short â€?need at least 20 chars of meaningful content', 400);
	}

	const result = await runIntakePipeline(event, {
		rawText,
		hintDocType: payload.hintDocType
	});
	return ok(result);
};


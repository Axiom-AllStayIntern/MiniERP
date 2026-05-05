import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { runReclassifyPipeline } from '$modules/document-intake/workflows/intake-pipeline/pipeline';
import type { Bucket } from '$modules/document-intake/schemas/intake-field-specs';

/**
 * Thin HTTP entrypoint â€?used by ReviewStep's "Re-check" button. Skips
 * the upstream classifier since the user has already committed to a
 * bucket + kind; just re-runs extract + match + narration under that
 * forced assumption.
 */

type Payload = {
	rawText?: string;
	bucket?: Bucket;
	kind?: string;
};

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);

	const payload = (await event.request.json()) as Payload;
	const rawText = payload.rawText?.trim() ?? '';
	if (!rawText || rawText.length < 20) return fail('rawText too short', 400);
	if (!payload.bucket) return fail('bucket is required', 400);
	if (!payload.kind) return fail('kind is required', 400);

	const result = await runReclassifyPipeline(event, {
		rawText,
		bucket: payload.bucket,
		kind: payload.kind
	});
	return ok(result);
};


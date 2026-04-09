import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const [invoice] = await db
		.select()
		.from(schema.invoicesIn)
		.where(eq(schema.invoicesIn.id, params.id))
		.limit(1);

	if (!invoice) {
		return fail('OCR entity not found', 404);
	}

	return ok({
		id: invoice.id,
		status: invoice.status,
		confidence: invoice.ocrConfidence,
		result: invoice.rawOcr ? JSON.parse(invoice.rawOcr) : null
	});
};

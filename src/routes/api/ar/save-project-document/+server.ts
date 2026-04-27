import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '../../../../modules/finance';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	let body: Record<string, unknown>;
	try {
		body = (await event.request.json()) as Record<string, unknown>;
	} catch {
		return fail('Invalid JSON request body', 400);
	}

	try {
		const ctx = await createModuleContext(event);
		const { documents } = createFinanceApi(ctx);
		const result = await documents.saveProjectDocument(body);

		if (!result.ok) {
			return fail(result.message, result.status, result.details);
		}

		return ok(result.data, result.status);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};


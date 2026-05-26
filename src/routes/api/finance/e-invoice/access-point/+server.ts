import type { RequestEvent } from '@sveltejs/kit';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '$modules/finance';
import { fail, ok } from '$platform/http';

export const GET = async (event: RequestEvent) => {
	const { platform } = event;
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const ctx = await createModuleContext(event);
	const { einvoice } = createFinanceApi(ctx);
	const result = await einvoice.getAccessPointStatus();

	return ok(result);
};

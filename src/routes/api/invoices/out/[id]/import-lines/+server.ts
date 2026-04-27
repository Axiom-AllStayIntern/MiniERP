import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createFinanceApi } from '../../../../../../modules/finance';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { billing } = createFinanceApi(ctx);
		const result = await billing.importContractLinesToCustomerInvoice(event.params.id);
		if (!result) {
			return fail('Invoice not found', 404);
		}

		return ok(result);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '../../../../../../modules/finance';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { billing } = createFinanceApi(ctx);
		const invoice = await billing.getCustomerInvoicePreview(event.params.id);
		if (!invoice) {
			return fail('Invoice not found', 404);
		}

		return ok(invoice);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};


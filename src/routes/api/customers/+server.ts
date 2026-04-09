import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createBusinessPartnerApi } from '$lib/server/modules/business-partner/api';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const bp = createBusinessPartnerApi(ctx);
		const customers = await bp.listCustomers();
		return ok(customers);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const bp = createBusinessPartnerApi(ctx);

		const body = (await event.request.json()) as {
			name?: string;
			address?: string;
			contact?: string;
			gstRegNo?: string;
			metadata?: unknown;
		};

		if (!body.name) {
			return fail('Missing required field: name');
		}

		const result = await bp.createCustomer({
			name: body.name,
			address: body.address,
			contact: body.contact,
			gstRegNo: body.gstRegNo,
			metadata: body.metadata ? JSON.stringify(body.metadata) : undefined
		});

		return ok({ id: result.id }, 201);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

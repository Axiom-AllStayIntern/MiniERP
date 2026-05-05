import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createBusinessPartnerApi } from '$modules/legacy/server-modules/business-partner/api';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const bp = createBusinessPartnerApi(ctx);
		const suppliers = await bp.listSuppliers();
		return ok(suppliers);
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
			itemDescription?: string;
			dateCreate?: string;
			projectRelated?: string;
			gstRegNo?: string;
			contacts?: Array<{
				name?: string;
				phoneEmail?: string;
				wechat?: string;
				position?: string;
			}>;
			metadata?: unknown;
		};

		if (!body.name) {
			return fail('Missing required field: name');
		}

		const result = await bp.createSupplier({
			name: body.name,
			address: body.address,
			contact: body.contact,
			itemDescription: body.itemDescription,
			dateCreate: body.dateCreate,
			projectRelated: body.projectRelated,
			gstRegNo: body.gstRegNo,
			contacts: (body.contacts ?? [])
				.map((c) => ({
					name: String(c.name ?? '').trim(),
					phoneEmail: String(c.phoneEmail ?? '').trim() || undefined,
					wechat: String(c.wechat ?? '').trim() || undefined,
					position: String(c.position ?? '').trim() || undefined
				}))
				.filter((c) => c.name),
			metadata: body.metadata ? JSON.stringify(body.metadata) : undefined
		});

		return ok({ id: result.id }, 201);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};


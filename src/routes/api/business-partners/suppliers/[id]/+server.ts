import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { createBusinessPartnerApi } from '$modules/business-partner';
import { NotFoundError } from '$platform/modules/errors';

export const DELETE: RequestHandler = async (event) => {
	if (!event.platform) throw error(503, 'Platform unavailable');
	const { id } = event.params;
	const ctx = await createModuleContext(event);
	const bp = createBusinessPartnerApi(ctx);
	try {
		await bp.deleteById(id);
		return json({ ok: true });
	} catch (err) {
		if (err instanceof NotFoundError) throw error(404, 'Supplier not found');
		throw error(500, 'Failed to delete supplier');
	}
};

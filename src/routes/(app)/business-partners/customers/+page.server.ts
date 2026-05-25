import type { PageServerLoad, Actions } from './$types';

import { createModuleContext } from '$platform/modules';
import { createBusinessPartnerApi } from '$modules/business-partner';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) {
		return { customers: [] as { id: string; name: string; contact: string | null; address: string | null }[] };
	}

	const ctx = await createModuleContext(event);
	const businessPartner = createBusinessPartnerApi(ctx);
	return { customers: await businessPartner.listCustomerDirectory() };
};

export const actions: Actions = {
	delete: async (event) => {
		if (!event.platform) return fail(503, { error: 'Platform unavailable' });
		const data = await event.request.formData();
		const id = data.get('id');
		if (!id || typeof id !== 'string') return fail(400, { error: 'Missing id' });
		const ctx = await createModuleContext(event);
		const bp = createBusinessPartnerApi(ctx);
		await bp.deleteById(id);
		return { success: true };
	}
};


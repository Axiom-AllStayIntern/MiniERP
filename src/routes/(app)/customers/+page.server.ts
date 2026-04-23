import type { PageServerLoad } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createBusinessPartnerApi } from '$lib/server/modules/business-partner/api';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) {
		return { customers: [] as { id: string; name: string; contact: string | null; address: string | null }[] };
	}

	const ctx = await createModuleContext(event);
	const businessPartner = createBusinessPartnerApi(ctx);
	return { customers: await businessPartner.listCustomerDirectory() };
};

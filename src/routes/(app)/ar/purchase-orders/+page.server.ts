import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** @deprecated Use `/finance/doc-hub/purchase-orders` */
export const load: PageServerLoad = async ({ url }) => {
	throw redirect(308, `/finance/doc-hub/purchase-orders${url.search}`);
};


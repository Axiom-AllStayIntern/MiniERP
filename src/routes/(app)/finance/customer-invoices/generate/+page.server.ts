import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** @deprecated Use `/finance/doc-hub/customer-invoices/generate` */
export const load: PageServerLoad = async ({ url }) => {
	throw redirect(308, `/finance/doc-hub/customer-invoices/generate${url.search}`);
};


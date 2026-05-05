import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** @deprecated Use `/finance/doc-hub/quotations` */
export const load: PageServerLoad = async ({ url }) => {
	throw redirect(308, `/finance/doc-hub/quotations${url.search}`);
};


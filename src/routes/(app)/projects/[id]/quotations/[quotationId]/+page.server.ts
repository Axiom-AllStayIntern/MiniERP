import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy URL â€?canonical route is `/projects/[id]/documents/quotations/[quotationId]`. */
export const load: PageServerLoad = async ({ params, url }) => {
	throw redirect(
		308,
		`/projects/${encodeURIComponent(params.id)}/documents/quotations/${encodeURIComponent(params.quotationId)}${url.search}`
	);
};


import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy URL â€?canonical route is `/projects/[id]/documents/purchase-orders/[purchaseOrderId]`. */
export const load: PageServerLoad = async ({ params, url }) => {
	throw redirect(
		308,
		`/projects/${encodeURIComponent(params.id)}/documents/purchase-orders/${encodeURIComponent(params.purchaseOrderId)}${url.search}`
	);
};


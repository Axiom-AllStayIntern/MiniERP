import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Login UI is unified on `/` (welcome page with embedded sign-in form). */
export const load: PageServerLoad = async ({ url }) => {
	const qs = url.searchParams.toString();
	throw redirect(307, qs ? `/?${qs}` : '/');
};


import type { RequestHandler } from './$types';
import { fail } from '$platform/http';

/** @deprecated Removed per design: no approval workflow. */
export const POST: RequestHandler = async () => {
	return fail('This endpoint has been removed. No approval workflow in current design.', 410);
};


import type { RequestHandler } from './$types';
import { fail } from '$platform/http';

/** @deprecated Removed per design: no approval workflow. Reimbursement is a boolean tag. */
export const POST: RequestHandler = async () => {
	return fail('This endpoint has been removed. Reimbursement is now a boolean tag on expense records.', 410);
};


import type { RequestHandler } from './$types';
import { fail } from '$platform/http';

/** @deprecated Removed per design: record-on-save only; no draft/confirmed/void workflow. */
export const POST: RequestHandler = async () => {
	return fail('This endpoint has been removed. Expenses are recorded as-is, no status workflow.', 410);
};


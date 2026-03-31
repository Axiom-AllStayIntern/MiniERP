import type { Handle } from '@sveltejs/kit';

/**
 * Phase 1 baseline:
 * Keep a single auth entry point in hooks so better-auth can
 * be wired in without changing route handlers later.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	return resolve(event);
};

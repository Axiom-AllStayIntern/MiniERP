import { createAuthClient } from 'better-auth/svelte';

/** Same-origin requests to the SvelteKit-mounted better-auth handler. */
export const authClient = createAuthClient({
	basePath: '/api/auth'
});

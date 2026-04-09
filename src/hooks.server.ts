import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

import { isRouteAllowed } from '$lib/server/auth/permissions';
import { readSessionCookie } from '$lib/server/auth/session';
import { getDb } from '$lib/server/db';
import { getEnabledModuleIds, isPathEnabled } from '$lib/server/modules/enabled';

// Register all modules at app startup (side-effect import)
import '$lib/server/modules/register-all';

function needsAppAuth(pathname: string) {
	return (
		pathname.startsWith('/dashboard') ||
		pathname.startsWith('/ar') ||
		pathname.startsWith('/projects') ||
		pathname.startsWith('/employees') ||
		pathname.startsWith('/tax') ||
		pathname.startsWith('/reports') ||
		pathname.startsWith('/settings')
	);
}

function needsApiAuth(pathname: string) {
	return pathname.startsWith('/api/');
}

export const handle: Handle = async ({ event, resolve }) => {
	const secret =
		(event.platform?.env.BETTER_AUTH_SECRET as string | undefined) ??
		(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
			?.BETTER_AUTH_SECRET ??
		'local-dev-secret';

	event.locals.user = await readSessionCookie(event.cookies, secret);

	if (event.url.pathname === '/login' && event.locals.user) {
		throw redirect(303, '/dashboard');
	}

	if (needsAppAuth(event.url.pathname) || needsApiAuth(event.url.pathname)) {
		if (!event.locals.user) {
			if (needsApiAuth(event.url.pathname)) {
				return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
			}
			throw redirect(303, '/login');
		}

		if (!isRouteAllowed(event.url.pathname, event.locals.user.role)) {
			if (needsApiAuth(event.url.pathname)) {
				return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
			}
			throw redirect(303, '/dashboard');
		}

		if (event.platform) {
			const db = getDb(event.platform.env);
			const enabledIds = await getEnabledModuleIds(db);
			if (!isPathEnabled(event.url.pathname, enabledIds)) {
				return new Response('Not Found', { status: 404 });
			}
		}
	}

	return resolve(event);
};

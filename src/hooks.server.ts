import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

import { getAuth } from '$lib/server/auth/better-auth';
import { resolveWorkerAuthEnv } from '$lib/server/auth/resolve-worker-env';
import type { AuthRole } from '$lib/server/auth/config';
import { isRouteAllowed } from '$lib/server/auth/permissions';
import { getDb } from './infrastructure/db';
import { getEnabledModuleIds, isPathEnabled } from './platform/config';

// Register all modules at app startup (side-effect import)
import './platform/registry/register-all';

function isPublicAppPath(pathname: string) {
	return (
		pathname === '/login' ||
		pathname === '/register' ||
		pathname === '/forgot-password' ||
		pathname.startsWith('/reset-password')
	);
}

function needsAppAuth(pathname: string) {
	if (isPublicAppPath(pathname)) return false;
	return (
		pathname.startsWith('/dashboard') ||
		pathname.startsWith('/expenses') ||
		pathname.startsWith('/ar') ||
		pathname.startsWith('/finance') ||
		pathname.startsWith('/projects') ||
		pathname.startsWith('/customers') ||
		pathname.startsWith('/suppliers') ||
		pathname.startsWith('/employees') ||
		pathname.startsWith('/tax') ||
		pathname.startsWith('/reports') ||
		pathname.startsWith('/settings')
	);
}

function needsApiAuth(pathname: string) {
	return pathname.startsWith('/api/');
}

function isPublicAuthApi(pathname: string) {
	return pathname.startsWith('/api/auth');
}

export const handle: Handle = async ({ event, resolve }) => {
	if (building) {
		return resolve(event);
	}

	const env = resolveWorkerAuthEnv(event);
	if (!env) {
		console.error(
			'[auth] Missing BETTER_AUTH_SECRET (and Cloudflare bindings). For local dev: create `.dev.vars` with BETTER_AUTH_SECRET (see `.dev.vars.example`) and run `npm run dev:cf`.'
		);
		event.locals.user = null;
		return resolve(event);
	}

	const auth = getAuth(env);
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session?.user) {
		const u = session.user as { id: string; email: string; role?: string };
		event.locals.user = {
			id: u.id,
			email: u.email,
			role: (u.role as AuthRole) ?? 'employee'
		};
	} else {
		event.locals.user = null;
	}

	if (
		(event.url.pathname === '/login' || event.url.pathname === '/register') &&
		event.locals.user
	) {
		throw redirect(303, '/dashboard');
	}

	const path = event.url.pathname;
	const wantApiAuth = needsApiAuth(path);
	const wantAppAuth = needsAppAuth(path);

	if (wantAppAuth || (wantApiAuth && !isPublicAuthApi(path))) {
		if (!event.locals.user) {
			if (wantApiAuth) {
				return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
			}
			throw redirect(303, '/login');
		}

		if (!isRouteAllowed(path, event.locals.user.role)) {
			if (wantApiAuth) {
				return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
			}
			throw redirect(303, '/dashboard');
		}

		if (event.platform) {
			const db = getDb(env);
			const enabledIds = await getEnabledModuleIds(db);
			if (!isPathEnabled(path, enabledIds)) {
				return new Response('Not Found', { status: 404 });
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

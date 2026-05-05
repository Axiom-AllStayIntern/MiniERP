import type { RequestEvent } from '@sveltejs/kit';

/**
 * Cloudflare `vars` may omit BETTER_AUTH_SECRET (use Worker secrets / `.dev.vars` locally).
 * For local wrangler dev, `wrangler.jsonc` may still point BETTER_AUTH_URL at production — we
 * align auth base URL with the incoming request origin on localhost so cookies / CSRF match.
 */
export function resolveWorkerAuthEnv(event: RequestEvent): Env | null {
	const p = event.platform?.env;
	if (!p) return null;

	const secret = p.BETTER_AUTH_SECRET;
	if (!secret || typeof secret !== 'string') {
		return null;
	}

	const originNorm = event.url.origin.replace(/\/$/, '');
	const isLocalHost =
		originNorm.includes('127.0.0.1') ||
		originNorm.includes('localhost') ||
		/^https?:\/\/\[::1\]/.test(originNorm);

	const configuredRaw = p.BETTER_AUTH_URL?.trim().replace(/\/$/, '') ?? '';

	let baseURL: string;
	if (isLocalHost) {
		baseURL = originNorm;
	} else if (!configuredRaw) {
		baseURL = originNorm;
	} else {
		// `wrangler.jsonc` may still point at another workers.dev hostname; cookies / CSRF must match the browser origin.
		try {
			const reqHost = new URL(originNorm).hostname;
			const cfgUrl = configuredRaw.includes('://') ? configuredRaw : `https://${configuredRaw}`;
			const cfgHost = new URL(cfgUrl).hostname;
			baseURL = cfgHost === reqHost ? configuredRaw : originNorm;
		} catch {
			baseURL = originNorm;
		}
	}

	if (!baseURL) {
		return null;
	}

	return { ...p, BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: baseURL };
}

/**
 * Transactional email via Resend HTTP API (Cloudflare Workers–compatible).
 * Set RESEND_API_KEY + EMAIL_FROM in production; without them, verification URLs are logged only (local dev).
 *
 * On Workers, outbound fetch must be tied to `ExecutionContext.waitUntil` or awaited before the
 * response is returned; otherwise the isolate may end and Resend never receives the request.
 */
import { getRequestEvent } from '$app/server';

export type TransactionalEmail = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

function firstUrlInText(text: string): string | null {
	const m = text.match(/https?:\/\/[^\s<>"']+/);
	return m ? m[0] : null;
}

export async function sendTransactionalEmail(env: Env, msg: TransactionalEmail): Promise<void> {
	const run = async (): Promise<void> => {
		const key = env.RESEND_API_KEY;
		const from = env.EMAIL_FROM;
		if (!key || !from) {
			const link = firstUrlInText(msg.text) ?? firstUrlInText(msg.html);
			console.warn(
				'[email] No mail sent: set RESEND_API_KEY and EMAIL_FROM in `.dev.vars` (local) or Worker secrets + vars, then restart wrangler.'
			);
			if (link) {
				console.warn('[email] Open this link manually to continue (e.g. verify email / reset password):\n', link);
			} else {
				console.warn('[email] Body (no URL parsed):\n', msg.text);
			}
			return;
		}

		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${key}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from,
				to: [msg.to],
				subject: msg.subject,
				text: msg.text,
				html: msg.html
			})
		});

		const raw = await res.text();
		if (!res.ok) {
			console.error('[email] Resend HTTP', res.status, raw);
			return;
		}
		try {
			const j = JSON.parse(raw) as { id?: string };
			console.log('[email] Resend accepted', j.id ?? raw);
		} catch {
			console.log('[email] Resend accepted', raw);
		}
	};

	try {
		const event = getRequestEvent();
		const ctx = event.platform?.ctx;
		if (ctx?.waitUntil) {
			ctx.waitUntil(run());
			return;
		}
	} catch {
		// getRequestEvent() only valid during a SvelteKit request
	}
	await run();
}

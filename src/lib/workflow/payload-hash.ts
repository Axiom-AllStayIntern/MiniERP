/**
 * Stable payload hash for confirmation guards.
 *
 * Both client (`ConfirmStep.svelte`) and server (`/api/finance/workflow/[id]/confirm`)
 * compute the hash over the same canonicalized JSON. The client sends the hash
 * alongside the payload; the server recomputes and verifies they match. A
 * mismatch means the payload changed in transit or the client lost UI/state
 * sync — either way the workflow refuses the write.
 *
 * Web Crypto's `crypto.subtle` is available in both the browser and Cloudflare
 * Workers, so this single helper works in both contexts.
 */

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(obj).sort()) {
			out[key] = canonicalize(obj[key]);
		}
		return out;
	}
	return value;
}

function bytesToHex(bytes: ArrayBuffer): string {
	const view = new Uint8Array(bytes);
	let out = '';
	for (const byte of view) out += byte.toString(16).padStart(2, '0');
	return out;
}

export async function hashConfirmationPayload(payload: unknown): Promise<string> {
	const serialized = JSON.stringify(canonicalize(payload));
	const encoded = new TextEncoder().encode(serialized);
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	return bytesToHex(digest);
}

import { json } from '@sveltejs/kit';

export function ok<T>(data: T, status = 200) {
	return json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
	return json({ ok: false, error: message, details }, { status });
}

import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';

export const PUT: RequestHandler = async ({ request, platform, url }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const key = url.searchParams.get('key');
	if (!key) {
		return fail('Missing upload key', 400);
	}

	const payload = await request.arrayBuffer();
	if (payload.byteLength === 0) {
		return fail('Empty upload payload', 400);
	}

	const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
	await platform.env.R2.put(key, payload, {
		httpMetadata: { contentType }
	});

	return ok({ key, uploaded: true });
};

export const POST: RequestHandler = async ({ request, url, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const key = url.searchParams.get('key') ?? '';
	if (!key) {
		return fail('Missing required query param: key');
	}

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) {
		return fail('Missing required form field: file');
	}

	await platform.env.R2.put(key, await file.arrayBuffer(), {
		httpMetadata: {
			contentType: file.type || 'application/octet-stream'
		}
	});

	return ok(
		{
			key,
			fileName: file.name,
			contentType: file.type || 'application/octet-stream',
			size: file.size
		},
		201
	);
};


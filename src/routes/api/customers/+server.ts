import { desc, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const db = getDb(platform.env);
	const customers = await db
		.select()
		.from(schema.customers)
		.where(isNull(schema.customers.deletedAt))
		.orderBy(desc(schema.customers.createdAt));

	return ok(customers);
};

export const POST: RequestHandler = async ({ platform, request }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		name?: string;
		address?: string;
		contact?: string;
		gstRegNo?: string;
		metadata?: unknown;
	};

	if (!body.name) {
		return fail('Missing required field: name');
	}

	const id = crypto.randomUUID();
	const db = getDb(platform.env);
	await db.insert(schema.customers).values({
		id,
		name: body.name,
		address: body.address,
		contact: body.contact,
		gstRegNo: body.gstRegNo,
		metadata: body.metadata ? JSON.stringify(body.metadata) : null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	});

	return ok({ id }, 201);
};

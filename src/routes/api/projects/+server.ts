import { and, desc, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const customerId = url.searchParams.get('customer_id');
	const status = url.searchParams.get('status');
	const db = getDb(platform.env);
	const query = db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)).$dynamic();
	const whereClauses = [isNull(schema.projects.deletedAt)];

	if (customerId) {
		whereClauses.push(eq(schema.projects.customerId, customerId));
	}
	if (status) {
		whereClauses.push(eq(schema.projects.status, status));
	}

	const projects = await query.where(and(...whereClauses));

	return ok(projects);
};

export const POST: RequestHandler = async ({ platform, request }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		customerId?: string;
		name?: string;
		status?: string;
		description?: string;
		startDate?: string;
		endDate?: string;
	};

	if (!body.customerId || !body.name) {
		return fail('Missing required fields: customerId, name');
	}

	const db = getDb(platform.env);
	const id = crypto.randomUUID();
	await db.insert(schema.projects).values({
		id,
		customerId: body.customerId,
		name: body.name,
		status: body.status ?? 'active',
		description: body.description,
		startDate: body.startDate,
		endDate: body.endDate,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	});

	return ok({ id }, 201);
};

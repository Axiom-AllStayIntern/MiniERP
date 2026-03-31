import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform) {
		return {
			projects: [],
			customers: [],
			filters: {
				status: '',
				customerId: ''
			}
		};
	}

	const db = getDb(platform.env);
	const status = url.searchParams.get('status') ?? '';
	const customerId = url.searchParams.get('customer_id') ?? '';

	const conditions = [isNull(schema.projects.deletedAt)];
	if (status) conditions.push(eq(schema.projects.status, status));
	if (customerId) conditions.push(eq(schema.projects.customerId, customerId));

	const projects = await db
		.select()
		.from(schema.projects)
		.where(and(...conditions))
		.orderBy(desc(schema.projects.updatedAt));

	const customerIds = [...new Set(projects.map((project) => project.customerId))];
	const customers =
		customerIds.length > 0
			? await db
					.select()
					.from(schema.customers)
					.where(and(inArray(schema.customers.id, customerIds), isNull(schema.customers.deletedAt)))
			: [];

	const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));

	return {
		projects: projects.map((project) => ({
			...project,
			customerName: customerMap.get(project.customerId) ?? project.customerId
		})),
		customers: await db
			.select({ id: schema.customers.id, name: schema.customers.name })
			.from(schema.customers)
			.where(isNull(schema.customers.deletedAt))
			.orderBy(desc(schema.customers.createdAt)),
		filters: {
			status,
			customerId
		}
	};
};

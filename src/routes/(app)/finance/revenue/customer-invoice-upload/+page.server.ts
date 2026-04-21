import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';

export const load: PageServerLoad = async ({ platform, url }) => {
	const projectIdParam = url.searchParams.get('projectId')?.trim() ?? '';

	let preselectedProject: {
		id: string;
		name: string;
		customerName: string | null;
		status: string;
		startDate: string | null;
		endDate: string | null;
	} | null = null;

	if (platform && projectIdParam) {
		const db = getDb(platform.env);
		const [row] = await db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				status: schema.projects.status,
				startDate: schema.projects.startDate,
				endDate: schema.projects.endDate,
				customerId: schema.projects.customerId
			})
			.from(schema.projects)
			.where(and(eq(schema.projects.id, projectIdParam), isNull(schema.projects.deletedAt)))
			.limit(1);

		if (row) {
			const [customer] = await db
				.select({ name: schema.customers.name })
				.from(schema.customers)
				.where(eq(schema.customers.id, row.customerId))
				.limit(1);
			preselectedProject = {
				id: row.id,
				name: row.name,
				customerName: customer?.name ?? null,
				status: row.status,
				startDate: row.startDate,
				endDate: row.endDate
			};
		}
	}

	return { preselectedProject };
};

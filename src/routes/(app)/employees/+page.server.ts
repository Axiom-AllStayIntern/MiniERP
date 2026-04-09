import { desc, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform) {
		return { employees: [] };
	}

	const db = getDb(platform.env);
	const employees = await db
		.select()
		.from(schema.employees)
		.where(isNull(schema.employees.deletedAt))
		.orderBy(desc(schema.employees.updatedAt));

	return { employees };
};

import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { businessPartners, projects } from '../../../infrastructure/db/schema';

export interface ProjectLookupAdapter<TProject = unknown> {
	getProjectById(projectId: string): Promise<TProject | null>;
}

export function createProjectLookupAdapter<TProject>(
	getProjectById: (projectId: string) => Promise<TProject | null>
): ProjectLookupAdapter<TProject> {
	return { getProjectById };
}

export type FinanceProjectLookupRow = {
	id: string;
	name: string;
	customerName: string | null;
	status: string;
	startDate: string | null;
	endDate: string | null;
};

export async function findFinanceProjectLookup(
	db: DBClient,
	projectId: string
): Promise<FinanceProjectLookupRow | null> {
	const [row] = await db
		.select({
			id: projects.id,
			name: projects.name,
			status: projects.status,
			startDate: projects.startDate,
			endDate: projects.endDate,
			customerName: businessPartners.name
		})
		.from(projects)
		.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
		.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
		.limit(1);

	return row ?? null;
}

export async function listFinanceProjectNames(
	db: DBClient,
	projectIds: string[]
): Promise<Map<string, string | null>> {
	if (projectIds.length === 0) return new Map();

	const rows = await db
		.select({
			id: projects.id,
			name: projects.name
		})
		.from(projects)
		.where(and(inArray(projects.id, projectIds), isNull(projects.deletedAt)));

	return new Map(rows.map((row) => [row.id, row.name]));
}

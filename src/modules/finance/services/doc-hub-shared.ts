import {
	and,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	like,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { businessPartners, projects } from '../../../infrastructure/db/schema';

export const DOC_HUB_PROJECT_PAGE_SIZE = 5;

export type ProjectFilterInput = {
	projectId: string;
	q: string;
	status: string;
	startedAfter: string;
	page: number;
};

export type DocHubProjectWithStats = {
	id: string;
	name: string;
	customerName: string | null;
	status: string;
	startDate: string | null;
	endDate: string | null;
	[key: string]: string | number | null;
};

export function textParam(params: URLSearchParams, key: string, fallback = ''): string {
	return params.get(key)?.trim() ?? fallback;
}

export function positivePage(params: URLSearchParams): number {
	const pageRaw = Number.parseInt(params.get('page') ?? '1', 10);
	return Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
}

export function parseProjectFilters(params: URLSearchParams): ProjectFilterInput {
	return {
		projectId: params.get('projectId') ?? '',
		q: textParam(params, 'q'),
		status: textParam(params, 'status'),
		startedAfter: textParam(params, 'startedAfter'),
		page: positivePage(params)
	};
}

export function fileViewUrl(fileUrl: string | null): string | null {
	return fileUrl && !fileUrl.startsWith('manual://')
		? `/api/files?key=${encodeURIComponent(fileUrl)}`
		: null;
}

export function tryParseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export async function getDocHubProjectPicker(
	db: DBClient,
	input: ProjectFilterInput,
	countRows: Array<{ projectId: string | null; total: number }>,
	itemProjectIds: Array<string | null>,
	statKey: string
) {
	const projectConditions: SQL[] = [isNull(projects.deletedAt)];
	if (input.q) {
		projectConditions.push(
			or(
				like(projects.name, `%${input.q}%`),
				like(projects.id, `%${input.q}%`),
				like(businessPartners.name, `%${input.q}%`)
			)!
		);
	}
	if (input.status) projectConditions.push(eq(projects.status, input.status));
	if (input.startedAfter) projectConditions.push(gte(projects.startDate, input.startedAfter));

	const projectCountRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(projects)
		.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
		.where(and(...projectConditions));
	const total = Number(projectCountRows[0]?.total ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / DOC_HUB_PROJECT_PAGE_SIZE));
	const safePage = Math.min(input.page, totalPages);
	const safeOffset = (safePage - 1) * DOC_HUB_PROJECT_PAGE_SIZE;

	const projectRows = await db
		.select({
			id: projects.id,
			name: projects.name,
			customerName: businessPartners.name,
			status: projects.status,
			startDate: projects.startDate,
			endDate: projects.endDate
		})
		.from(projects)
		.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
		.where(and(...projectConditions))
		.orderBy(desc(projects.startDate), desc(projects.updatedAt))
		.limit(DOC_HUB_PROJECT_PAGE_SIZE)
		.offset(safeOffset);

	const countMap = new Map(countRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
	const projectsWithStats: DocHubProjectWithStats[] = projectRows.map((project) => ({
		...project,
		[statKey]: countMap.get(project.id) ?? 0
	}));

	const fallbackProjectIds = Array.from(
		new Set(
			itemProjectIds.filter(
				(id): id is string => Boolean(id) && !projectsWithStats.some((project) => project.id === id)
			)
		)
	);
	const fallbackProjects =
		fallbackProjectIds.length > 0
			? await db
					.select({ id: projects.id, name: projects.name })
					.from(projects)
					.where(inArray(projects.id, fallbackProjectIds))
			: [];
	const projectMap = new Map([
		...projectsWithStats.map((project) => [project.id, project.name] as const),
		...fallbackProjects.map((project) => [project.id, project.name] as const)
	]);

	let selectedProject: DocHubProjectWithStats | null =
		projectsWithStats.find((project) => project.id === input.projectId) ?? null;
	if (!selectedProject && input.projectId) {
		const [fallbackProject] = await db
			.select({
				id: projects.id,
				name: projects.name,
				customerName: businessPartners.name,
				status: projects.status,
				startDate: projects.startDate,
				endDate: projects.endDate
			})
			.from(projects)
			.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
			.where(and(isNull(projects.deletedAt), eq(projects.id, input.projectId)))
			.limit(1);
		if (fallbackProject) {
			selectedProject = {
				...fallbackProject,
				[statKey]: countMap.get(fallbackProject.id) ?? 0
			};
		}
	}

	return {
		projectsWithStats,
		selectedProject,
		projectMap,
		filters: {
			projectId: input.projectId,
			q: input.q,
			status: input.status,
			startedAfter: input.startedAfter,
			page: safePage
		},
		pagination: {
			page: safePage,
			pageSize: DOC_HUB_PROJECT_PAGE_SIZE,
			total,
			totalPages,
			hasPrev: safePage > 1,
			hasNext: safePage < totalPages
		}
	};
}

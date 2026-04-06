import { and, desc, eq, gte, inArray, isNull, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/db';
import { parseDocumentMetadata } from '$lib/server/document-metadata';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform) {
		return {
			quotations: [],
			projects: [],
			selectedProject: null,
			filters: {
				projectId: '',
				q: '',
				status: '',
				startedAfter: '',
				page: 1,
				quotationQ: '',
				listMode: 'all',
				quotationField: 'all'
			},
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const db = getDb(platform.env);
	const projectId = url.searchParams.get('projectId') ?? '';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status')?.trim() ?? '';
	const startedAfter = url.searchParams.get('startedAfter')?.trim() ?? '';
	const quotationQ = url.searchParams.get('quotationQ')?.trim() ?? '';
	const listModeRaw = url.searchParams.get('listMode')?.trim() ?? 'all';
	const quotationFieldRaw = url.searchParams.get('quotationField')?.trim() ?? 'all';
	const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
	const quotationField =
		quotationFieldRaw === 'id' ||
		quotationFieldRaw === 'amount' ||
		quotationFieldRaw === 'date' ||
		quotationFieldRaw === 'notes' ||
		quotationFieldRaw === 'source' ||
		quotationFieldRaw === 'all'
			? quotationFieldRaw
			: 'all';

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = 5;

	const quotationConditions = [isNull(schema.quotations.deletedAt)];
	if (listMode === 'selected') {
		if (projectId) {
			quotationConditions.push(eq(schema.quotations.projectId, projectId));
		} else {
			quotationConditions.push(sql`1 = 0`);
		}
	}
	if (quotationQ) {
		if (quotationField === 'id') {
			quotationConditions.push(like(schema.quotations.id, `%${quotationQ}%`));
		} else if (quotationField === 'amount') {
			quotationConditions.push(
				like(sql`cast(coalesce(${schema.quotations.amount}, 0) as text)`, `%${quotationQ}%`)
			);
		} else if (quotationField === 'date') {
			quotationConditions.push(like(schema.quotations.date, `%${quotationQ}%`));
		} else if (quotationField === 'notes') {
			quotationConditions.push(like(sql`coalesce(${schema.quotations.metadata}, '')`, `%${quotationQ}%`));
		} else if (quotationField === 'source') {
			quotationConditions.push(like(sql`coalesce(${schema.quotations.sourceType}, '')`, `%${quotationQ}%`));
		} else {
			quotationConditions.push(
				or(
					like(schema.quotations.id, `%${quotationQ}%`),
					like(sql`cast(coalesce(${schema.quotations.amount}, 0) as text)`, `%${quotationQ}%`),
					like(schema.quotations.date, `%${quotationQ}%`),
					like(sql`coalesce(${schema.quotations.sourceType}, '')`, `%${quotationQ}%`),
					like(sql`coalesce(${schema.quotations.metadata}, '')`, `%${quotationQ}%`)
				)!
			);
		}
	}

	const quotations = await db
		.select()
		.from(schema.quotations)
		.where(and(...quotationConditions))
		.orderBy(desc(schema.quotations.date), desc(schema.quotations.createdAt));

	const projectConditions = [isNull(schema.projects.deletedAt)];
	if (q) {
		projectConditions.push(
			or(
				like(schema.projects.name, `%${q}%`),
				like(schema.projects.id, `%${q}%`),
				like(schema.customers.name, `%${q}%`)
			)!
		);
	}
	if (status) {
		projectConditions.push(eq(schema.projects.status, status));
	}
	if (startedAfter) {
		projectConditions.push(gte(schema.projects.startDate, startedAfter));
	}

	const projectCountRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(schema.projects)
		.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
		.where(and(...projectConditions));
	const total = Number(projectCountRows[0]?.total ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(page, totalPages);
	const safeOffset = (safePage - 1) * pageSize;

	const projects = await db
		.select({
			id: schema.projects.id,
			name: schema.projects.name,
			customerName: schema.customers.name,
			status: schema.projects.status,
			startDate: schema.projects.startDate,
			endDate: schema.projects.endDate
		})
		.from(schema.projects)
		.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
		.where(and(...projectConditions))
		.orderBy(desc(schema.projects.startDate), desc(schema.projects.updatedAt))
		.limit(pageSize)
		.offset(safeOffset);

	const quotationCountRows = await db
		.select({
			projectId: schema.quotations.projectId,
			total: sql<number>`count(*)`
		})
		.from(schema.quotations)
		.where(isNull(schema.quotations.deletedAt))
		.groupBy(schema.quotations.projectId);
	const quotationCountMap = new Map(
		quotationCountRows.map((row) => [row.projectId, Number(row.total ?? 0)])
	);

	const projectsWithStats = projects.map((project) => ({
		...project,
		quotationCount: quotationCountMap.get(project.id) ?? 0
	}));

	const fallbackProjectIds = Array.from(
		new Set(
			quotations
				.map((item) => item.projectId)
				.filter((id) => !projectsWithStats.some((project) => project.id === id))
		)
	);
	const fallbackProjects =
		fallbackProjectIds.length > 0
			? await db
					.select({ id: schema.projects.id, name: schema.projects.name })
					.from(schema.projects)
					.where(inArray(schema.projects.id, fallbackProjectIds))
			: [];
	const projectMap = new Map([
		...projectsWithStats.map((project) => [project.id, project.name] as const),
		...fallbackProjects.map((project) => [project.id, project.name] as const)
	]);

	let selectedProject = projectsWithStats.find((project) => project.id === projectId) ?? null;
	if (!selectedProject && projectId) {
		const [fallbackProject] = await db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				customerName: schema.customers.name,
				status: schema.projects.status,
				startDate: schema.projects.startDate,
				endDate: schema.projects.endDate
			})
			.from(schema.projects)
			.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
			.where(and(isNull(schema.projects.deletedAt), eq(schema.projects.id, projectId)))
			.limit(1);
		if (fallbackProject) {
			selectedProject = {
				...fallbackProject,
				quotationCount: quotationCountMap.get(fallbackProject.id) ?? 0
			};
		}
	}

	return {
		quotations: quotations.map((item) => ({
			...item,
			projectName: projectMap.get(item.projectId) ?? item.projectId,
			fileViewUrl:
				item.fileUrl && !item.fileUrl.startsWith('manual://')
					? `/api/files?key=${encodeURIComponent(item.fileUrl)}`
					: null,
			docMeta: parseDocumentMetadata(item.metadata)
		})),
		projects: projectsWithStats,
		selectedProject,
		filters: {
			projectId,
			q,
			status,
			startedAfter,
			page: safePage,
			quotationQ,
			listMode,
			quotationField
		},
		pagination: {
			page: safePage,
			pageSize,
			total,
			totalPages,
			hasPrev: safePage > 1,
			hasNext: safePage < totalPages
		}
	};
};

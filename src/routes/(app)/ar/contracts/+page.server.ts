import { and, desc, eq, gte, inArray, isNull, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { parseDocumentMetadata } from '$lib/server/document-metadata';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform) {
		return {
			contracts: [],
			projects: [],
			selectedProject: null,
			filters: {
				projectId: '',
				q: '',
				status: '',
				startedAfter: '',
				page: 1,
				contractQ: '',
				listMode: 'all',
				contractField: 'all'
			},
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const db = getDb(platform.env);
	const projectId = url.searchParams.get('projectId') ?? '';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status')?.trim() ?? '';
	const startedAfter = url.searchParams.get('startedAfter')?.trim() ?? '';
	const contractQ = url.searchParams.get('contractQ')?.trim() ?? '';
	const listModeRaw = url.searchParams.get('listMode')?.trim() ?? 'all';
	const contractFieldRaw = url.searchParams.get('contractField')?.trim() ?? 'all';
	const listMode =
		listModeRaw === 'all' || listModeRaw === 'unassigned' || listModeRaw === 'selected'
			? listModeRaw
			: 'all';
	const contractField =
		contractFieldRaw === 'id' ||
		contractFieldRaw === 'amount' ||
		contractFieldRaw === 'date' ||
		contractFieldRaw === 'notes' ||
		contractFieldRaw === 'all'
			? contractFieldRaw
			: 'all';
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = 5;
	const hasProjectFilters = Boolean(q || status || startedAfter);

	const contractConditions = [isNull(schema.contracts.deletedAt)];
	if (listMode === 'selected') {
		if (projectId) {
			contractConditions.push(eq(schema.contracts.projectId, projectId));
		} else {
			contractConditions.push(sql`1 = 0`);
		}
	} else if (listMode === 'unassigned') {
		contractConditions.push(isNull(schema.contracts.projectId));
	}
	if (contractQ) {
		if (contractField === 'id') {
			contractConditions.push(like(schema.contracts.id, `%${contractQ}%`));
		} else if (contractField === 'amount') {
			contractConditions.push(like(sql`cast(coalesce(${schema.contracts.amount}, 0) as text)`, `%${contractQ}%`));
		} else if (contractField === 'date') {
			contractConditions.push(like(schema.contracts.date, `%${contractQ}%`));
		} else if (contractField === 'notes') {
			contractConditions.push(like(sql`coalesce(${schema.contracts.metadata}, '')`, `%${contractQ}%`));
		} else {
			contractConditions.push(
				or(
					like(schema.contracts.id, `%${contractQ}%`),
					like(sql`cast(coalesce(${schema.contracts.amount}, 0) as text)`, `%${contractQ}%`),
					like(schema.contracts.date, `%${contractQ}%`),
					like(sql`coalesce(${schema.contracts.metadata}, '')`, `%${contractQ}%`)
				)!
			);
		}
	}
	const contracts = await db
		.select()
		.from(schema.contracts)
		.where(and(...contractConditions))
		.orderBy(desc(schema.contracts.date), desc(schema.contracts.createdAt));

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
		.offset(hasProjectFilters ? safeOffset : safeOffset);

	const contractCountRows = await db
		.select({
			projectId: schema.contracts.projectId,
			total: sql<number>`count(*)`
		})
		.from(schema.contracts)
		.where(isNull(schema.contracts.deletedAt))
		.groupBy(schema.contracts.projectId);
	const contractCountMap = new Map(contractCountRows.map((row) => [row.projectId, Number(row.total ?? 0)]));

	const projectsWithStats = projects.map((project) => ({
		...project,
		contractCount: contractCountMap.get(project.id) ?? 0
	}));
	const fallbackProjectIds = Array.from(
		new Set(
			contracts
				.map((item) => item.projectId)
				.filter((id): id is string => Boolean(id) && !projectsWithStats.some((project) => project.id === id))
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
				contractCount: contractCountMap.get(fallbackProject.id) ?? 0
			};
		}
	}

	return {
		contracts: contracts.map((item) => ({
			...item,
			projectName: item.projectId ? projectMap.get(item.projectId) ?? item.projectId : 'Unassigned Contract',
			fileViewUrl:
				item.fileUrl && !item.fileUrl.startsWith('manual://')
					? `/api/files?key=${encodeURIComponent(item.fileUrl)}`
					: null,
			docMeta: parseDocumentMetadata(item.metadata)
		})),
		projects: projectsWithStats,
		selectedProject,
		filters: { projectId, q, status, startedAfter, page: safePage, contractQ, listMode, contractField },
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

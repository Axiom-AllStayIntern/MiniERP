import { and, desc, eq, gte, inArray, isNull, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { parseDocumentMetadata } from '$lib/server/document-metadata';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform) {
		return {
			purchaseOrders: [],
			projects: [],
			selectedProject: null,
			filters: {
				projectId: '',
				q: '',
				status: '',
				startedAfter: '',
				page: 1,
				poQ: '',
				listMode: 'all',
				poField: 'all'
			},
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const db = getDb(platform.env);
	const projectId = url.searchParams.get('projectId') ?? '';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status')?.trim() ?? '';
	const startedAfter = url.searchParams.get('startedAfter')?.trim() ?? '';
	const poQ = url.searchParams.get('poQ')?.trim() ?? '';
	const listModeRaw = url.searchParams.get('listMode')?.trim() ?? 'all';
	const poFieldRaw = url.searchParams.get('poField')?.trim() ?? 'all';
	const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
	const poField =
		poFieldRaw === 'id' ||
		poFieldRaw === 'poNumber' ||
		poFieldRaw === 'supplier' ||
		poFieldRaw === 'amount' ||
		poFieldRaw === 'date' ||
		poFieldRaw === 'notes' ||
		poFieldRaw === 'all'
			? poFieldRaw
			: 'all';

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = 5;

	const poConditions = [isNull(schema.purchaseOrders.deletedAt)];
	if (listMode === 'selected') {
		if (projectId) {
			poConditions.push(eq(schema.purchaseOrders.projectId, projectId));
		} else {
			poConditions.push(sql`1 = 0`);
		}
	}
	if (poQ) {
		if (poField === 'id') {
			poConditions.push(like(schema.purchaseOrders.id, `%${poQ}%`));
		} else if (poField === 'poNumber') {
			poConditions.push(like(schema.purchaseOrders.poNumber, `%${poQ}%`));
		} else if (poField === 'supplier') {
			poConditions.push(like(sql`coalesce(${schema.purchaseOrders.supplierName}, '')`, `%${poQ}%`));
		} else if (poField === 'amount') {
			poConditions.push(like(sql`cast(coalesce(${schema.purchaseOrders.amount}, 0) as text)`, `%${poQ}%`));
		} else if (poField === 'date') {
			poConditions.push(like(sql`coalesce(${schema.purchaseOrders.date}, '')`, `%${poQ}%`));
		} else if (poField === 'notes') {
			poConditions.push(like(sql`coalesce(${schema.purchaseOrders.metadata}, '')`, `%${poQ}%`));
		} else {
			poConditions.push(
				or(
					like(schema.purchaseOrders.id, `%${poQ}%`),
					like(schema.purchaseOrders.poNumber, `%${poQ}%`),
					like(sql`coalesce(${schema.purchaseOrders.supplierName}, '')`, `%${poQ}%`),
					like(sql`cast(coalesce(${schema.purchaseOrders.amount}, 0) as text)`, `%${poQ}%`),
					like(sql`coalesce(${schema.purchaseOrders.date}, '')`, `%${poQ}%`),
					like(sql`coalesce(${schema.purchaseOrders.metadata}, '')`, `%${poQ}%`)
				)!
			);
		}
	}

	const purchaseOrders = await db
		.select()
		.from(schema.purchaseOrders)
		.where(and(...poConditions))
		.orderBy(desc(schema.purchaseOrders.date), desc(schema.purchaseOrders.createdAt));

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
	if (status) projectConditions.push(eq(schema.projects.status, status));
	if (startedAfter) projectConditions.push(gte(schema.projects.startDate, startedAfter));

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

	const poCountRows = await db
		.select({ projectId: schema.purchaseOrders.projectId, total: sql<number>`count(*)` })
		.from(schema.purchaseOrders)
		.where(isNull(schema.purchaseOrders.deletedAt))
		.groupBy(schema.purchaseOrders.projectId);
	const poCountMap = new Map(poCountRows.map((row) => [row.projectId, Number(row.total ?? 0)]));

	const projectsWithStats = projects.map((project) => ({
		...project,
		poCount: poCountMap.get(project.id) ?? 0
	}));

	const fallbackProjectIds = Array.from(
		new Set(
			purchaseOrders
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
				poCount: poCountMap.get(fallbackProject.id) ?? 0
			};
		}
	}

	return {
		purchaseOrders: purchaseOrders.map((item) => ({
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
			poQ,
			listMode,
			poField
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

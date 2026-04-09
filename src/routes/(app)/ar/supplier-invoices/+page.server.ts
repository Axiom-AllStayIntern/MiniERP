import { and, desc, eq, gte, inArray, isNull, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform) {
		return {
			invoices: [],
			projects: [],
			selectedProject: null,
			filters: {
				projectId: '',
				q: '',
				status: '',
				startedAfter: '',
				page: 1,
				supplierQ: '',
				listMode: 'all',
				supplierField: 'all'
			},
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const db = getDb(platform.env);
	const projectId = url.searchParams.get('projectId') ?? '';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status')?.trim() ?? '';
	const startedAfter = url.searchParams.get('startedAfter')?.trim() ?? '';
	const supplierQ = url.searchParams.get('supplierQ')?.trim() ?? '';
	const listModeRaw = url.searchParams.get('listMode')?.trim() ?? 'all';
	const supplierFieldRaw = url.searchParams.get('supplierField')?.trim() ?? 'all';
	const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
	const supplierField =
		supplierFieldRaw === 'id' ||
		supplierFieldRaw === 'supplier' ||
		supplierFieldRaw === 'amount' ||
		supplierFieldRaw === 'date' ||
		supplierFieldRaw === 'status' ||
		supplierFieldRaw === 'poNumber' ||
		supplierFieldRaw === 'all'
			? supplierFieldRaw
			: 'all';

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = 5;

	const invoiceConditions = [isNull(schema.invoicesIn.deletedAt)];
	if (listMode === 'selected') {
		if (projectId) invoiceConditions.push(eq(schema.invoicesIn.projectId, projectId));
		else invoiceConditions.push(sql`1 = 0`);
	}
	if (supplierQ) {
		if (supplierField === 'id') {
			invoiceConditions.push(like(schema.invoicesIn.id, `%${supplierQ}%`));
		} else if (supplierField === 'supplier') {
			invoiceConditions.push(like(sql`coalesce(${schema.invoicesIn.supplierName}, '')`, `%${supplierQ}%`));
		} else if (supplierField === 'amount') {
			invoiceConditions.push(like(sql`cast(coalesce(${schema.invoicesIn.amount}, 0) as text)`, `%${supplierQ}%`));
		} else if (supplierField === 'date') {
			invoiceConditions.push(like(sql`coalesce(${schema.invoicesIn.invoiceDate}, '')`, `%${supplierQ}%`));
		} else if (supplierField === 'status') {
			invoiceConditions.push(like(schema.invoicesIn.status, `%${supplierQ}%`));
		} else if (supplierField === 'poNumber') {
			invoiceConditions.push(like(sql`coalesce(${schema.invoicesIn.poNumber}, '')`, `%${supplierQ}%`));
		} else {
			invoiceConditions.push(
				or(
					like(schema.invoicesIn.id, `%${supplierQ}%`),
					like(sql`coalesce(${schema.invoicesIn.supplierName}, '')`, `%${supplierQ}%`),
					like(sql`cast(coalesce(${schema.invoicesIn.amount}, 0) as text)`, `%${supplierQ}%`),
					like(sql`coalesce(${schema.invoicesIn.invoiceDate}, '')`, `%${supplierQ}%`),
					like(schema.invoicesIn.status, `%${supplierQ}%`),
					like(sql`coalesce(${schema.invoicesIn.poNumber}, '')`, `%${supplierQ}%`)
				)!
			);
		}
	}

	const invoiceRows = await db
		.select()
		.from(schema.invoicesIn)
		.where(and(...invoiceConditions))
		.orderBy(desc(schema.invoicesIn.invoiceDate), desc(schema.invoicesIn.createdAt));

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

	const supplierInvoiceCountRows = await db
		.select({ projectId: schema.invoicesIn.projectId, total: sql<number>`count(*)` })
		.from(schema.invoicesIn)
		.where(isNull(schema.invoicesIn.deletedAt))
		.groupBy(schema.invoicesIn.projectId);
	const supplierInvoiceCountMap = new Map(
		supplierInvoiceCountRows.map((row) => [row.projectId, Number(row.total ?? 0)])
	);

	const projectsWithStats = projects.map((project) => ({
		...project,
		supplierInvoiceCount: supplierInvoiceCountMap.get(project.id) ?? 0
	}));

	const fallbackProjectIds = Array.from(
		new Set(
			invoiceRows
				.map((row) => row.projectId)
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
				supplierInvoiceCount: supplierInvoiceCountMap.get(fallbackProject.id) ?? 0
			};
		}
	}

	return {
		invoices: invoiceRows.map((item) => ({
			...item,
			projectName: projectMap.get(item.projectId) ?? item.projectId,
			rawParsed: item.rawOcr ? tryParseJson(item.rawOcr) : null
		})),
		projects: projectsWithStats,
		selectedProject,
		filters: {
			projectId,
			q,
			status,
			startedAfter,
			page: safePage,
			supplierQ,
			listMode,
			supplierField
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

function tryParseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

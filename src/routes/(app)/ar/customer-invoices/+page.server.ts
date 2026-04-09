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
				invoiceQ: '',
				listMode: 'all',
				invoiceField: 'all'
			},
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const db = getDb(platform.env);
	const projectId = url.searchParams.get('projectId') ?? '';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status')?.trim() ?? '';
	const startedAfter = url.searchParams.get('startedAfter')?.trim() ?? '';
	const invoiceQ = url.searchParams.get('invoiceQ')?.trim() ?? '';
	const listModeRaw = url.searchParams.get('listMode')?.trim() ?? 'all';
	const invoiceFieldRaw = url.searchParams.get('invoiceField')?.trim() ?? 'all';
	const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
	const invoiceField =
		invoiceFieldRaw === 'invoiceNo' ||
		invoiceFieldRaw === 'total' ||
		invoiceFieldRaw === 'date' ||
		invoiceFieldRaw === 'status' ||
		invoiceFieldRaw === 'customer' ||
		invoiceFieldRaw === 'id' ||
		invoiceFieldRaw === 'all'
			? invoiceFieldRaw
			: 'all';

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = 5;

	const invoiceConditions = [isNull(schema.invoicesOut.deletedAt)];
	if (listMode === 'selected') {
		if (projectId) invoiceConditions.push(eq(schema.invoicesOut.projectId, projectId));
		else invoiceConditions.push(sql`1 = 0`);
	}
	if (invoiceQ) {
		if (invoiceField === 'invoiceNo') {
			invoiceConditions.push(like(schema.invoicesOut.invoiceNo, `%${invoiceQ}%`));
		} else if (invoiceField === 'total') {
			invoiceConditions.push(like(sql`cast(coalesce(${schema.invoicesOut.total}, 0) as text)`, `%${invoiceQ}%`));
		} else if (invoiceField === 'date') {
			invoiceConditions.push(like(schema.invoicesOut.date, `%${invoiceQ}%`));
		} else if (invoiceField === 'status') {
			invoiceConditions.push(like(schema.invoicesOut.status, `%${invoiceQ}%`));
		} else if (invoiceField === 'customer') {
			invoiceConditions.push(like(sql`coalesce(${schema.customers.name}, '')`, `%${invoiceQ}%`));
		} else if (invoiceField === 'id') {
			invoiceConditions.push(like(schema.invoicesOut.id, `%${invoiceQ}%`));
		} else {
			invoiceConditions.push(
				or(
					like(schema.invoicesOut.id, `%${invoiceQ}%`),
					like(schema.invoicesOut.invoiceNo, `%${invoiceQ}%`),
					like(sql`cast(coalesce(${schema.invoicesOut.total}, 0) as text)`, `%${invoiceQ}%`),
					like(schema.invoicesOut.date, `%${invoiceQ}%`),
					like(schema.invoicesOut.status, `%${invoiceQ}%`),
					like(sql`coalesce(${schema.customers.name}, '')`, `%${invoiceQ}%`)
				)!
			);
		}
	}

	const invoiceRows = await db
		.select({
			id: schema.invoicesOut.id,
			projectId: schema.invoicesOut.projectId,
			customerId: schema.invoicesOut.customerId,
			invoiceNo: schema.invoicesOut.invoiceNo,
			date: schema.invoicesOut.date,
			dueDate: schema.invoicesOut.dueDate,
			currency: schema.invoicesOut.currency,
			subtotal: schema.invoicesOut.subtotal,
			gstType: schema.invoicesOut.gstType,
			gstAmount: schema.invoicesOut.gstAmount,
			total: schema.invoicesOut.total,
			status: schema.invoicesOut.status,
			lineItems: schema.invoicesOut.lineItems,
			pdfUrl: schema.invoicesOut.pdfUrl,
			createdAt: schema.invoicesOut.createdAt,
			updatedAt: schema.invoicesOut.updatedAt,
			customerName: schema.customers.name
		})
		.from(schema.invoicesOut)
		.leftJoin(schema.customers, eq(schema.invoicesOut.customerId, schema.customers.id))
		.where(and(...invoiceConditions))
		.orderBy(desc(schema.invoicesOut.date), desc(schema.invoicesOut.createdAt));

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

	const invoiceCountRows = await db
		.select({ projectId: schema.invoicesOut.projectId, total: sql<number>`count(*)` })
		.from(schema.invoicesOut)
		.where(isNull(schema.invoicesOut.deletedAt))
		.groupBy(schema.invoicesOut.projectId);
	const invoiceCountMap = new Map(invoiceCountRows.map((row) => [row.projectId, Number(row.total ?? 0)]));

	const projectsWithStats = projects.map((project) => ({
		...project,
		invoiceCount: invoiceCountMap.get(project.id) ?? 0
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
				invoiceCount: invoiceCountMap.get(fallbackProject.id) ?? 0
			};
		}
	}

	return {
		invoices: invoiceRows.map((row) => ({
			...row,
			projectName: projectMap.get(row.projectId) ?? row.projectId
		})),
		projects: projectsWithStats,
		selectedProject,
		filters: {
			projectId,
			q,
			status,
			startedAfter,
			page: safePage,
			invoiceQ,
			listMode,
			invoiceField
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

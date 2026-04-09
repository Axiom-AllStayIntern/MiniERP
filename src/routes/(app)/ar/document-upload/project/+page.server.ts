import { and, desc, eq, gte, isNull, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform) {
		return {
			projects: [],
			selectedProject: null,
			filters: { projectId: '', q: '', status: '', startedAfter: '', page: 1, docType: 'contract' },
			pagination: { page: 1, pageSize: 5, total: 0, totalPages: 1, hasPrev: false, hasNext: false }
		};
	}

	const db = getDb(platform.env);
	const projectId = url.searchParams.get('projectId') ?? '';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status')?.trim() ?? '';
	const startedAfter = url.searchParams.get('startedAfter')?.trim() ?? '';
	const docType = url.searchParams.get('docType')?.trim() || 'contract';
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = 5;

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

	const countRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(schema.projects)
		.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
		.where(and(...projectConditions));
	const total = Number(countRows[0]?.total ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(page, totalPages);
	const offset = (safePage - 1) * pageSize;

	const projects = await db
		.select({
			id: schema.projects.id,
			name: schema.projects.name,
			status: schema.projects.status,
			startDate: schema.projects.startDate,
			endDate: schema.projects.endDate,
			customerName: schema.customers.name
		})
		.from(schema.projects)
		.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
		.where(and(...projectConditions))
		.orderBy(desc(schema.projects.startDate), desc(schema.projects.updatedAt))
		.limit(pageSize)
		.offset(offset);

	let selectedProject = projects.find((item) => item.id === projectId) ?? null;
	if (!selectedProject && projectId) {
		const [fallback] = await db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				status: schema.projects.status,
				startDate: schema.projects.startDate,
				endDate: schema.projects.endDate,
				customerName: schema.customers.name
			})
			.from(schema.projects)
			.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
			.where(and(isNull(schema.projects.deletedAt), eq(schema.projects.id, projectId)))
			.limit(1);
		selectedProject = fallback ?? null;
	}

	return {
		projects,
		selectedProject,
		filters: { projectId, q, status, startedAfter, page: safePage, docType },
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

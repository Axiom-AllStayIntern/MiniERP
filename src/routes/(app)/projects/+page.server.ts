import { and, desc, eq, gte, isNull, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform) {
		return {
			projects: [],
			projectListCounts: { all: 0, active: 0 },
			filters: {
				q: '',
				status: '',
				startedAfter: '',
				page: 1
			},
			pagination: {
				page: 1,
				pageSize: PAGE_SIZE,
				total: 0,
				totalPages: 1,
				hasPrev: false,
				hasNext: false
			}
		};
	}

	const db = getDb(platform.env);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status')?.trim() ?? '';
	const startedAfter = url.searchParams.get('startedAfter')?.trim() ?? '';
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const projectConditions = [isNull(schema.projects.deletedAt)];
	if (q) {
		projectConditions.push(
			or(
				like(schema.projects.name, `%${q}%`),
				like(schema.projects.id, `%${q}%`),
				like(sql`coalesce(${schema.customers.name}, '')`, `%${q}%`)
			)!
		);
	}
	if (status) projectConditions.push(eq(schema.projects.status, status));
	if (startedAfter) projectConditions.push(gte(schema.projects.startDate, startedAfter));

	const [[allProjectsCountRow], [activeProjectsCountRow], projectCountRows] = await Promise.all([
		db.select({ n: sql<number>`count(*)` }).from(schema.projects).where(isNull(schema.projects.deletedAt)),
		db
			.select({ n: sql<number>`count(*)` })
			.from(schema.projects)
			.where(and(isNull(schema.projects.deletedAt), eq(schema.projects.status, 'active'))),
		db
			.select({ total: sql<number>`count(*)` })
			.from(schema.projects)
			.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
			.where(and(...projectConditions))
	]);

	const total = Number(projectCountRows[0]?.total ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const safeOffset = (safePage - 1) * PAGE_SIZE;

	const projectRows = await db
		.select({
			id: schema.projects.id,
			name: schema.projects.name,
			customerId: schema.projects.customerId,
			status: schema.projects.status,
			startDate: schema.projects.startDate,
			endDate: schema.projects.endDate,
			updatedAt: schema.projects.updatedAt,
			customerName: schema.customers.name
		})
		.from(schema.projects)
		.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
		.where(and(...projectConditions))
		.orderBy(desc(schema.projects.updatedAt))
		.limit(PAGE_SIZE)
		.offset(safeOffset);

	const invoiceCountRows = await db
		.select({ projectId: schema.invoicesOut.projectId, total: sql<number>`count(*)` })
		.from(schema.invoicesOut)
		.where(isNull(schema.invoicesOut.deletedAt))
		.groupBy(schema.invoicesOut.projectId);
	const invoiceCountMap = new Map(invoiceCountRows.map((row) => [row.projectId, Number(row.total ?? 0)]));

	const projects = projectRows.map((row) => ({
		...row,
		customerName: row.customerName ?? row.customerId,
		invoiceCount: invoiceCountMap.get(row.id) ?? 0
	}));

	return {
		projects,
		projectListCounts: {
			all: Number(allProjectsCountRow?.n ?? 0),
			active: Number(activeProjectsCountRow?.n ?? 0)
		},
		filters: {
			q,
			status,
			startedAfter,
			page: safePage
		},
		pagination: {
			page: safePage,
			pageSize: PAGE_SIZE,
			total,
			totalPages,
			hasPrev: safePage > 1,
			hasNext: safePage < totalPages
		}
	};
};

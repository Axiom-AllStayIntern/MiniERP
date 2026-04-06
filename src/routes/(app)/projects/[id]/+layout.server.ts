import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import {
	activityVariantForAction,
	parseAuditMetadata,
	summarizeAuditForProject
} from '$lib/server/audit-display';
import { getDb, schema } from '$lib/server/db';

function fileLabelFromUrl(fileUrl: string | null, fallbackDate: string | null): string {
	if (!fileUrl || fileUrl.startsWith('manual://')) {
		return fallbackDate ? `Record · ${fallbackDate}` : 'Manual entry';
	}
	const tail = fileUrl.split('/').pop() ?? fileUrl;
	try {
		return decodeURIComponent(tail) || 'Document';
	} catch {
		return tail;
	}
}

export const load: LayoutServerLoad = async ({ params, platform }) => {
	if (!platform) {
		throw error(500, 'Cloudflare platform bindings are required');
	}

	const db = getDb(platform.env);
	const [project] = await db
		.select()
		.from(schema.projects)
		.where(and(eq(schema.projects.id, params.id), isNull(schema.projects.deletedAt)))
		.limit(1);

	if (!project) {
		throw error(404, 'Project not found');
	}

	const [customer] = await db
		.select({ id: schema.customers.id, name: schema.customers.name })
		.from(schema.customers)
		.where(eq(schema.customers.id, project.customerId))
		.limit(1);

	const [[allProjectsCountRow], [activeProjectsCountRow], [contractsCountRow], [quotationsCountRow], [purchaseOrdersCountRow], [expensesCountRow]] =
		await Promise.all([
			db.select({ n: sql<number>`count(*)` }).from(schema.projects).where(isNull(schema.projects.deletedAt)),
			db
				.select({ n: sql<number>`count(*)` })
				.from(schema.projects)
				.where(and(isNull(schema.projects.deletedAt), eq(schema.projects.status, 'active'))),
			db
				.select({ n: sql<number>`count(*)` })
				.from(schema.contracts)
				.where(and(eq(schema.contracts.projectId, params.id), isNull(schema.contracts.deletedAt))),
			db
				.select({ n: sql<number>`count(*)` })
				.from(schema.quotations)
				.where(and(eq(schema.quotations.projectId, params.id), isNull(schema.quotations.deletedAt))),
			db
				.select({ n: sql<number>`count(*)` })
				.from(schema.purchaseOrders)
				.where(and(eq(schema.purchaseOrders.projectId, params.id), isNull(schema.purchaseOrders.deletedAt))),
			db
				.select({ n: sql<number>`count(*)` })
				.from(schema.expenses)
				.where(and(eq(schema.expenses.projectId, params.id), isNull(schema.expenses.deletedAt)))
		]);

	const [contractsPick, quotationsPick, purchaseOrdersPick, expensesPickRows] = await Promise.all([
		db
			.select({
				id: schema.contracts.id,
				fileUrl: schema.contracts.fileUrl,
				date: schema.contracts.date,
				amount: schema.contracts.amount,
				currency: schema.contracts.currency
			})
			.from(schema.contracts)
			.where(and(eq(schema.contracts.projectId, params.id), isNull(schema.contracts.deletedAt)))
			.orderBy(desc(schema.contracts.createdAt)),
		db
			.select({
				id: schema.quotations.id,
				fileUrl: schema.quotations.fileUrl,
				date: schema.quotations.date,
				amount: schema.quotations.amount,
				currency: schema.quotations.currency,
				sourceType: schema.quotations.sourceType
			})
			.from(schema.quotations)
			.where(and(eq(schema.quotations.projectId, params.id), isNull(schema.quotations.deletedAt)))
			.orderBy(desc(schema.quotations.createdAt)),
		db
			.select({
				id: schema.purchaseOrders.id,
				poNumber: schema.purchaseOrders.poNumber,
				supplierName: schema.purchaseOrders.supplierName,
				date: schema.purchaseOrders.date,
				amount: schema.purchaseOrders.amount,
				currency: schema.purchaseOrders.currency
			})
			.from(schema.purchaseOrders)
			.where(and(eq(schema.purchaseOrders.projectId, params.id), isNull(schema.purchaseOrders.deletedAt)))
			.orderBy(desc(schema.purchaseOrders.createdAt)),
		db
			.select({
				id: schema.expenses.id,
				category: schema.expenses.category,
				subcategory: schema.expenses.subcategory,
				date: schema.expenses.date,
				amount: schema.expenses.amount,
				currency: schema.expenses.currency
			})
			.from(schema.expenses)
			.where(and(eq(schema.expenses.projectId, params.id), isNull(schema.expenses.deletedAt)))
			.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt))
	]);

	const arPickLists = {
		contracts: contractsPick.map((row) => ({
			id: row.id,
			label: fileLabelFromUrl(row.fileUrl, row.date),
			subtitle: `${row.date ?? '—'} · ${row.amount ?? 0} ${row.currency ?? 'SGD'}`
		})),
		quotations: quotationsPick.map((row) => ({
			id: row.id,
			label: fileLabelFromUrl(row.fileUrl ?? '', row.date),
			subtitle: `${row.date ?? '—'} · ${row.amount ?? 0} ${row.currency ?? 'SGD'}${row.sourceType ? ` · ${row.sourceType}` : ''}`
		})),
		purchaseOrders: purchaseOrdersPick.map((row) => ({
			id: row.id,
			label: row.poNumber,
			subtitle: `${row.supplierName ?? '—'} · ${row.date ?? '—'} · ${row.amount ?? 0} ${row.currency ?? 'SGD'}`
		})),
		expenses: expensesPickRows.map((row) => ({
			id: row.id,
			label: row.subcategory ? `${row.category} / ${row.subcategory}` : row.category,
			subtitle: `${row.date ?? '—'} · ${row.amount ?? 0} ${row.currency ?? 'SGD'}`
		}))
	};

	const activityRows = await db
		.select({
			id: schema.auditLogs.id,
			action: schema.auditLogs.action,
			actorEmail: schema.auditLogs.actorEmail,
			createdAt: schema.auditLogs.createdAt,
			metadata: schema.auditLogs.metadata
		})
		.from(schema.auditLogs)
		.where(and(eq(schema.auditLogs.projectId, params.id), isNull(schema.auditLogs.deletedAt)))
		.orderBy(desc(schema.auditLogs.createdAt))
		.limit(25);

	const activityFeed = activityRows.map((row) => {
		const meta = parseAuditMetadata(row.metadata);
		const when = new Date(row.createdAt);
		const timeLabel = Number.isNaN(when.getTime())
			? row.createdAt
			: when.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' });
		return {
			id: row.id,
			summary: summarizeAuditForProject(row.action, meta),
			actor: row.actorEmail ?? 'System',
			timeLabel,
			variant: activityVariantForAction(row.action)
		};
	});

	return {
		project,
		customerName: customer?.name ?? project.customerId,
		projectListCounts: {
			all: Number(allProjectsCountRow?.n ?? 0),
			active: Number(activeProjectsCountRow?.n ?? 0)
		},
		submoduleCounts: {
			contracts: Number(contractsCountRow?.n ?? 0),
			quotations: Number(quotationsCountRow?.n ?? 0),
			purchaseOrders: Number(purchaseOrdersCountRow?.n ?? 0),
			expenses: Number(expensesCountRow?.n ?? 0)
		},
		arPickLists,
		activityFeed
	};
};

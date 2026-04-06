import { and, eq, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail } from '$lib/server/http';

function isIsoDate(value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function csvEscape(value: string | number): string {
	const text = String(value ?? '');
	if (text.includes(',') || text.includes('"') || text.includes('\n')) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

export const GET: RequestHandler = async ({ platform, url }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const projectId = url.searchParams.get('projectId') ?? '';
	const projectStatus = url.searchParams.get('projectStatus') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const hasRange = isIsoDate(from) && isIsoDate(to) && from <= to;
	const dateOutClause = hasRange
		? sql` and io.date between ${from} and ${to}`
		: sql``;
	const dateInClause = hasRange
		? sql` and ii.invoice_date between ${from} and ${to}`
		: sql``;
	const datePrClause = hasRange
		? sql` and pr.period between ${from} and ${to}`
		: sql``;
	const dateExClause = hasRange
		? sql` and ex.date between ${from} and ${to}`
		: sql``;

	const db = getDb(platform.env);
	const projectConditions = [isNull(schema.projects.deletedAt)];
	if (projectId) projectConditions.push(eq(schema.projects.id, projectId));
	if (projectStatus) projectConditions.push(eq(schema.projects.status, projectStatus));

	const rows = await db
		.select({
			projectId: schema.projects.id,
			projectName: schema.projects.name,
			projectStatus: schema.projects.status,
			revenue: sql<number>`coalesce((select sum(io.total) from invoices_out io where io.project_id = ${schema.projects.id} and io.deleted_at is null ${dateOutClause}), 0)`,
			purchaseCost: sql<number>`coalesce((select sum(ii.amount) from invoices_in ii where ii.project_id = ${schema.projects.id} and ii.deleted_at is null ${dateInClause}), 0)`,
			staffCost: sql<number>`coalesce((select sum(pr.computed_amount) from payout_records pr inner join compensation_components cc on cc.id = pr.component_id and cc.deleted_at is null where pr.project_id = ${schema.projects.id} and pr.deleted_at is null and pr.status in ('confirmed','paid') and cc.income_type != 'dividend' ${datePrClause}), 0)`,
			expenseCost: sql<number>`coalesce((select sum(ex.amount) from expenses ex where ex.project_id = ${schema.projects.id} and ex.deleted_at is null ${dateExClause}), 0)`
		})
		.from(schema.projects)
		.where(and(...projectConditions));

	const header = ['project_id', 'project_name', 'status', 'revenue', 'cost', 'profit', 'profit_margin'];
	const lines = rows.map((row) => {
		const cost = row.purchaseCost + row.staffCost + row.expenseCost;
		const profit = row.revenue - cost;
		const margin = row.revenue > 0 ? profit / row.revenue : 0;
		return [
			csvEscape(row.projectId),
			csvEscape(row.projectName),
			csvEscape(row.projectStatus),
			csvEscape(row.revenue.toFixed(2)),
			csvEscape(cost.toFixed(2)),
			csvEscape(profit.toFixed(2)),
			csvEscape(margin.toFixed(6))
		].join(',');
	});

	return new Response([header.join(','), ...lines].join('\n'), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="projects-profit-report.csv"'
		}
	});
};

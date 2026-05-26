import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { AuditService } from '$platform/audit/audit-service';
import { fail } from '$platform/http';
import type { AuditActionType } from '$platform/audit/audit-log.schema';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		if (!ctx.user) return fail('Unauthorized', 401);

		const roles = ctx.user.roles ?? [];
		if (!roles.some(r => ['owner', 'admin'].includes(r))) {
			return fail('Forbidden: only owner/admin can export audit logs', 403);
		}

		const url = event.url;
		const params = {
			actorUserId: url.searchParams.get('actorUserId') ?? undefined,
			actorEmail: url.searchParams.get('actorEmail') ?? undefined,
			module: url.searchParams.get('module') ?? undefined,
			actionType: (url.searchParams.get('actionType') as AuditActionType) ?? undefined,
			entityType: url.searchParams.get('entityType') ?? undefined,
			dateFrom: url.searchParams.get('dateFrom') ?? undefined,
			dateTo: url.searchParams.get('dateTo') ?? undefined,
			query: url.searchParams.get('q') ?? undefined,
			page: 1,
			pageSize: 10000
		};

		const audit = new AuditService(ctx);
		const result = await audit.search(params);

		await audit.writeLog({
			action: 'audit.exported',
			entityType: 'audit_log',
			module: 'core',
			actionType: 'export',
			metadata: { exportedCount: result.total, filters: params }
		});

		const format = url.searchParams.get('format') ?? 'csv';

		if (format === 'csv') {
			const csv = buildCsv(result.items);
			const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
			return new Response(csv, {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="${filename}"`
				}
			});
		}

		return fail('Unsupported format. Use format=csv', 400);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

function buildCsv(rows: Record<string, unknown>[]): string {
	if (rows.length === 0) return '';

	const headers = [
		'ID', 'Timestamp', 'User ID', 'User Email', 'IP Address',
		'Module', 'Action Type', 'Action', 'Entity Type', 'Entity ID',
		'Project ID', 'Old Value', 'New Value', 'Metadata'
	];

	const lines = [headers.join(',')];

	for (const row of rows) {
		lines.push([
			csvEscape(row.id as string),
			csvEscape(row.createdAt as string),
			csvEscape(row.actorUserId as string),
			csvEscape(row.actorEmail as string),
			csvEscape(row.ipAddress as string),
			csvEscape(row.module as string),
			csvEscape(row.actionType as string),
			csvEscape(row.action as string),
			csvEscape(row.entityType as string),
			csvEscape(row.entityId as string),
			csvEscape(row.projectId as string),
			csvEscape(row.oldValue as string),
			csvEscape(row.newValue as string),
			csvEscape(row.metadata as string)
		].join(','));
	}

	return lines.join('\n');
}

function csvEscape(value: unknown): string {
	if (value == null) return '';
	const str = String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

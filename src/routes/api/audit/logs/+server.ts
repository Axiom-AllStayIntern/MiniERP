import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { AuditService } from '$platform/audit/audit-service';
import { ok, fail } from '$platform/http';
import type { AuditActionType } from '$platform/audit/audit-log.schema';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		if (!ctx.user) return fail('Unauthorized', 401);

		const roles = ctx.user.roles ?? [];
		if (!roles.some(r => ['owner', 'admin'].includes(r))) {
			return fail('Forbidden: only owner/admin can access audit logs', 403);
		}

		const url = event.url;
		const params = {
			actorUserId: url.searchParams.get('actorUserId') ?? undefined,
			actorEmail: url.searchParams.get('actorEmail') ?? undefined,
			module: url.searchParams.get('module') ?? undefined,
			actionType: (url.searchParams.get('actionType') as AuditActionType) ?? undefined,
			entityType: url.searchParams.get('entityType') ?? undefined,
			entityId: url.searchParams.get('entityId') ?? undefined,
			projectId: url.searchParams.get('projectId') ?? undefined,
			action: url.searchParams.get('action') ?? undefined,
			dateFrom: url.searchParams.get('dateFrom') ?? undefined,
			dateTo: url.searchParams.get('dateTo') ?? undefined,
			query: url.searchParams.get('q') ?? undefined,
			page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1,
			pageSize: url.searchParams.get('pageSize') ? parseInt(url.searchParams.get('pageSize')!) : 25
		};

		const audit = new AuditService(ctx);
		const result = await audit.search(params);
		return ok(result);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

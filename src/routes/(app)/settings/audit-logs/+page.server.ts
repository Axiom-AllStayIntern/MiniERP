import type { PageServerLoad } from './$types';
import { createModuleContext } from '$platform/modules';
import { AuditService } from '$platform/audit/audit-service';
import { ConfigService } from '$platform/config/config-service';
import { redirect } from '@sveltejs/kit';
import type { AuditActionType } from '$platform/audit/audit-log.schema';

export const load: PageServerLoad = async (event) => {
	const ctx = await createModuleContext(event);
	if (!ctx.user) throw redirect(302, '/login');

	const roles = ctx.user.roles ?? [];
	if (!roles.some(r => ['owner', 'admin'].includes(r))) {
		throw redirect(302, '/settings');
	}

	const url = event.url;
	const params = {
		actorUserId: url.searchParams.get('actorUserId') ?? undefined,
		actorEmail: url.searchParams.get('actorEmail') ?? undefined,
		module: url.searchParams.get('module') ?? undefined,
		actionType: (url.searchParams.get('actionType') as AuditActionType) ?? undefined,
		entityType: url.searchParams.get('entityType') ?? undefined,
		action: url.searchParams.get('action') ?? undefined,
		dateFrom: url.searchParams.get('dateFrom') ?? undefined,
		dateTo: url.searchParams.get('dateTo') ?? undefined,
		query: url.searchParams.get('q') ?? undefined,
		page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1,
		pageSize: 25
	};

	const audit = new AuditService(ctx);
	const config = new ConfigService(ctx);
	const [result, retentionYears] = await Promise.all([
		audit.search(params),
		config.get<number>('audit.retention_years')
	]);

	return {
		logs: result,
		filters: params,
		retentionYears: retentionYears ?? 7
	};
};

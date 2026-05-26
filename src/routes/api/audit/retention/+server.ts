import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { AuditService } from '$platform/audit/audit-service';
import { ConfigService } from '$platform/config/config-service';
import { ok, fail } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		if (!ctx.user) return fail('Unauthorized', 401);

		const roles = ctx.user.roles ?? [];
		if (!roles.some(r => ['owner', 'admin'].includes(r))) {
			return fail('Forbidden', 403);
		}

		const audit = new AuditService(ctx);
		const config = new ConfigService(ctx);

		const retentionYears = await config.get<number>('audit.retention_years') ?? 7;
		const stats = await audit.getRetentionStats();
		const archivableCount = await audit.getArchivableCount(retentionYears);

		return ok({
			retentionYears,
			...stats,
			archivableCount
		});
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		if (!ctx.user) return fail('Unauthorized', 401);

		const roles = ctx.user.roles ?? [];
		if (!roles.some(r => ['owner', 'admin'].includes(r))) {
			return fail('Forbidden', 403);
		}

		const body = await event.request.json() as { retentionYears?: number };
		const years = body.retentionYears;
		if (typeof years !== 'number' || years < 1 || years > 99) {
			return fail('retentionYears must be between 1 and 99', 400);
		}

		const config = new ConfigService(ctx);
		await config.set('audit.retention_years', years);

		const audit = new AuditService(ctx);
		await audit.writeLog({
			action: 'audit.retention_changed',
			entityType: 'audit_config',
			module: 'core',
			actionType: 'update',
			newValue: { retentionYears: years },
			metadata: { retentionYears: years }
		});

		return ok({ retentionYears: years, saved: true });
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { AuditService } from '$platform/audit/audit-service';
import { ok, fail } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		if (!ctx.user) return fail('Unauthorized', 401);

		const roles = ctx.user.roles ?? [];
		if (!roles.some(r => ['owner', 'admin'].includes(r))) {
			return fail('Forbidden: only owner/admin can verify audit integrity', 403);
		}

		const url = event.url;
		const fromSeq = url.searchParams.get('fromSeq') ? parseInt(url.searchParams.get('fromSeq')!) : undefined;
		const toSeq = url.searchParams.get('toSeq') ? parseInt(url.searchParams.get('toSeq')!) : undefined;

		const audit = new AuditService(ctx);
		const result = await audit.verifyIntegrity(fromSeq, toSeq);
		return ok(result);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

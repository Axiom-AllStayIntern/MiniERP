import type { ModuleContext } from '$platform/modules/types';
import { AuditRepository } from './audit-repository';

export class AuditService {
	private repo: AuditRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new AuditRepository(ctx.db);
	}

	async writeLog(input: {
		action: string;
		entityType: string;
		entityId?: string | null;
		projectId?: string | null;
		metadata?: Record<string, unknown>;
	}) {
		return this.repo.writeLog(this.ctx.user, input);
	}

	async getProjectActivity(projectId: string, limit = 20) {
		return this.repo.getProjectActivity(projectId, limit);
	}
}

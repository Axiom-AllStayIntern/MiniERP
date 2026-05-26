import type { ModuleContext } from '$platform/modules/types';
import { AuditRepository, type AuditWriteInput, type AuditSearchParams } from './audit-repository';
import type { AuditActionType } from './audit-log.schema';

export interface AuditLogInput {
	action: string;
	entityType: string;
	entityId?: string | null;
	projectId?: string | null;
	module?: string | null;
	actionType?: AuditActionType | null;
	ipAddress?: string | null;
	oldValue?: Record<string, unknown> | null;
	newValue?: Record<string, unknown> | null;
	metadata?: Record<string, unknown>;
}

export class AuditService {
	private repo: AuditRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new AuditRepository(ctx.db);
	}

	async writeLog(input: AuditLogInput) {
		return this.repo.writeLog(this.ctx.user, input);
	}

	async search(params: AuditSearchParams) {
		return this.repo.search(params);
	}

	async getProjectActivity(projectId: string, limit = 20) {
		return this.repo.getProjectActivity(projectId, limit);
	}

	async verifyIntegrity(fromSeq?: number, toSeq?: number) {
		return this.repo.verifyIntegrity(fromSeq, toSeq);
	}

	async getRetentionStats() {
		return this.repo.getRetentionStats();
	}

	async getArchivableCount(retentionYears: number): Promise<number> {
		const cutoff = new Date();
		cutoff.setFullYear(cutoff.getFullYear() - retentionYears);
		return this.repo.archiveBeforeDate(cutoff.toISOString());
	}
}

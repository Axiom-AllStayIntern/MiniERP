import type { ModuleContext } from '$platform/modules/types';
import { AuditRepository, CompanySettingsRepository } from './repository';

// ---------------------------------------------------------------------------
// AuditService
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ConfigService
// ---------------------------------------------------------------------------

export class ConfigService {
	private repo: CompanySettingsRepository;

	constructor(ctx: ModuleContext) {
		this.repo = new CompanySettingsRepository(ctx.db);
	}

	async get<T = string>(key: string): Promise<T | null> {
		return this.repo.get<T>(key);
	}

	async set(key: string, value: unknown) {
		return this.repo.set(key, value);
	}

	async getEnabledModules(): Promise<string[] | null> {
		const raw = await this.repo.get<unknown>('modules.enabled');
		if (!Array.isArray(raw)) return null;
		const normalized = raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim());
		return normalized.length > 0 ? normalized : [];
	}

	async setEnabledModules(moduleIds: string[]) {
		const normalized = [...new Set(moduleIds.map((id) => id.trim()).filter(Boolean))].sort();
		return this.repo.set('modules.enabled', normalized);
	}
}

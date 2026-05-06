import type { ModuleContext } from '$platform/modules/types';
import { CompanySettingsRepository } from './company-settings-repository';

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

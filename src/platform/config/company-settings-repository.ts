import { eq } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { companySettings } from './company-settings.schema';

export class CompanySettingsRepository {
	constructor(private db: DBClient) {}

	async get<T = string>(key: string): Promise<T | null> {
		const rows = await this.db
			.select()
			.from(companySettings)
			.where(eq(companySettings.key, key))
			.limit(1);
		if (!rows[0]) return null;
		try {
			return JSON.parse(rows[0].value) as T;
		} catch {
			return rows[0].value as unknown as T;
		}
	}

	async set(key: string, value: unknown) {
		const now = new Date().toISOString();
		const serialized = typeof value === 'string' ? value : JSON.stringify(value);
		await this.db
			.insert(companySettings)
			.values({ key, value: serialized, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: companySettings.key,
				set: { value: serialized, updatedAt: now }
			});
	}
}

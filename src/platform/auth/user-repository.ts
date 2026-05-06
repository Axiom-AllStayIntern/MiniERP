import { and, eq, isNull } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { BaseRepository } from '$platform/modules/base-repository';
import { users } from './users.schema';

export class UserRepository extends BaseRepository<typeof users> {
	constructor(db: DBClient) {
		super(db, users);
	}

	async findByEmail(email: string) {
		const rows = await this.db
			.select()
			.from(users)
			.where(and(eq(users.email, email), isNull(users.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}
}

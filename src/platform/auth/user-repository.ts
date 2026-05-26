import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { BaseRepository } from '$platform/modules/base-repository';
import { users } from './users.schema';
import type { AuthRole } from './config';

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

	async findByRoles(roles: Array<typeof users.$inferSelect['role']>) {
		return this.db
			.select({ id: users.id, email: users.email, name: users.name, role: users.role })
			.from(users)
			.where(and(inArray(users.role, roles), isNull(users.deletedAt)));
	}

	async listAllUsers() {
		return this.db
			.select({
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
				emailVerified: users.emailVerified,
				createdAt: users.createdAt,
				deletedAt: users.deletedAt
			})
			.from(users)
			.orderBy(sql`${users.createdAt} DESC`);
	}

	async updateRoles(userId: string, roles: AuthRole[]) {
		const now = new Date();
		await this.db
			.update(users)
			.set({
				role: JSON.stringify(roles),
				updatedAt: now
			})
			.where(eq(users.id, userId));
	}

	async countActive() {
		const rows = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(users)
			.where(isNull(users.deletedAt));
		return rows[0]?.count ?? 0;
	}

	async deactivate(userId: string) {
		const now = new Date().toISOString();
		await this.db
			.update(users)
			.set({ deletedAt: now, updatedAt: new Date() })
			.where(eq(users.id, userId));
	}

	async reactivate(userId: string) {
		await this.db
			.update(users)
			.set({ deletedAt: null, updatedAt: new Date() })
			.where(eq(users.id, userId));
	}
}

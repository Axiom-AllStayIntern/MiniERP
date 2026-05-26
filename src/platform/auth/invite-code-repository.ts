import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { BaseRepository } from '$platform/modules/base-repository';
import { inviteCodes } from './invite-codes.schema';

export class InviteCodeRepository extends BaseRepository<typeof inviteCodes> {
	constructor(db: DBClient) {
		super(db, inviteCodes);
	}

	async findByCode(code: string) {
		const now = new Date().toISOString();
		const rows = await this.db
			.select()
			.from(inviteCodes)
			.where(
				and(
					eq(inviteCodes.code, code),
					isNull(inviteCodes.deletedAt),
					sql`${inviteCodes.expiresAt} > ${now}`,
					sql`${inviteCodes.useCount} < ${inviteCodes.maxUses}`
				)
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async consume(codeId: string, userId: string) {
		const now = new Date().toISOString();
		await this.db
			.update(inviteCodes)
			.set({
				useCount: sql`${inviteCodes.useCount} + 1`,
				usedBy: userId,
				usedAt: now,
				updatedAt: now
			})
			.where(eq(inviteCodes.id, codeId));
	}

	async listAll() {
		return this.db
			.select()
			.from(inviteCodes)
			.where(isNull(inviteCodes.deletedAt))
			.orderBy(sql`${inviteCodes.createdAt} DESC`);
	}
}

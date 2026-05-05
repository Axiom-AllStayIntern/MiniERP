import { eq, isNull, and, desc, type SQL } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { DBClient } from '$infrastructure/db';

/**
 * Base repository providing standard CRUD with built-in soft-delete filtering.
 *
 * Each module repository extends this for common operations, and adds
 * specialized query methods as needed. Services can still access `this.db`
 * directly for complex joins that don't fit the base patterns.
 */
export class BaseRepository<
	TTable extends SQLiteTableWithColumns<any>
> {
	constructor(
		protected db: DBClient,
		protected table: TTable
	) {}

	async findById(id: string) {
		const rows = await this.db
			.select()
			.from(this.table)
			.where(and(eq(this.table.id, id), isNull(this.table.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}

	async findAll(opts?: {
		where?: SQL;
		orderBy?: SQL;
		limit?: number;
		offset?: number;
	}) {
		let q = this.db
			.select()
			.from(this.table)
			.where(
				opts?.where
					? and(isNull(this.table.deletedAt), opts.where)
					: isNull(this.table.deletedAt)
			)
			.$dynamic();

		if (opts?.orderBy) {
			q = q.orderBy(opts.orderBy);
		}
		if (opts?.limit) {
			q = q.limit(opts.limit);
		}
		if (opts?.offset) {
			q = q.offset(opts.offset);
		}

		return q;
	}

	async create(data: Record<string, unknown>) {
		const now = new Date().toISOString();
		const id = (data.id as string) ?? crypto.randomUUID();
		const row = {
			...data,
			id,
			createdAt: now,
			updatedAt: now
		};
		await this.db.insert(this.table).values(row as any);
		return row;
	}

	async update(id: string, data: Record<string, unknown>) {
		const now = new Date().toISOString();
		await this.db
			.update(this.table)
			.set({ ...data, updatedAt: now } as any)
			.where(and(eq(this.table.id, id), isNull(this.table.deletedAt)));
	}

	async softDelete(id: string) {
		const now = new Date().toISOString();
		await this.db
			.update(this.table)
			.set({ deletedAt: now, updatedAt: now } as any)
			.where(eq(this.table.id, id));
	}
}

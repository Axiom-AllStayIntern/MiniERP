import { desc, eq, isNull, and, like, or } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { businessPartners, customers } from './schema';
import { BaseRepository } from '$platform/modules/base-repository';

// ---------------------------------------------------------------------------
// BusinessPartnerRepository
// ---------------------------------------------------------------------------

export class BusinessPartnerRepository extends BaseRepository<typeof businessPartners> {
	constructor(db: DBClient) {
		super(db, businessPartners);
	}

	async findByType(type: 'customer' | 'supplier' | 'both') {
		const conditions = [isNull(businessPartners.deletedAt)];
		if (type === 'both') {
			conditions.push(eq(businessPartners.type, 'both'));
		} else {
			conditions.push(or(eq(businessPartners.type, type), eq(businessPartners.type, 'both'))!);
		}
		return this.db
			.select()
			.from(businessPartners)
			.where(and(...conditions));
	}

	async search(query: string) {
		return this.db
			.select()
			.from(businessPartners)
			.where(
				and(isNull(businessPartners.deletedAt), like(businessPartners.name, `%${query}%`))
			);
	}
}

// ---------------------------------------------------------------------------
// Legacy CustomerRepository (wraps old customers table during migration)
// ---------------------------------------------------------------------------

export class CustomerRepository extends BaseRepository<typeof customers> {
	constructor(db: DBClient) {
		super(db, customers);
	}

	async listOptions() {
		return this.db
			.select({ id: customers.id, name: customers.name })
			.from(customers)
			.where(isNull(customers.deletedAt))
			.orderBy(desc(customers.createdAt));
	}

	async listDirectory() {
		return this.db
			.select({
				id: customers.id,
				name: customers.name,
				contact: customers.contact,
				address: customers.address
			})
			.from(customers)
			.where(isNull(customers.deletedAt))
			.orderBy(desc(customers.createdAt));
	}
}

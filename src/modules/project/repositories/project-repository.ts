import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { customers, projectEmployees, projects } from '../../../infrastructure/db/schema';

export class ProjectRepository {
	constructor(private db: DBClient) {}

	async findById(projectId: string) {
		const rows = await this.db
			.select()
			.from(projects)
			.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
			.limit(1);

		return rows[0] ?? null;
	}

	async findWithCustomer(projectId: string) {
		const rows = await this.db
			.select({
				project: projects,
				customerName: customers.name
			})
			.from(projects)
			.leftJoin(customers, eq(projects.customerId, customers.id))
			.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
			.limit(1);

		return rows[0] ?? null;
	}

	async list(opts?: { q?: string; status?: string; page?: number; pageSize?: number }) {
		const page = opts?.page ?? 1;
		const pageSize = opts?.pageSize ?? 20;
		const conditions = [isNull(projects.deletedAt)];

		if (opts?.q) {
			conditions.push(or(like(projects.name, `%${opts.q}%`), like(projects.description, `%${opts.q}%`))!);
		}
		if (opts?.status) {
			conditions.push(eq(projects.status, opts.status));
		}

		return this.db
			.select({
				project: projects,
				customerName: customers.name
			})
			.from(projects)
			.leftJoin(customers, eq(projects.customerId, customers.id))
			.where(and(...conditions))
			.orderBy(desc(projects.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize);
	}

	async getListCounts() {
		const [[allProjectsCountRow], [activeProjectsCountRow]] = await Promise.all([
			this.db.select({ n: sql<number>`count(*)` }).from(projects).where(isNull(projects.deletedAt)),
			this.db
				.select({ n: sql<number>`count(*)` })
				.from(projects)
				.where(and(isNull(projects.deletedAt), eq(projects.status, 'active')))
		]);

		return {
			all: Number(allProjectsCountRow?.n ?? 0),
			active: Number(activeProjectsCountRow?.n ?? 0)
		};
	}

	async getMembers(projectId: string) {
		return this.db
			.select()
			.from(projectEmployees)
			.where(and(eq(projectEmployees.projectId, projectId), isNull(projectEmployees.deletedAt)));
	}
}

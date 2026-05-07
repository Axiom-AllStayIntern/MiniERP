import { eq, isNull, and, like, or, desc, sql } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { projects, projectEmployees } from './project.schema';
import { businessPartners } from '$modules/business-partner/repositories/business-partner.schema';
import { BaseRepository } from '$platform/modules/base-repository';

// ---------------------------------------------------------------------------
// ProjectRepository
// ---------------------------------------------------------------------------

export class ProjectRepository extends BaseRepository<typeof projects> {
	constructor(db: DBClient) {
		super(db, projects);
	}

	async findWithCustomer(projectId: string) {
		const rows = await this.db
			.select({
				project: projects,
				customerName: businessPartners.name
			})
			.from(projects)
			.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
			.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}

	async list(opts?: { q?: string; status?: string; page?: number; pageSize?: number }) {
		const page = opts?.page ?? 1;
		const pageSize = opts?.pageSize ?? 20;
		const conditions = [isNull(projects.deletedAt)];

		if (opts?.q) {
			conditions.push(
				or(
					like(projects.name, `%${opts.q}%`),
					like(projects.description, `%${opts.q}%`)
				)!
			);
		}
		if (opts?.status) {
			conditions.push(eq(projects.status, opts.status));
		}

		const where = and(...conditions);

		const rows = await this.db
			.select({
				project: projects,
				customerName: businessPartners.name
			})
			.from(projects)
			.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
			.where(where)
			.orderBy(desc(projects.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize);

		return rows;
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
			.where(
				and(eq(projectEmployees.projectId, projectId), isNull(projectEmployees.deletedAt))
			);
	}
}

// ---------------------------------------------------------------------------
// ProjectMemberRepository
// ---------------------------------------------------------------------------

export class ProjectMemberRepository extends BaseRepository<typeof projectEmployees> {
	constructor(db: DBClient) {
		super(db, projectEmployees);
	}

	async findByProjectAndPerson(projectId: string, personId: string) {
		const rows = await this.db
			.select()
			.from(projectEmployees)
			.where(
				and(
					eq(projectEmployees.projectId, projectId),
					eq(projectEmployees.personId, personId),
					isNull(projectEmployees.deletedAt)
				)
			)
			.limit(1);
		return rows[0] ?? null;
	}
}

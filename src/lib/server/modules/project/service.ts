import type { ModuleContext } from '../types';
import { ProjectRepository, ProjectMemberRepository } from './repository';
import { NotFoundError } from '../errors';
import { createEvent } from '../event-bus';

// ---------------------------------------------------------------------------
// ProjectService
// ---------------------------------------------------------------------------

export class ProjectService {
	private repo: ProjectRepository;
	private memberRepo: ProjectMemberRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new ProjectRepository(ctx.db);
		this.memberRepo = new ProjectMemberRepository(ctx.db);
	}

	async getById(id: string) {
		const p = await this.repo.findById(id);
		if (!p) throw new NotFoundError('Project', id);
		return p;
	}

	async getWithCustomer(id: string) {
		const result = await this.repo.findWithCustomer(id);
		if (!result) throw new NotFoundError('Project', id);
		return result;
	}

	async list(opts?: { q?: string; status?: string; page?: number; pageSize?: number }) {
		return this.repo.list(opts);
	}

	async create(data: {
		customerId: string;
		name: string;
		status?: string;
		startDate?: string;
		endDate?: string;
		description?: string;
	}) {
		return this.repo.create(data);
	}

	async update(id: string, data: Record<string, unknown>) {
		return this.repo.update(id, data);
	}

	async archive(id: string) {
		const updated = await this.repo.update(id, { status: 'archived' });
		await this.ctx.eventBus.emit(
			createEvent('project.archived', 'project', {
				projectId: id
			})
		);
		return updated;
	}

	async softDelete(id: string) {
		return this.repo.update(id, { status: 'archived', deletedAt: new Date().toISOString() });
	}

	async getMembers(projectId: string) {
		return this.repo.getMembers(projectId);
	}

	async addMember(data: {
		projectId: string;
		employeeId: string;
		name: string;
		role?: string;
		staffType?: string;
		dateIn?: string;
		cpfApplicable?: boolean;
	}) {
		return this.memberRepo.create(data);
	}

	async removeMember(memberId: string) {
		return this.memberRepo.softDelete(memberId);
	}

	/**
	 * Get full project financials. This method crosses module boundaries
	 * through the public APIs injected at call time.
	 */
	async getProjectFinancials(
		projectId: string,
		deps: {
			getRevenue: () => Promise<number>;
			getPurchaseCost: () => Promise<number>;
			getStaffCost: () => Promise<number>;
			getExpenseSums: () => Promise<{ cogs: number; opex: number }>;
		}
	) {
		const [revenue, purchaseCost, staffCost, expenseSums] = await Promise.all([
			deps.getRevenue(),
			deps.getPurchaseCost(),
			deps.getStaffCost(),
			deps.getExpenseSums()
		]);

		const expenseCogs = expenseSums.cogs;
		const expenseOpex = expenseSums.opex;
		const grossProfit = revenue - purchaseCost - staffCost - expenseCogs;
		const netProfit = grossProfit - expenseOpex;
		const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

		return {
			revenue,
			purchaseCost,
			staffCost,
			expenseCogs,
			expenseOpex,
			grossProfit,
			netProfit,
			margin: Math.round(margin * 100) / 100
		};
	}
}

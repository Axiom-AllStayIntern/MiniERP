import type { ModuleContext } from '../types';
import { ExpenseRepository, RevenueRepository, ExpenseCategoryRepository } from './repository';
import { createEvent } from '../event-bus';
import type { ExpenseType } from '$lib/constants/expense-upload';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';

// ---------------------------------------------------------------------------
// ExpenseService
// ---------------------------------------------------------------------------

export class ExpenseService {
	private repo: ExpenseRepository;
	private revenueRepo: RevenueRepository;
	private categoryRepo: ExpenseCategoryRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new ExpenseRepository(ctx.db);
		this.revenueRepo = new RevenueRepository(ctx.db);
		this.categoryRepo = new ExpenseCategoryRepository(ctx.db);
	}

	async getByProject(projectId: string) {
		return this.repo.findByProject(projectId);
	}

	async getProjectExpenseSums(projectId: string) {
		return this.repo.getProjectExpenseSums(projectId);
	}

	async create(data: {
		projectId?: string | null;
		expenseType: ExpenseType;
		category: string;
		amount: number;
		currency?: string;
		date: string;
		vendorOrSupplier?: string | null;
		staffName?: string | null;
		reimbursement?: boolean;
		businessTrip?: boolean;
		destination?: string | null;
		notes?: string | null;
		metadata?: string | null;
		documentRef?: string | null;
	}) {
		const currency = (data.currency ?? 'SGD').trim().toUpperCase();
		const sgdEquivalent = await resolveSgdEquivalentForWrite({
			amount: data.amount,
			currency,
			dateYmd: data.date
		});
		const result = await this.repo.create({
			...data,
			currency,
			sgdEquivalent,
			reimbursement: data.reimbursement ?? false,
			businessTrip: data.businessTrip ?? false
		});

		await this.ctx.eventBus.emit(
			createEvent('expense.created', 'expense', {
				expenseId: result.id,
				projectId: data.projectId,
				amount: data.amount,
				expenseType: data.expenseType
			})
		);

		return result;
	}

	async update(id: string, data: Record<string, unknown>) {
		return this.repo.update(id, data);
	}

	async softDelete(id: string) {
		const expense = await this.repo.findById(id);
		if (!expense) return;

		await this.repo.softDelete(id);

		await this.ctx.eventBus.emit(
			createEvent('expense.deleted', 'expense', {
				expenseId: id,
				projectId: expense.projectId
			})
		);
	}

	// Revenue methods
	async getRevenueByProject(projectId: string) {
		return this.revenueRepo.findByProject(projectId);
	}

	async getProjectRevenueTotal(projectId: string) {
		return this.revenueRepo.getProjectRevenueTotal(projectId);
	}

	async createRevenue(data: {
		projectId?: string | null;
		invoiceType: 'standard' | 'zero_rate' | 'tax_invoice';
		invoiceNumber?: string | null;
		clientName?: string | null;
		date: string;
		amount: number;
		currency?: string;
		gstAmount?: number;
		notes?: string | null;
	}) {
		const currency = (data.currency ?? 'SGD').trim().toUpperCase();
		const sgdEquivalent = await resolveSgdEquivalentForWrite({
			amount: data.amount,
			currency,
			dateYmd: data.date
		});
		return this.revenueRepo.create({
			...data,
			currency,
			sgdEquivalent,
			gstAmount: data.gstAmount ?? 0
		});
	}

	async getCategories() {
		return this.categoryRepo.findAll();
	}
}

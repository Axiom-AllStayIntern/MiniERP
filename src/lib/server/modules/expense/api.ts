import type { ModuleContext } from '../types';
import { ExpenseService } from './service';

export type ExpenseApi = ReturnType<typeof createExpenseApi>;

export function createExpenseApi(ctx: ModuleContext) {
	const svc = new ExpenseService(ctx);

	return {
		getByProject: svc.getByProject.bind(svc),
		getProjectExpenseSums: svc.getProjectExpenseSums.bind(svc),
		getProjectExpenseDetail: svc.getProjectExpenseDetail.bind(svc),
		getProjectExpensePage: svc.getProjectExpensePage.bind(svc),
		create: svc.create.bind(svc),
		createBusinessTripWithAllowance: svc.createBusinessTripWithAllowance.bind(svc),
		update: svc.update.bind(svc),
		updateProjectExpense: svc.updateProjectExpense.bind(svc),
		softDelete: svc.softDelete.bind(svc),
		softDeleteProjectExpense: svc.softDeleteProjectExpense.bind(svc),
		getCategories: svc.getCategories.bind(svc),
		getRevenueByProject: svc.getRevenueByProject.bind(svc),
		getProjectRevenueTotal: svc.getProjectRevenueTotal.bind(svc),
		getProjectRevenuePage: svc.getProjectRevenuePage.bind(svc),
		getProjectRevenueDocumentDetail: svc.getProjectRevenueDocumentDetail.bind(svc),
		createRevenue: svc.createRevenue.bind(svc)
	};
}

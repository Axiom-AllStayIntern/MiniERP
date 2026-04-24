import type { ModuleContext } from '../types';
import { ExpenseService } from './service';
import { ExpenseUploadService } from './upload-service';

export type ExpenseApi = ReturnType<typeof createExpenseApi>;

export function createExpenseApi(ctx: ModuleContext) {
	const svc = new ExpenseService(ctx);
	const upload = new ExpenseUploadService(ctx);

	return {
		getByProject: svc.getByProject.bind(svc),
		getProjectExpenseSums: svc.getProjectExpenseSums.bind(svc),
		getProjectExpenseDetail: svc.getProjectExpenseDetail.bind(svc),
		getProjectExpensePage: svc.getProjectExpensePage.bind(svc),
		getExpenseListPage: svc.getExpenseListPage.bind(svc),
		getReimbursementsPage: svc.getReimbursementsPage.bind(svc),
		getExpenseUploadPage: svc.getExpenseUploadPage.bind(svc),
		create: svc.create.bind(svc),
		uploadExpense: upload.upload.bind(upload),
		createStandaloneExpense: svc.createStandaloneExpense.bind(svc),
		createBusinessTripWithAllowance: svc.createBusinessTripWithAllowance.bind(svc),
		listBusinessTrips: svc.listBusinessTrips.bind(svc),
		update: svc.update.bind(svc),
		updateProjectExpense: svc.updateProjectExpense.bind(svc),
		updateStandaloneExpense: svc.updateStandaloneExpense.bind(svc),
		softDelete: svc.softDelete.bind(svc),
		softDeleteProjectExpense: svc.softDeleteProjectExpense.bind(svc),
		softDeleteStandaloneExpense: svc.softDeleteStandaloneExpense.bind(svc),
		getStandaloneExpenseDetail: svc.getStandaloneExpenseDetail.bind(svc),
		getCategories: svc.getCategories.bind(svc),
		getRevenueByProject: svc.getRevenueByProject.bind(svc),
		getProjectRevenueTotal: svc.getProjectRevenueTotal.bind(svc),
		getProjectRevenuePage: svc.getProjectRevenuePage.bind(svc),
		getProjectRevenueDocumentDetail: svc.getProjectRevenueDocumentDetail.bind(svc),
		createRevenue: svc.createRevenue.bind(svc)
	};
}

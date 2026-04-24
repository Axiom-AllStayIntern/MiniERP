import type { FinanceExpensesSource } from './contracts';

export function createFinanceExpensesApi(source: FinanceExpensesSource) {
	return {
		getExpenseListPage: source.getExpenseListPage,
		createStandaloneExpense: source.createStandaloneExpense,
		getStandaloneExpenseDetail: source.getStandaloneExpenseDetail,
		updateStandaloneExpense: source.updateStandaloneExpense,
		softDeleteStandaloneExpense: source.softDeleteStandaloneExpense,
		getReimbursementsPage: source.getReimbursementsPage,
		getExpenseUploadPage: source.getExpenseUploadPage,
		getProjectExpensePage: source.getProjectExpensePage,
		create: source.create,
		getProjectExpenseDetail: source.getProjectExpenseDetail,
		updateProjectExpense: source.updateProjectExpense,
		softDeleteProjectExpense: source.softDeleteProjectExpense,
		uploadExpense: source.uploadExpense,
		listBusinessTrips: source.listBusinessTrips,
		createBusinessTripWithAllowance: source.createBusinessTripWithAllowance,
		getProjectExpenseSums: source.getProjectExpenseSums
	};
}

export type FinanceExpensesApi = ReturnType<typeof createFinanceExpensesApi>;

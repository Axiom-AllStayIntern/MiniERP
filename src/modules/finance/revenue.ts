import type { FinanceRevenueSource } from './contracts';

export function createFinanceRevenueApi(source: FinanceRevenueSource) {
	return {
		getProjectRevenuePage: source.getProjectRevenuePage,
		createRevenue: source.createRevenue,
		getProjectRevenueDocumentDetail: source.getProjectRevenueDocumentDetail
	};
}

export type FinanceRevenueApi = ReturnType<typeof createFinanceRevenueApi>;

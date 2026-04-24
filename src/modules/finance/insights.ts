import type { FinanceInsightsSource } from './contracts';

export function createFinanceInsightsApi(source: FinanceInsightsSource) {
	return {
		getCompanyFinancialOverview: source.getCompanyFinancialOverview,
		getDashboardCharts: source.getDashboardCharts,
		getProjectsProfitRanking: source.getProjectsProfitRanking,
		getProjectsProfitCsv: source.getProjectsProfitCsv,
		getProjectFinancialDetail: source.getProjectFinancialDetail,
		getProjectDocumentsSummary: source.getProjectDocumentsSummary
	};
}

export type FinanceInsightsApi = ReturnType<typeof createFinanceInsightsApi>;

import type { ModuleContext } from '../types';
import { DashboardService } from './service';

export type ReportingApi = ReturnType<typeof createReportingApi>;

export function createReportingApi(ctx: ModuleContext) {
	const dashboard = new DashboardService(ctx);

	return {
		getDashboardOverview: dashboard.getOverview.bind(dashboard),
		getCompanyFinancialOverview: dashboard.getCompanyFinancialOverview.bind(dashboard),
		getDashboardCharts: dashboard.getDashboardCharts.bind(dashboard),
		getProjectsProfitRanking: dashboard.getProjectsProfitRanking.bind(dashboard),
		getProjectsProfitCsv: dashboard.getProjectsProfitCsv.bind(dashboard),
		getProjectFinancialDetail: dashboard.getProjectFinancialDetail.bind(dashboard),
		getProjectDocumentsSummary: dashboard.getProjectDocumentsSummary.bind(dashboard)
	};
}

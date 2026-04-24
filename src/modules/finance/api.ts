import type { ModuleContext } from '../../lib/server/modules/types';
import { createFinanceLegacySources } from './adapters';
import { createFinanceBillingApi } from './billing';
import { createFinanceDocumentsApi } from './documents';
import { createFinanceExpensesApi } from './expenses';
import { createFinanceInsightsApi } from './insights';
import { createFinanceRevenueApi } from './revenue';
import { createFinanceTaxesApi } from './taxes';

export type FinanceApi = ReturnType<typeof createFinanceApi>;

export function createFinanceApi(ctx: ModuleContext) {
	const sources = createFinanceLegacySources(ctx);

	return {
		documents: createFinanceDocumentsApi(sources.documents),
		billing: createFinanceBillingApi(sources.billing),
		expenses: createFinanceExpensesApi(sources.expenses),
		revenue: createFinanceRevenueApi(sources.revenue),
		taxes: createFinanceTaxesApi(sources.taxes),
		insights: createFinanceInsightsApi(sources.insights)
	};
}

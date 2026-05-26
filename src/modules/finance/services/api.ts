import type { ModuleContext } from '$platform/modules/types';
import type { FinanceInboundContract } from '../contracts/inbound';
import { createFinanceBillingApi } from './billing-service';
import { createCategoryService } from './category-service';
import { createFinanceDocumentApi } from './document-service';
import { createFinanceEInvoiceApi } from './einvoice-service';
import { createFinanceExpenseApi } from './expense-service';
import { createFinanceInsightApi } from './insight-service';
import { createFinanceRevenueApi } from './revenue-service';
import { createFinanceTaxApi } from './tax-service';

export type FinanceApi = FinanceInboundContract;

export function createFinanceApi(ctx: ModuleContext): FinanceApi {
	return {
		documents: createFinanceDocumentApi(ctx),
		billing: createFinanceBillingApi(ctx),
		expenses: createFinanceExpenseApi(ctx),
		revenue: createFinanceRevenueApi(ctx),
		taxes: createFinanceTaxApi(ctx),
		insights: createFinanceInsightApi(ctx),
		categories: createCategoryService(ctx),
		einvoice: createFinanceEInvoiceApi(ctx)
	};
}

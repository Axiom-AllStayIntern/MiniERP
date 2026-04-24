import type { ArApi } from '../../lib/server/modules/ar/api';
import { createArApi } from '../../lib/server/modules/ar/api';
import type { ExpenseApi } from '../../lib/server/modules/expense/api';
import { createExpenseApi } from '../../lib/server/modules/expense/api';
import type { ReportingApi } from '../../lib/server/modules/reporting/api';
import { createReportingApi } from '../../lib/server/modules/reporting/api';
import type { TaxApi } from '../../lib/server/modules/tax/api';
import { createTaxApi } from '../../lib/server/modules/tax/api';
import type { ModuleContext } from '../../lib/server/modules/types';
import type {
	FinanceBillingSource,
	FinanceDocumentsSource,
	FinanceExpensesSource,
	FinanceInsightsSource,
	FinanceLegacySources,
	FinanceRevenueSource,
	FinanceTaxesSource
} from './contracts';

export function adaptArToFinanceDocumentsSource(ar: ArApi): FinanceDocumentsSource {
	return {
		saveProjectDocument: ar.saveProjectDocument,
		getContractDocHubPage: ar.getContractDocHubPage,
		getQuotationDocHubPage: ar.getQuotationDocHubPage,
		getPurchaseOrderDocHubPage: ar.getPurchaseOrderDocHubPage,
		getSupplierInvoiceDocHubPage: ar.getSupplierInvoiceDocHubPage,
		getContractDocumentDetail: ar.getContractDocumentDetail,
		updateContractDocument: ar.updateContractDocument,
		deleteContractDocument: ar.deleteContractDocument,
		getQuotationDocumentDetail: ar.getQuotationDocumentDetail,
		updateQuotationDocument: ar.updateQuotationDocument,
		deleteQuotationDocument: ar.deleteQuotationDocument,
		getPurchaseOrderDocumentDetail: ar.getPurchaseOrderDocumentDetail,
		updatePurchaseOrderDocument: ar.updatePurchaseOrderDocument,
		deletePurchaseOrderDocument: ar.deletePurchaseOrderDocument
	};
}

export function adaptArToFinanceBillingSource(ar: ArApi): FinanceBillingSource {
	return {
		createCustomerInvoice: ar.createCustomerInvoice,
		updateCustomerInvoiceDraft: ar.updateCustomerInvoiceDraft,
		getCustomerInvoiceDocHubPage: ar.getCustomerInvoiceDocHubPage,
		getCustomerInvoiceGeneratePage: ar.getCustomerInvoiceGeneratePage,
		getCustomerInvoicePreview: ar.getCustomerInvoicePreview,
		issueCustomerInvoicePdf: ar.issueCustomerInvoicePdf,
		importContractLinesToCustomerInvoice: ar.importContractLinesToCustomerInvoice,
		getCustomerInvoicesByProject: ar.getCustomerInvoicesByProject,
		getSupplierInvoicesByProject: ar.getSupplierInvoicesByProject,
		getProjectRevenue: ar.getProjectRevenue,
		getProjectPurchaseCost: ar.getProjectPurchaseCost
	};
}

export function adaptExpenseToFinanceExpensesSource(expense: ExpenseApi): FinanceExpensesSource {
	return {
		getExpenseListPage: expense.getExpenseListPage,
		createStandaloneExpense: expense.createStandaloneExpense,
		getStandaloneExpenseDetail: expense.getStandaloneExpenseDetail,
		updateStandaloneExpense: expense.updateStandaloneExpense,
		softDeleteStandaloneExpense: expense.softDeleteStandaloneExpense,
		getReimbursementsPage: expense.getReimbursementsPage,
		getExpenseUploadPage: expense.getExpenseUploadPage,
		getProjectExpensePage: expense.getProjectExpensePage,
		create: expense.create,
		getProjectExpenseDetail: expense.getProjectExpenseDetail,
		updateProjectExpense: expense.updateProjectExpense,
		softDeleteProjectExpense: expense.softDeleteProjectExpense,
		uploadExpense: expense.uploadExpense,
		listBusinessTrips: expense.listBusinessTrips,
		createBusinessTripWithAllowance: expense.createBusinessTripWithAllowance,
		getProjectExpenseSums: expense.getProjectExpenseSums
	};
}

export function adaptExpenseToFinanceRevenueSource(expense: ExpenseApi): FinanceRevenueSource {
	return {
		getProjectRevenuePage: expense.getProjectRevenuePage,
		createRevenue: expense.createRevenue,
		getProjectRevenueDocumentDetail: expense.getProjectRevenueDocumentDetail
	};
}

export function adaptTaxToFinanceTaxesSource(tax: TaxApi): FinanceTaxesSource {
	return {
		getGstManualBoxValues: tax.getGstManualBoxValues,
		saveGstManualBoxValues: tax.saveGstManualBoxValues,
		getGstReturnEstimate: tax.getGstReturnEstimate,
		getGstBoxDetail: tax.getGstBoxDetail,
		getCorporateTaxEstimate: tax.getCorporateTaxEstimate,
		getEmployeeTaxSummary: tax.getEmployeeTaxSummary
	};
}

export function adaptReportingToFinanceInsightsSource(reporting: ReportingApi): FinanceInsightsSource {
	return {
		getCompanyFinancialOverview: reporting.getCompanyFinancialOverview,
		getDashboardCharts: reporting.getDashboardCharts,
		getProjectsProfitRanking: reporting.getProjectsProfitRanking,
		getProjectsProfitCsv: reporting.getProjectsProfitCsv,
		getProjectFinancialDetail: reporting.getProjectFinancialDetail,
		getProjectDocumentsSummary: reporting.getProjectDocumentsSummary
	};
}

export function createFinanceLegacySources(ctx: ModuleContext): FinanceLegacySources {
	const ar = createArApi(ctx);
	const expense = createExpenseApi(ctx);
	const tax = createTaxApi(ctx);
	const reporting = createReportingApi(ctx);

	return {
		documents: adaptArToFinanceDocumentsSource(ar),
		billing: adaptArToFinanceBillingSource(ar),
		expenses: adaptExpenseToFinanceExpensesSource(expense),
		revenue: adaptExpenseToFinanceRevenueSource(expense),
		taxes: adaptTaxToFinanceTaxesSource(tax),
		insights: adaptReportingToFinanceInsightsSource(reporting)
	};
}

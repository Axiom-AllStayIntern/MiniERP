import type { ArApi } from '../../lib/server/modules/ar/api';
import type { ExpenseApi } from '../../lib/server/modules/expense/api';
import type { ReportingApi } from '../../lib/server/modules/reporting/api';
import type { TaxApi } from '../../lib/server/modules/tax/api';

export interface FinanceDocumentsSource {
	saveProjectDocument: ArApi['saveProjectDocument'];
	getContractDocHubPage: ArApi['getContractDocHubPage'];
	getQuotationDocHubPage: ArApi['getQuotationDocHubPage'];
	getPurchaseOrderDocHubPage: ArApi['getPurchaseOrderDocHubPage'];
	getSupplierInvoiceDocHubPage: ArApi['getSupplierInvoiceDocHubPage'];
	getContractDocumentDetail: ArApi['getContractDocumentDetail'];
	updateContractDocument: ArApi['updateContractDocument'];
	deleteContractDocument: ArApi['deleteContractDocument'];
	getQuotationDocumentDetail: ArApi['getQuotationDocumentDetail'];
	updateQuotationDocument: ArApi['updateQuotationDocument'];
	deleteQuotationDocument: ArApi['deleteQuotationDocument'];
	getPurchaseOrderDocumentDetail: ArApi['getPurchaseOrderDocumentDetail'];
	updatePurchaseOrderDocument: ArApi['updatePurchaseOrderDocument'];
	deletePurchaseOrderDocument: ArApi['deletePurchaseOrderDocument'];
}

export interface FinanceBillingSource {
	createCustomerInvoice: ArApi['createCustomerInvoice'];
	updateCustomerInvoiceDraft: ArApi['updateCustomerInvoiceDraft'];
	getCustomerInvoiceDocHubPage: ArApi['getCustomerInvoiceDocHubPage'];
	getCustomerInvoiceGeneratePage: ArApi['getCustomerInvoiceGeneratePage'];
	getCustomerInvoicePreview: ArApi['getCustomerInvoicePreview'];
	issueCustomerInvoicePdf: ArApi['issueCustomerInvoicePdf'];
	importContractLinesToCustomerInvoice: ArApi['importContractLinesToCustomerInvoice'];
	getCustomerInvoicesByProject: ArApi['getCustomerInvoicesByProject'];
	getSupplierInvoicesByProject: ArApi['getSupplierInvoicesByProject'];
	getProjectRevenue: ArApi['getProjectRevenue'];
	getProjectPurchaseCost: ArApi['getProjectPurchaseCost'];
}

export interface FinanceExpensesSource {
	getExpenseListPage: ExpenseApi['getExpenseListPage'];
	createStandaloneExpense: ExpenseApi['createStandaloneExpense'];
	getStandaloneExpenseDetail: ExpenseApi['getStandaloneExpenseDetail'];
	updateStandaloneExpense: ExpenseApi['updateStandaloneExpense'];
	softDeleteStandaloneExpense: ExpenseApi['softDeleteStandaloneExpense'];
	getReimbursementsPage: ExpenseApi['getReimbursementsPage'];
	getExpenseUploadPage: ExpenseApi['getExpenseUploadPage'];
	getProjectExpensePage: ExpenseApi['getProjectExpensePage'];
	create: ExpenseApi['create'];
	getProjectExpenseDetail: ExpenseApi['getProjectExpenseDetail'];
	updateProjectExpense: ExpenseApi['updateProjectExpense'];
	softDeleteProjectExpense: ExpenseApi['softDeleteProjectExpense'];
	uploadExpense: ExpenseApi['uploadExpense'];
	listBusinessTrips: ExpenseApi['listBusinessTrips'];
	createBusinessTripWithAllowance: ExpenseApi['createBusinessTripWithAllowance'];
	getProjectExpenseSums: ExpenseApi['getProjectExpenseSums'];
}

export interface FinanceRevenueSource {
	getProjectRevenuePage: ExpenseApi['getProjectRevenuePage'];
	createRevenue: ExpenseApi['createRevenue'];
	getProjectRevenueDocumentDetail: ExpenseApi['getProjectRevenueDocumentDetail'];
}

export interface FinanceTaxesSource {
	getGstManualBoxValues: TaxApi['getGstManualBoxValues'];
	saveGstManualBoxValues: TaxApi['saveGstManualBoxValues'];
	getGstReturnEstimate: TaxApi['getGstReturnEstimate'];
	getGstBoxDetail: TaxApi['getGstBoxDetail'];
	getCorporateTaxEstimate: TaxApi['getCorporateTaxEstimate'];
	getEmployeeTaxSummary: TaxApi['getEmployeeTaxSummary'];
}

export interface FinanceInsightsSource {
	getCompanyFinancialOverview: ReportingApi['getCompanyFinancialOverview'];
	getDashboardCharts: ReportingApi['getDashboardCharts'];
	getProjectsProfitRanking: ReportingApi['getProjectsProfitRanking'];
	getProjectsProfitCsv: ReportingApi['getProjectsProfitCsv'];
	getProjectFinancialDetail: ReportingApi['getProjectFinancialDetail'];
	getProjectDocumentsSummary: ReportingApi['getProjectDocumentsSummary'];
}

export interface FinanceLegacySources {
	documents: FinanceDocumentsSource;
	billing: FinanceBillingSource;
	expenses: FinanceExpensesSource;
	revenue: FinanceRevenueSource;
	taxes: FinanceTaxesSource;
	insights: FinanceInsightsSource;
}

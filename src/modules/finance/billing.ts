import type { FinanceBillingSource } from './contracts';

export function createFinanceBillingApi(source: FinanceBillingSource) {
	return {
		createCustomerInvoice: source.createCustomerInvoice,
		updateCustomerInvoiceDraft: source.updateCustomerInvoiceDraft,
		getCustomerInvoiceDocHubPage: source.getCustomerInvoiceDocHubPage,
		getCustomerInvoiceGeneratePage: source.getCustomerInvoiceGeneratePage,
		getCustomerInvoicePreview: source.getCustomerInvoicePreview,
		issueCustomerInvoicePdf: source.issueCustomerInvoicePdf,
		importContractLinesToCustomerInvoice: source.importContractLinesToCustomerInvoice,
		getCustomerInvoicesByProject: source.getCustomerInvoicesByProject,
		getSupplierInvoicesByProject: source.getSupplierInvoicesByProject,
		getProjectRevenue: source.getProjectRevenue,
		getProjectPurchaseCost: source.getProjectPurchaseCost
	};
}

export type FinanceBillingApi = ReturnType<typeof createFinanceBillingApi>;

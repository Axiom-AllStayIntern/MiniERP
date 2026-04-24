import type { FinanceDocumentsSource } from './contracts';

export function createFinanceDocumentsApi(source: FinanceDocumentsSource) {
	return {
		saveProjectDocument: source.saveProjectDocument,
		getContractDocHubPage: source.getContractDocHubPage,
		getQuotationDocHubPage: source.getQuotationDocHubPage,
		getPurchaseOrderDocHubPage: source.getPurchaseOrderDocHubPage,
		getSupplierInvoiceDocHubPage: source.getSupplierInvoiceDocHubPage,
		getContractDocumentDetail: source.getContractDocumentDetail,
		updateContractDocument: source.updateContractDocument,
		deleteContractDocument: source.deleteContractDocument,
		getQuotationDocumentDetail: source.getQuotationDocumentDetail,
		updateQuotationDocument: source.updateQuotationDocument,
		deleteQuotationDocument: source.deleteQuotationDocument,
		getPurchaseOrderDocumentDetail: source.getPurchaseOrderDocumentDetail,
		updatePurchaseOrderDocument: source.updatePurchaseOrderDocument,
		deletePurchaseOrderDocument: source.deletePurchaseOrderDocument
	};
}

export type FinanceDocumentsApi = ReturnType<typeof createFinanceDocumentsApi>;

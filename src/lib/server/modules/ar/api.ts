import type { ModuleContext } from '../types';
import { InvoiceService, PaymentService, DocumentLinkService, ArDocumentService } from './service';

export type ArApi = ReturnType<typeof createArApi>;

export function createArApi(ctx: ModuleContext) {
	const invoice = new InvoiceService(ctx);
	const payment = new PaymentService(ctx);
	const docLink = new DocumentLinkService(ctx);
	const arDocument = new ArDocumentService(ctx);

	return {
		// Customer invoices
		createCustomerInvoice: invoice.createCustomerInvoice.bind(invoice),
		updateCustomerInvoice: invoice.updateCustomerInvoice.bind(invoice),
		confirmInvoice: invoice.confirmInvoice.bind(invoice),
		getProjectRevenue: invoice.getProjectRevenue.bind(invoice),
		getProjectPurchaseCost: invoice.getProjectPurchaseCost.bind(invoice),
		getCustomerInvoicesByProject: invoice.getCustomerInvoicesByProject.bind(invoice),
		getSupplierInvoicesByProject: invoice.getSupplierInvoicesByProject.bind(invoice),
		getContractDocumentDetail: arDocument.getContractDocumentDetail.bind(arDocument),
		updateContractDocument: arDocument.updateContractDocument.bind(arDocument),
		deleteContractDocument: arDocument.deleteContractDocument.bind(arDocument),
		getQuotationDocumentDetail: arDocument.getQuotationDocumentDetail.bind(arDocument),
		updateQuotationDocument: arDocument.updateQuotationDocument.bind(arDocument),
		deleteQuotationDocument: arDocument.deleteQuotationDocument.bind(arDocument),
		getPurchaseOrderDocumentDetail: arDocument.getPurchaseOrderDocumentDetail.bind(arDocument),
		updatePurchaseOrderDocument: arDocument.updatePurchaseOrderDocument.bind(arDocument),
		deletePurchaseOrderDocument: arDocument.deletePurchaseOrderDocument.bind(arDocument),
		// GST helper
		calculateGst: InvoiceService.calculateGst,
		// Payments
		recordPayment: payment.recordPayment.bind(payment),
		getPaymentsByInvoice: payment.getByInvoice.bind(payment),
		getPaymentsByProject: payment.getByProject.bind(payment),
		// Document links
		linkDocuments: docLink.linkDocuments.bind(docLink),
		getLinkedDocuments: docLink.getLinkedDocuments.bind(docLink)
	};
}

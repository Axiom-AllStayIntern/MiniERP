import type { ModuleContext } from '$platform/modules/types';
import { BillingRepository } from '../repositories';

/**
 * Finance billing aggregations exposed to project-financials and dashboard
 * consumers.
 *
 * Wave 2.1c removed the v3-era manual customer-invoice draft/publish/PDF flow
 * (createCustomerInvoice / updateCustomerInvoiceDraft / issueCustomerInvoicePdf
 * / importContractLinesToCustomerInvoice / getCustomerInvoiceDocHubPage /
 * getCustomerInvoiceGeneratePage / getCustomerInvoicePreview) along with the
 * underlying invoices_out table. Customer invoices are now produced via the
 * AI-driven `financial-document-intake` workflow, which writes the canonical
 * `revenue` rows directly. Supplier-invoice intake similarly writes
 * `expenses`. See ref_files/v4/SmartFin_Migration_Plan.md Wave 2.1c.
 */
export function createFinanceBillingApi(ctx: ModuleContext) {
	const billingRepository = new BillingRepository(ctx.db);

	const getCustomerInvoicesByProject = async (projectId: string) =>
		billingRepository.findCustomerInvoicesByProject(projectId);

	const getSupplierInvoicesByProject = async (projectId: string) =>
		billingRepository.findSupplierInvoicesByProject(projectId);

	const getProjectRevenue = async (projectId: string) =>
		billingRepository.getProjectRevenue(projectId);

	const getProjectPurchaseCost = async (projectId: string) =>
		billingRepository.getProjectPurchaseCost(projectId);

	return {
		getCustomerInvoicesByProject,
		getSupplierInvoicesByProject,
		getProjectRevenue,
		getProjectPurchaseCost
	};
}

export type FinanceBillingApi = ReturnType<typeof createFinanceBillingApi>;

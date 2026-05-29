import { createBusinessPartnerApi } from '$modules/business-partner';
import type { ModuleContext } from '$platform/modules/types';

export type ProcurementApi = ReturnType<typeof createProcurementApi>;

export function createProcurementApi(ctx: ModuleContext) {
	const businessPartner = createBusinessPartnerApi(ctx);

	return {
		listSuppliers: businessPartner.listSuppliers,
		listPartnerContacts: businessPartner.listPartnerContacts,
		getSupplierDetail: businessPartner.getSupplierDetail,
		createSupplier: businessPartner.createSupplier,
		updateSupplierWithContacts: businessPartner.updateSupplierWithContacts,
		deleteSupplier: businessPartner.deleteById
	};
}

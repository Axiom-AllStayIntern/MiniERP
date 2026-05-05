import type { ModuleContext } from '$platform/modules/types';
import { BusinessPartnerService } from './service';

export type BusinessPartnerApi = ReturnType<typeof createBusinessPartnerApi>;

export function createBusinessPartnerApi(ctx: ModuleContext) {
	const svc = new BusinessPartnerService(ctx);

	return {
		getById: svc.getById.bind(svc),
		listByType: svc.listByType.bind(svc),
		listSuppliers: svc.listSuppliers.bind(svc),
		listPartnerContacts: svc.listPartnerContacts.bind(svc),
		getSupplierDetail: svc.getSupplierDetail.bind(svc),
		search: svc.search.bind(svc),
		create: svc.create.bind(svc),
		update: svc.update.bind(svc),
		createSupplier: svc.createSupplier.bind(svc),
		updateSupplierWithContacts: svc.updateSupplierWithContacts.bind(svc),
		// Legacy
		getCustomerById: svc.getCustomerById.bind(svc),
		listCustomers: svc.listCustomers.bind(svc),
		listCustomerOptions: svc.listCustomerOptions.bind(svc),
		listCustomerDirectory: svc.listCustomerDirectory.bind(svc),
		createCustomer: svc.createCustomer.bind(svc)
	};
}

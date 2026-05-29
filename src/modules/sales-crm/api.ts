import { createBusinessPartnerApi } from '$modules/business-partner';
import type { ModuleContext } from '$platform/modules/types';

export type SalesCrmApi = ReturnType<typeof createSalesCrmApi>;

export function createSalesCrmApi(ctx: ModuleContext) {
	const businessPartner = createBusinessPartnerApi(ctx);

	return {
		getCustomerById: businessPartner.getCustomerById,
		listCustomers: businessPartner.listCustomers,
		listCustomerOptions: businessPartner.listCustomerOptions,
		listCustomerDirectory: businessPartner.listCustomerDirectory,
		createCustomer: businessPartner.createCustomer,
		deleteCustomer: businessPartner.deleteById
	};
}

import type { ModuleContext } from '$platform/modules/types';
import { ProcurementService } from './service';

export type ProcurementApi = ReturnType<typeof createProcurementApi>;

export function createProcurementApi(ctx: ModuleContext) {
	const svc = new ProcurementService(ctx);

	return {
		listSuppliers: svc.listSuppliers.bind(svc),
		listPartnerContacts: svc.listPartnerContacts.bind(svc),
		getSupplierDetail: svc.getSupplierDetail.bind(svc),
		getSupplierScorecard: svc.getSupplierScorecard.bind(svc),
		listSupplierEvaluations: svc.listSupplierEvaluations.bind(svc),
		createSupplierEvaluation: svc.createSupplierEvaluation.bind(svc),
		createSupplier: svc.createSupplier.bind(svc),
		updateSupplierWithContacts: svc.updateSupplierWithContacts.bind(svc),
		deleteSupplier: svc.deleteSupplier.bind(svc)
	};
}

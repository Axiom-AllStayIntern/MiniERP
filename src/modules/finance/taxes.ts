import type { FinanceTaxesSource } from './contracts';

export function createFinanceTaxesApi(source: FinanceTaxesSource) {
	return {
		getGstManualBoxValues: source.getGstManualBoxValues,
		saveGstManualBoxValues: source.saveGstManualBoxValues,
		getGstReturnEstimate: source.getGstReturnEstimate,
		getGstBoxDetail: source.getGstBoxDetail,
		getCorporateTaxEstimate: source.getCorporateTaxEstimate,
		getEmployeeTaxSummary: source.getEmployeeTaxSummary
	};
}

export type FinanceTaxesApi = ReturnType<typeof createFinanceTaxesApi>;

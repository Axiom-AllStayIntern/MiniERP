import type { ModuleContext } from '$platform/modules/types';
import {
	CorporateTaxService,
	GstService,
	IncomeTaxService,
	TimeLogService,
	estimateSingaporeResidentTax
} from './service';

export type TaxApi = ReturnType<typeof createTaxApi>;

export function createTaxApi(ctx: ModuleContext) {
	const gst = new GstService(ctx);
	const corporateTax = new CorporateTaxService(ctx);
	const incomeTax = new IncomeTaxService(ctx);
	const timeLog = new TimeLogService(ctx);

	return {
		// GST
		getGstReturn: gst.getReturn.bind(gst),
		getGstManualBoxValues: gst.getManualBoxValues.bind(gst),
		saveGstManualBoxValues: gst.saveManualBoxValues.bind(gst),
		getGstReturnEstimate: gst.getReturnEstimate.bind(gst),
		getGstBoxDetail: gst.getBoxDetail.bind(gst),
		// Corporate tax
		getCorporateTaxEstimate: corporateTax.getEstimate.bind(corporateTax),
		// Income tax
		getPersonIncome: incomeTax.getPersonIncome.bind(incomeTax),
		getEmployeeTaxSummary: incomeTax.getEmployeeTaxSummary.bind(incomeTax),
		estimateResidentTax: incomeTax.estimateResidentTax.bind(incomeTax),
		estimateSingaporeResidentTax,
		// Time logs
		getTimeLogs: timeLog.getByPersonAndProject.bind(timeLog),
		createTimeLog: timeLog.create.bind(timeLog)
	};
}

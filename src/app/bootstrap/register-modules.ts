/**
 * Application composition root for active module registration.
 *
 * The platform registry owns only the generic registration mechanism; concrete
 * module selection belongs to the app layer.
 */
import { businessPartnerModule } from '$modules/business-partner';
import { coreModule } from '$platform/core';
import { documentIntakeModule } from '$modules/document-intake';
import { financeModule } from '$modules/finance';
import { hrModule } from '$modules/hr';
import { procurementModule } from '$modules/procurement';
import { projectModule } from '$modules/project';
import { registerModules } from '$platform/registry/register-all';
import { salesCrmModule } from '$modules/sales-crm';

// Business partner remains the shared counterparty data foundation; Procurement
// and Sales CRM now expose supplier/customer workspaces as separate modules.
registerModules([
	coreModule,
	businessPartnerModule,
	procurementModule,
	salesCrmModule,
	projectModule,
	hrModule,
	financeModule,
	documentIntakeModule
]);

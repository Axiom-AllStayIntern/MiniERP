/**
 * Application composition root for active module registration.
 *
 * The platform registry owns only the generic registration mechanism; concrete
 * module selection belongs to the app layer.
 */
import { businessPartnerModule } from '$modules/business-partner';
import { coreModule } from '$platform/core';
import { arModule } from '$modules/legacy/server-modules/ar';
import { reportingModule } from '$modules/legacy/server-modules/reporting';
import { documentIntakeModule } from '$modules/document-intake';
import { financeModule } from '$modules/finance';
import { employeeModule, personModule } from '$modules/hr';
import { projectModule } from '$modules/project';
import { registerModules } from '$platform/registry/register-all';

// Register in dependency order; the registry itself remains order-tolerant.
registerModules([
	coreModule,
	personModule,
	businessPartnerModule,
	projectModule,
	financeModule,
	arModule,
	employeeModule,
	reportingModule,
	documentIntakeModule
]);

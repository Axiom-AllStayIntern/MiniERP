/**
 * Central module registration imports all active module definitions and
 * registers them with the global registry.
 *
 * Import this file once at app startup to make all modules available to
 * createModuleContext().
 */
import { coreModule } from '../../lib/server/modules/core';
import { businessPartnerModule } from '../../lib/server/modules/business-partner';
import { arModule } from '../../lib/server/modules/ar';
import { expenseModule } from '../../lib/server/modules/expense';
import { taxModule } from '../../lib/server/modules/tax';
import { reportingModule } from '../../lib/server/modules/reporting';
import { documentIntakeModule } from '../../modules/document-intake';
import { employeeModule, personModule } from '../../modules/hr';
import { projectModule } from '../../modules/project';
import { registry } from './index';

// Register in dependency order; the registry itself remains order-tolerant.
registry.register(coreModule);
registry.register(personModule);
registry.register(businessPartnerModule);
registry.register(projectModule);
registry.register(arModule);
registry.register(employeeModule);
registry.register(expenseModule);
registry.register(taxModule);
registry.register(reportingModule);
registry.register(documentIntakeModule);

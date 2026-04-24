/**
 * Central module registration — imports all module definitions
 * and registers them with the global registry.
 *
 * Import this file once at app startup (e.g., in hooks.server.ts)
 * to make all modules available to createModuleContext().
 */
import { registry } from './registry';

import { coreModule } from './core';
import { personModule } from './person';
import { businessPartnerModule } from './business-partner';
import { projectModule } from './project';
import { arModule } from './ar';
import { employeeModule } from './employee';
import { expenseModule } from './expense';
import { taxModule } from './tax';
import { reportingModule } from './reporting';
import { documentIntakeModule } from './document-intake';

// Register in dependency order (though the registry handles any order)
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

/**
 * Barrel re-export of all module schemas.
 *
 * This file preserves backward compatibility so that existing code
 * importing `import { schema } from '$lib/server/db'` (via index.ts)
 * or `import * as schema from '$lib/server/db/schema'` continues to work.
 *
 * The actual table definitions now live in per-module schema files
 * under src/lib/server/modules/{module}/schema.ts
 */

// Core module
export {
	users,
	auditLogs,
	companySettings,
	uploadIdempotency,
	uploadFileDedup
} from '../modules/core/schema';

// better-auth tables (sessions, accounts, verifications)
export { sessions, accounts, verifications } from '../auth/auth-tables';

// Person module (includes legacy employees table)
export {
	persons,
	personRoles,
	employeeProfiles,
	shareholderProfiles,
	freelancerProfiles,
	employees
} from '../modules/person/schema';

// Business Partner module (includes legacy customers table)
export {
	businessPartners,
	partnerSupplierProfiles,
	partnerCustomerProfiles,
	customers
} from '../modules/business-partner/schema';

// Project module
export { projects, projectEmployees } from '../modules/project/schema';

// AR module
export {
	contracts,
	quotations,
	invoicesOut,
	purchaseOrders,
	invoicesIn,
	payments,
	arDocumentLinks
} from '../modules/ar/schema';

// Employee module
export {
	employeeSalaries,
	employeeCompensationComponents,
	employeeProjectAllocations,
	compensationComponents,
	payoutRecords
} from '../modules/employee/schema';

// Expense module
export { documents, businessTrips, expenses, revenue, expenseCategories } from '../modules/expense/schema';

// Tax module
export { gstReturns, personIncome, timeLogs } from '../modules/tax/schema';

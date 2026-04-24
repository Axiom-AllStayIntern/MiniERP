/**
 * Target-layer schema barrel.
 *
 * Table definitions still live with their owning legacy modules during the
 * migration, but infrastructure/db is now the active schema assembly point.
 */

// Core module
export {
	users,
	auditLogs,
	companySettings,
	uploadIdempotency,
	uploadFileDedup
} from '../../lib/server/modules/core/schema';

// better-auth tables (sessions, accounts, verifications)
export { sessions, accounts, verifications } from '../../lib/server/auth/auth-tables';

// Person module (includes legacy employees table)
export {
	persons,
	personRoles,
	employeeProfiles,
	shareholderProfiles,
	freelancerProfiles,
	employees
} from '../../lib/server/modules/person/schema';

// Business Partner module (includes legacy customers table)
export {
	businessPartners,
	partnerSupplierProfiles,
	partnerCustomerProfiles,
	partnerContacts,
	customers
} from '../../lib/server/modules/business-partner/schema';

// Project module
export { projects, projectEmployees } from '../../lib/server/modules/project/schema';

// AR module
export {
	contracts,
	quotations,
	invoicesOut,
	purchaseOrders,
	invoicesIn,
	payments,
	arDocumentLinks
} from '../../lib/server/modules/ar/schema';

// Employee module
export {
	employeeSalaries,
	employeeCompensationComponents,
	employeeProjectAllocations,
	compensationComponents,
	payoutRecords
} from '../../lib/server/modules/employee/schema';

// Expense module
export {
	documents,
	businessTrips,
	expenses,
	revenue,
	expenseCategories
} from '../../lib/server/modules/expense/schema';

// Tax module
export { gstReturns, personIncome, timeLogs } from '../../lib/server/modules/tax/schema';

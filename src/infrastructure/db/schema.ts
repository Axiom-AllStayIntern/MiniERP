/**
 * Target-layer schema barrel.
 *
 * Table definitions still live with their owning legacy modules during the
 * migration, but infrastructure/db is now the active schema assembly point.
 */

// Core platform tables (split across platform & infrastructure)
export { users } from '$platform/auth/users.schema';
export { auditLogs } from '$platform/audit/audit-log.schema';
export { companySettings } from '$platform/config/company-settings.schema';
export { uploadIdempotency, uploadFileDedup } from '$infrastructure/storage/upload-guards.schema';

// better-auth tables (sessions, accounts, verifications)
export { sessions, accounts, verifications } from '../../platform/auth/auth-tables';

// Person module (includes legacy employees table)
export {
	persons,
	personRoles,
	employeeProfiles,
	shareholderProfiles,
	freelancerProfiles,
	employees
} from '$modules/legacy/server-modules/person/schema';

// Business Partner module (includes legacy customers table)
export {
	businessPartners,
	partnerSupplierProfiles,
	partnerCustomerProfiles,
	partnerContacts,
	customers
} from '$modules/business-partner/repositories/business-partner.schema';

// Project module
export { projects, projectEmployees } from '$modules/legacy/server-modules/project/schema';

// AR module
export {
	contracts,
	quotations,
	invoicesOut,
	purchaseOrders,
	invoicesIn,
	payments,
	arDocumentLinks
} from '$modules/legacy/server-modules/ar/schema';

// Employee module
export {
	employeeSalaries,
	employeeCompensationComponents,
	employeeProjectAllocations,
	compensationComponents,
	payoutRecords
} from '$modules/legacy/server-modules/employee/schema';

// Expense module
export {
	documents,
	businessTrips,
	expenses,
	revenue,
	expenseCategories
} from '$modules/legacy/server-modules/expense/schema';

// Tax module
export { gstReturns, personIncome, timeLogs } from '$modules/legacy/server-modules/tax/schema';

// Document Intake module (target-layer artifact storage)
export { documentArtifacts } from '../../modules/document-intake/repositories/document-artifact.schema';

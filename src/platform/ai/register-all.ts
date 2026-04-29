/**
 * Side-effect import: registers Finance Agent capabilities into the platform
 * capability registry at app startup. Imported once from `hooks.server.ts`.
 *
 * Each capability declares its own risk level and description; the platform
 * registry layers on the manifest fields the tool-policy check needs
 * (allowedAgents / requiredUserPermissions / requiresConfirmation / audit).
 */
import { financeAgentAllowedCapabilities } from '../../modules/finance/agent';
import {
	detectDuplicateCapability,
	extractInvoiceFieldsCapability,
	matchPurchaseOrderCapability,
	matchSupplierCapability,
	suggestNextFinanceTaskCapability,
	validateExpenseDraftCapability,
	type FinanceCapability
} from '../../modules/finance/capabilities';
import { classifyDocumentCapability } from '../../modules/document-intake/capabilities/classify-document';
import { registerCapability } from './capability-registry';

const FINANCE_AGENT_ID = 'finance-agent';

const FINANCE_CAPABILITIES: ReadonlyArray<FinanceCapability<unknown, unknown>> = [
	extractInvoiceFieldsCapability as FinanceCapability<unknown, unknown>,
	matchSupplierCapability as FinanceCapability<unknown, unknown>,
	matchPurchaseOrderCapability as FinanceCapability<unknown, unknown>,
	detectDuplicateCapability as FinanceCapability<unknown, unknown>,
	validateExpenseDraftCapability as FinanceCapability<unknown, unknown>,
	suggestNextFinanceTaskCapability as FinanceCapability<unknown, unknown>
];

for (const capability of FINANCE_CAPABILITIES) {
	const policyEntry = financeAgentAllowedCapabilities.find((entry) => entry.id === capability.id);
	if (!policyEntry) {
		throw new Error(
			`No policy entry for finance capability ${capability.id}. Update finance/agent/policy.ts.`
		);
	}
	registerCapability(
		{
			id: capability.id,
			ownerModule: 'finance',
			description: capability.description,
			riskLevel: policyEntry.riskLevel,
			allowedAgents: [FINANCE_AGENT_ID],
			requiredUserPermissions: policyEntry.requiredUserPermissions,
			requiresConfirmation: policyEntry.requiresConfirmation,
			auditRequired: true,
			enabled: true
		},
		capability
	);
}

// Document Intake capabilities. Phase 2 only ships classify-document; the
// document-intake service calls it directly today, but pre-registering it
// against the platform registry means the future Document Agent (Phase 6)
// can dispatch it through the same tool-policy gate Finance Agent uses.
registerCapability(
	{
		id: classifyDocumentCapability.id,
		ownerModule: 'document-intake',
		description: classifyDocumentCapability.description,
		riskLevel: classifyDocumentCapability.riskLevel,
		allowedAgents: ['document-agent'],
		requiredUserPermissions: ['finance:view'],
		requiresConfirmation: false,
		auditRequired: true,
		enabled: true
	},
	classifyDocumentCapability as FinanceCapability<unknown, unknown>
);

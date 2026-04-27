import { financeAppSurface } from './app';
import { financeCapabilities, financeCapabilityIds } from './capabilities';
import { financeManifestV2 } from './config';
import * as financeContracts from './contracts/index';
import * as financeEvents from './events';
import * as financePolicies from './policies';
import * as financeRepositories from './repositories';
import * as financeRules from './rules';
import * as financeServices from './services';
import { financeWorkflows, financeWorkflowIds } from './workflows';

export { createFinanceApi, type FinanceApi } from './services/api';
export {
	financeAgentActionSets,
	financeAllAgentActions,
	type FinanceAgentActionSets
} from './capabilities/agent-actions';
export type { FinanceBillingApi } from './services/billing-service';
export type { FinanceDocumentsApi } from './services/document-service';
export type { FinanceExpensesApi } from './services/expense-service';
export type { FinanceInsightsApi } from './services/insight-service';
export type { FinanceRevenueApi } from './services/revenue-service';
export type { FinanceTaxesApi } from './services/tax-service';
export type { FinanceInboundContract, FinancePublicGroup } from './contracts/inbound';
export { FINANCE_PUBLIC_GROUPS } from './contracts/inbound';
export { financeAppSurface };
export { financeWorkflows, financeWorkflowIds };
export { financeCapabilities, financeCapabilityIds };
export { createFinanceTaskService, type FinanceTaskService } from './services/finance-task-service';
export { financeManifestV2 };
export {
	financeContracts,
	financeServices,
	financeRules,
	financeRepositories,
	financePolicies,
	financeEvents
};

export const financePublicSurface = {
	manifest: financeManifestV2,
	contracts: financeContracts,
	capabilities: financeCapabilities,
	workflows: financeWorkflows,
	services: financeServices,
	app: financeAppSurface
};

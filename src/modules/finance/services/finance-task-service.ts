import { financeCapabilities, financeCapabilityIds } from '../capabilities';
import { financeWorkflows, financeWorkflowIds } from '../workflows';

export function createFinanceTaskService() {
	return {
		listWorkflowIds: () => [...financeWorkflowIds],
		listCapabilityIds: () => [...financeCapabilityIds],
		getWorkflowDefinitions: () => financeWorkflows,
		getCapabilityDefinitions: () => financeCapabilities
	};
}

export type FinanceTaskService = ReturnType<typeof createFinanceTaskService>;

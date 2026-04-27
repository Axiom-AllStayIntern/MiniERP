import type { ModuleManifestV2 } from '../../../platform/registry/contracts';
import { financeDashboardCards, financeNavigationEntries, financeWorkspaceEntries } from '../app';
import { financeCapabilityIds } from '../capabilities';
import { financeEventContracts } from '../contracts/events';
import { financeInboundContracts } from '../contracts/inbound';
import { financeOutboundContracts } from '../contracts/outbound';
import { financeWorkflowIds } from '../workflows';

export const financeManifestV2: ModuleManifestV2 = {
	id: 'finance',
	name: 'Finance',
	layer: 'base',
	deliveryModes: ['standalone', 'suite'],
	dependencies: [
		{
			moduleId: 'core',
			strength: 'strong',
			description: 'Finance requires core platform capabilities',
			failurePolicy: 'block'
		},
		{
			moduleId: 'project',
			strength: 'weak',
			description: 'Finance enriches records with project lookups',
			failurePolicy: 'degrade'
		},
		{
			moduleId: 'person',
			strength: 'weak',
			description: 'Finance enriches records with employee and person lookups',
			failurePolicy: 'degrade'
		}
	],
	routes: [...financeNavigationEntries],
	workspaces: financeWorkspaceEntries.map((entry) => entry.id),
	permissions: ['finance:view', 'finance:edit', 'finance:tax'],
	taskTypes: ['finance-task'],
	workflows: [...financeWorkflowIds],
	dashboardCards: [...financeDashboardCards],
	aiCapabilities: [...financeCapabilityIds],
	contract: {
		inbound: financeInboundContracts,
		outbound: financeOutboundContracts,
		events: financeEventContracts
	}
};

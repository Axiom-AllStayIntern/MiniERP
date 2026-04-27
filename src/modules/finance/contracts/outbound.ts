import type { OutboundContract } from '../../../platform/registry/contracts';

export const financeOutboundContracts: OutboundContract[] = [
	{
		id: 'finance.project_lookup',
		provider: 'module',
		providerId: 'project',
		strength: 'weak',
		description: 'Project lookup enrichment for finance records',
		failurePolicy: 'degrade',
		failures: ['not_found', 'unavailable', 'timeout']
	},
	{
		id: 'finance.employee_lookup',
		provider: 'module',
		providerId: 'person',
		strength: 'weak',
		description: 'Employee summary lookup for finance records',
		failurePolicy: 'degrade',
		failures: ['not_found', 'unavailable', 'timeout']
	},
	{
		id: 'finance.file_storage',
		provider: 'platform',
		providerId: 'files',
		strength: 'strong',
		description: 'File storage and artifact access for finance documents',
		failurePolicy: 'block',
		failures: ['unavailable', 'timeout', 'invalid_response']
	},
	{
		id: 'finance.permission_check',
		provider: 'platform',
		providerId: 'permissions',
		strength: 'strong',
		description: 'Permission checks for finance operations',
		failurePolicy: 'block',
		failures: ['permission_denied', 'unavailable']
	}
];

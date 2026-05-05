import type { AgentAction } from '$platform/ai/legacy-agent/types';
import type { ModuleDefinition } from '$platform/modules/types';
import { registerEmployeeHandlers, registerPersonHandlers } from './handlers';

export const employeeModule: ModuleDefinition = {
	manifest: {
		id: 'employee',
		name: 'HR',
		layer: 'base',
		dependencies: ['core', 'person', 'project']
	},
	registerHandlers: registerEmployeeHandlers
};

export const personModule: ModuleDefinition = {
	manifest: {
		id: 'person',
		name: 'Person',
		layer: 'base',
		dependencies: ['core']
	},
	registerHandlers: registerPersonHandlers
};

export { createHrApi, type HrApi } from './api';
export { createEmployeeApi, type EmployeeApi } from './employee-api';
export { createPersonApi, type PersonApi } from './person-api';
export {
	staffCostPayoutStatuses,
	staffCostExcludedIncomeTypes,
	staffCostPayoutJoinConditions,
	staffCostSumExpr,
	staffCostPeriodBetween,
	allocationPeriodDay,
	periodCalendarMonth,
	shadowCompensationComponentId,
	runSettleManualProjectComponentsForMonth,
	settleCompanyAllocationMonth
} from './compat';
export type { HrDirectorySource, HrLegacySources, HrPeopleSource } from './contracts';

export const employeeActions: AgentAction[] = [
	{
		id: 'view_employees',
		module: 'employee',
		description: 'View the employee directory',
		keywords: ['employees', 'staff list', 'HR roster'],
		entry: '/employees',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'create_employee',
		module: 'employee',
		description: 'Create an employee record',
		keywords: ['new employee', 'create staff', 'hire', 'add employee'],
		entry: '/employees/new',
		layer: 2,
		required_roles: ['owner', 'finance'],
		params: [
			{ name: 'name', type: 'string', required: true, description: 'Employee name' },
			{
				name: 'type',
				type: 'string',
				required: false,
				description: 'Employment type: full_time / part_time / freelancer / advisor'
			},
			{
				name: 'start_date',
				type: 'date',
				required: false,
				description: 'Start date (YYYY-MM-DD, or "today")'
			},
			{ name: 'end_date', type: 'date', required: false, description: 'End date (YYYY-MM-DD)' },
			{ name: 'contact', type: 'string', required: false, description: 'Contact / email' },
			{ name: 'tax_id', type: 'string', required: false, description: 'Tax ID' }
		]
	}
];

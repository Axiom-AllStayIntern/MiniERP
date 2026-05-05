import type { ModuleDefinition } from '$platform/modules/types';
import { registerExpenseHandlers } from './handlers';
import type { AgentAction } from '$platform/ai/legacy-agent/types';

export const expenseModule: ModuleDefinition = {
	manifest: {
		id: 'expense',
		name: 'Expense',
		layer: 'base',
		dependencies: ['core', 'project']
	},
	registerHandlers: registerExpenseHandlers
};

export { createExpenseApi, type ExpenseApi } from './api';

export const expenseActions: AgentAction[] = [
	{
		id: 'view_expense_claims',
		module: 'expense',
		description: 'View expense records (Operating Expenses and Sales Cost)',
		keywords: ['expense', 'cost', 'opex', 'sales cost', 'spend'],
		entry: '/expenses',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager', 'employee']
	},
	{
		id: 'create_expense_record',
		module: 'expense',
		description: 'Record an expense (saved immediately; no draft workflow)',
		keywords: ['new expense', 'record expense', 'log expense', 'upload expense'],
		entry: '/expenses/upload',
		layer: 3,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{ name: 'project_id', type: 'string', required: false, description: 'Project ID (optional)', extract_from_context: true },
			{ name: 'amount', type: 'number', required: false, description: 'Expense amount' }
		]
	}
];

import type { ModuleDefinition } from '../types';
import { registerExpenseHandlers } from './handlers';
import type { AgentAction } from '$lib/server/agent/types';

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
		description: '查看项目费用与报销记录',
		keywords: ['报销', '费用记录', 'expense', 'claims'],
		entry: '/projects',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager', 'employee']
	},
	{
		id: 'create_expense_record',
		module: 'expense',
		description: '创建费用草稿记录并进入确认页面',
		keywords: ['创建费用', '新增报销', 'new expense', 'expense draft'],
		entry: '/projects',
		layer: 3,
		required_roles: ['owner', 'finance', 'project_manager', 'employee'],
		params: [
			{ name: 'project_id', type: 'string', required: true, description: '项目ID', extract_from_context: true },
			{ name: 'amount', type: 'number', required: false, description: '费用金额' }
		]
	}
];

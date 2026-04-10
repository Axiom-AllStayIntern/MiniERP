import type { ModuleDefinition } from '../types';
import { registerEmployeeHandlers } from './handlers';
import type { AgentAction } from '$lib/server/agent/types';

export const employeeModule: ModuleDefinition = {
	manifest: {
		id: 'employee',
		name: 'Employee',
		layer: 'base',
		dependencies: ['core', 'person', 'project']
	},
	registerHandlers: registerEmployeeHandlers
};

export { createEmployeeApi, type EmployeeApi } from './api';

export const employeeActions: AgentAction[] = [
	{
		id: 'view_employees',
		module: 'employee',
		description: '查看员工档案列表',
		keywords: ['员工', '员工列表', 'employees', 'staff list'],
		entry: '/employees',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'create_employee',
		module: 'employee',
		description: '新建员工档案',
		keywords: ['新增员工', '创建员工', 'new employee', 'create staff'],
		entry: '/employees/new',
		layer: 2,
		required_roles: ['owner', 'finance']
	}
];

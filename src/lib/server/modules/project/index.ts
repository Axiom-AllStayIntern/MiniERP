import type { ModuleDefinition } from '../types';
import { registerProjectHandlers } from './handlers';
import type { AgentAction } from '$lib/server/agent/types';

export const projectModule: ModuleDefinition = {
	manifest: {
		id: 'project',
		name: 'Project',
		layer: 'base',
		dependencies: ['core', 'person', 'business-partner']
	},
	registerHandlers: registerProjectHandlers
};

export { createProjectApi, type ProjectApi } from './api';

export const projectActions: AgentAction[] = [
	{
		id: 'view_projects',
		module: 'project',
		description: '查看项目列表',
		keywords: ['项目列表', '查看项目', 'projects', 'project list'],
		entry: '/projects',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager', 'employee']
	},
	{
		id: 'create_project',
		module: 'project',
		description: '新建项目并填写基础信息',
		keywords: ['创建项目', '新建项目', 'create project', 'new project', '开一个项目'],
		entry: '/projects/new',
		layer: 2,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{ name: 'project_name', type: 'string', required: false, description: '项目名称' },
			{ name: 'customer_name', type: 'string', required: false, description: '客户名称' },
			{
				name: 'project_type',
				type: 'string',
				required: false,
				description: '项目类型：delivery/ongoing/internal'
			},
			{ name: 'start_date', type: 'date', required: false, description: '开始日期' }
		]
	},
	{
		id: 'view_project_detail',
		module: 'project',
		description: '查看某个项目的详细信息',
		keywords: ['项目详情', '项目信息', 'project detail', '查看项目'],
		entry: '/projects/[id]',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager', 'employee'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: true,
				description: '项目ID',
				extract_from_context: true
			}
		]
	},
	{
		id: 'view_project_profit',
		module: 'project',
		description: '查看项目利润与财务概览',
		keywords: ['项目利润', '利润分析', 'project profit', 'project margin', '盈亏'],
		entry: '/projects',
		api: 'GET /api/projects/[id]/profit',
		layer: 4,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: true,
				description: '项目ID',
				extract_from_context: true
			}
		]
	},
	{
		id: 'add_project_member',
		module: 'project',
		description: '给项目添加成员',
		keywords: ['添加成员', '项目成员', 'add member', 'assign employee', '分配员工'],
		entry: '/projects/[id]/employees',
		layer: 2,
		required_roles: ['owner', 'project_manager'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: true,
				description: '项目ID',
				extract_from_context: true
			},
			{ name: 'employee_name', type: 'string', required: false, description: '员工姓名' }
		]
	}
];

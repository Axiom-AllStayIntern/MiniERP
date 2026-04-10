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
		keywords: ['创建项目', '新建项目', 'create project', 'new project'],
		entry: '/projects/new',
		layer: 2,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_project_profit',
		module: 'project',
		description: '查看项目利润与财务概览',
		keywords: ['项目利润', '利润分析', 'project profit', 'project margin'],
		entry: '/projects',
		api: 'GET /api/projects/[id]/profit',
		layer: 4,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{ name: 'project_id', type: 'string', required: true, description: '项目ID', extract_from_context: true }
		]
	}
];

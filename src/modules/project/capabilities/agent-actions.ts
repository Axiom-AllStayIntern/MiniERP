import type { AgentAction } from '$platform/ai/legacy-agent/types';

export const projectActions: AgentAction[] = [
	{
		id: 'view_projects',
		module: 'project',
		description: 'View the project list',
		keywords: ['projects', 'project list', 'all projects'],
		entry: '/projects',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager', 'employee']
	},
	{
		id: 'create_project',
		module: 'project',
		description: 'Create a project with basic details',
		keywords: ['create project', 'new project', 'add project'],
		entry: '/projects/new',
		layer: 2,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{ name: 'project_name', type: 'string', required: false, description: 'Project name' },
			{ name: 'customer_name', type: 'string', required: false, description: 'Customer name' },
			{
				name: 'project_type',
				type: 'string',
				required: false,
				description: 'Project type: delivery / ongoing / internal'
			},
			{ name: 'start_date', type: 'date', required: false, description: 'Start date' }
		]
	},
	{
		id: 'view_project_detail',
		module: 'project',
		description: 'View details for a specific project',
		keywords: ['project detail', 'project info', 'open project'],
		entry: '/projects/[id]',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager', 'employee'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: true,
				description: 'Project ID',
				extract_from_context: true
			}
		]
	},
	{
		id: 'view_project_profit',
		module: 'project',
		description: 'View project profit and financial summary',
		keywords: ['project profit', 'margin', 'P&L', 'project financials'],
		entry: '/projects',
		api: 'GET /api/projects/[id]/profit',
		layer: 4,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: true,
				description: 'Project ID',
				extract_from_context: true
			}
		]
	},
	{
		id: 'add_project_member',
		module: 'project',
		description: 'Add a member to a project',
		keywords: ['add member', 'project team', 'assign employee', 'staff assignment'],
		entry: '/projects/[id]/employees',
		layer: 2,
		required_roles: ['owner', 'project_manager'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: true,
				description: 'Project ID',
				extract_from_context: true
			},
			{ name: 'employee_name', type: 'string', required: false, description: 'Employee name' }
		]
	}
];

import type { ModuleDefinition } from '$platform/modules/types';
import { registerReportingHandlers } from './handlers';
import type { AgentAction } from '$platform/ai/legacy-agent/types';

export const reportingModule: ModuleDefinition = {
	manifest: {
		id: 'reporting',
		name: 'Reporting',
		layer: 'feature',
		dependencies: ['core', 'project', 'ar', 'employee', 'expense']
	},
	registerHandlers: registerReportingHandlers
};

export { createReportingApi, type ReportingApi } from './api';

export const reportingActions: AgentAction[] = [
	{
		id: 'view_reports',
		module: 'reporting',
		description: 'Open the reports page',
		keywords: ['reports', 'analytics', 'reporting'],
		entry: '/reports',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'export_projects_profit_report',
		module: 'reporting',
		description: 'Export the projects profit report',
		keywords: ['profit report', 'export report', 'projects profit', 'margin export'],
		entry: '/reports',
		api: 'GET /api/reports/projects-profit/export',
		layer: 4,
		required_roles: ['owner', 'finance', 'project_manager']
	}
];

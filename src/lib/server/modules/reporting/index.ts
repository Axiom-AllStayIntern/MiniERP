import type { ModuleDefinition } from '../types';
import { registerReportingHandlers } from './handlers';
import type { AgentAction } from '$lib/server/agent/types';

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
		description: '查看报表页面',
		keywords: ['报表', '报告', 'reports', 'analytics'],
		entry: '/reports',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'export_projects_profit_report',
		module: 'reporting',
		description: '导出项目利润报表',
		keywords: ['导出利润报表', 'profit report', 'export report', 'projects profit'],
		entry: '/reports',
		api: 'GET /api/reports/projects-profit/export',
		layer: 4,
		required_roles: ['owner', 'finance', 'project_manager']
	}
];

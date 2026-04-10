import type { ModuleDefinition } from '../types';
import { registerTaxHandlers } from './handlers';
import type { AgentAction } from '$lib/server/agent/types';

export const taxModule: ModuleDefinition = {
	manifest: {
		id: 'tax',
		name: 'Tax',
		layer: 'feature',
		dependencies: ['core', 'person', 'ar', 'employee']
	},
	registerHandlers: registerTaxHandlers
};

export { createTaxApi, type TaxApi } from './api';

export const taxActions: AgentAction[] = [
	{
		id: 'view_tax_home',
		module: 'tax',
		description: '查看税务总览页面',
		keywords: ['税务', '税务首页', 'tax', 'tax home'],
		entry: '/tax',
		layer: 1,
		required_roles: ['owner', 'finance']
	},
	{
		id: 'view_gst_quarter',
		module: 'tax',
		description: '查询指定季度 GST box 数据',
		keywords: ['gst', '季度税', 'gst quarter', 'box data'],
		entry: '/tax',
		api: 'GET /api/tax/gst/[year]/[quarter]',
		layer: 4,
		required_roles: ['owner', 'finance'],
		params: [
			{ name: 'year', type: 'number', required: true, description: '年份' },
			{ name: 'quarter', type: 'number', required: true, description: '季度（1-4）' }
		]
	},
	{
		id: 'view_corporate_tax',
		module: 'tax',
		description: '查看企业税页面',
		keywords: ['企业税', 'corporate tax', '公司税', 'tax corporate'],
		entry: '/tax/corporate',
		layer: 1,
		required_roles: ['owner', 'finance']
	}
];

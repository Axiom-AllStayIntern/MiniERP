import type { ModuleDefinition } from '$platform/modules/types';
import { registerTaxHandlers } from './handlers';
import type { AgentAction } from '$platform/ai/legacy-agent/types';

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
		description: 'Open the tax overview page',
		keywords: ['tax', 'tax home', 'GST overview'],
		entry: '/tax',
		layer: 1,
		required_roles: ['owner', 'finance']
	},
	{
		id: 'view_gst_quarter',
		module: 'tax',
		description: 'Fetch GST return box data for a given quarter',
		keywords: ['gst', 'GST quarter', 'box data', 'filing'],
		entry: '/tax',
		api: 'GET /api/tax/gst/[year]/[quarter]',
		layer: 4,
		required_roles: ['owner', 'finance'],
		params: [
			{ name: 'year', type: 'number', required: true, description: 'Calendar year' },
			{ name: 'quarter', type: 'number', required: true, description: 'Quarter (1â€?)' }
		]
	},
	{
		id: 'view_corporate_tax',
		module: 'tax',
		description: 'Open the corporate tax page',
		keywords: ['corporate tax', 'company tax', 'income tax'],
		entry: '/tax/corporate',
		layer: 1,
		required_roles: ['owner', 'finance']
	}
];

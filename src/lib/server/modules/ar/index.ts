import type { ModuleDefinition } from '../types';
import { registerArHandlers } from './handlers';
import type { AgentAction } from '$lib/server/agent/types';

export const arModule: ModuleDefinition = {
	manifest: {
		id: 'ar',
		name: 'Accounts Receivable',
		layer: 'base',
		dependencies: ['core', 'business-partner', 'project']
	},
	registerHandlers: registerArHandlers
};

export { createArApi, type ArApi } from './api';

export const arActions: AgentAction[] = [
	{
		id: 'create_customer_invoice',
		module: 'ar',
		description: '为客户创建发票草稿，可预填项目、客户与金额信息',
		keywords: ['开发票', '创建发票', '客户发票', 'invoice', 'create invoice'],
		entry: '/ar/customer-invoices/generate',
		api: 'POST /api/invoices/out',
		layer: 3,
		required_roles: ['owner', 'finance'],
		params: [
			{ name: 'project_id', type: 'string', required: false, description: '关联项目ID', extract_from_context: true },
			{ name: 'customer_id', type: 'string', required: false, description: '客户ID' },
			{ name: 'amount', type: 'number', required: false, description: '发票金额' }
		]
	},
	{
		id: 'upload_project_document',
		module: 'ar',
		description: '打开文档上传页面，上传合同、报价单、采购单或费用单据',
		keywords: ['上传文档', '上传合同', '上传报价', 'document upload', 'upload file'],
		entry: '/ar/document-upload',
		layer: 2,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_customer_invoices',
		module: 'ar',
		description: '查看客户发票列表',
		keywords: ['查看发票', '发票列表', 'customer invoices', 'invoices'],
		entry: '/ar/customer-invoices',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_contracts',
		module: 'ar',
		description: '查看合同列表',
		keywords: ['查看合同', '合同列表', 'contracts', 'project contracts'],
		entry: '/ar/contracts',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_purchase_orders',
		module: 'ar',
		description: '查看采购单列表',
		keywords: ['采购单', 'purchase order', 'po list', '查看采购单'],
		entry: '/ar/purchase-orders',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	}
];

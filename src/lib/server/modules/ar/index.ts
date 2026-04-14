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
		keywords: ['开发票', '创建发票', '客户发票', 'invoice', 'create invoice', '新建发票'],
		entry: '/ar/customer-invoices/generate',
		api: 'POST /api/invoices/out',
		layer: 3,
		required_roles: ['owner', 'finance'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: false,
				description: '关联项目ID',
				extract_from_context: true
			},
			{ name: 'project_name', type: 'string', required: false, description: '关联项目名称' },
			{ name: 'customer_name', type: 'string', required: false, description: '客户名称' },
			{ name: 'amount', type: 'number', required: false, description: '发票金额' },
			{ name: 'currency', type: 'string', required: false, description: '币种：SGD/USD/CNY' },
			{ name: 'description', type: 'string', required: false, description: '发票描述' }
		]
	},
	{
		id: 'upload_project_document',
		module: 'ar',
		description: '打开文档上传页面，上传合同、报价单、采购单或费用单据',
		keywords: ['上传文档', '上传合同', '上传报价', 'document upload', 'upload file', '上传'],
		entry: '/ar/document-upload',
		layer: 2,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: false,
				description: '关联项目ID',
				extract_from_context: true
			},
			{ name: 'doc_type', type: 'string', required: false, description: '文档类型：contract/quotation/po/expense' }
		]
	},
	{
		id: 'view_customer_invoices',
		module: 'ar',
		description: '查看客户发票列表',
		keywords: ['查看发票', '发票列表', 'customer invoices', 'invoices', '客户发票'],
		entry: '/ar/customer-invoices',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_supplier_invoices',
		module: 'ar',
		description: '查看供应商发票列表',
		keywords: ['供应商发票', 'supplier invoice', '进项发票', '供应商账单'],
		entry: '/ar/supplier-invoices',
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
		id: 'view_quotations',
		module: 'ar',
		description: '查看报价单列表',
		keywords: ['报价单', 'quotation', '报价列表', '查看报价'],
		entry: '/ar/quotations',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_purchase_orders',
		module: 'ar',
		description: '查看采购单列表',
		keywords: ['采购单', 'purchase order', 'po list', '查看采购单', 'PO'],
		entry: '/ar/purchase-orders',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	}
];

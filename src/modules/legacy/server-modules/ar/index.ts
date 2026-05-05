import type { ModuleDefinition } from '$platform/modules/types';
import { registerArHandlers } from './handlers';
import type { AgentAction } from '$platform/ai/legacy-agent/types';

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
		description: 'Create a customer invoice draft; can prefill project, customer, and amount',
		keywords: ['invoice', 'create invoice', 'customer invoice', 'sales invoice', 'AR invoice'],
		entry: '/finance/doc-hub/customer-invoices/generate',
		api: 'POST /api/invoices/out',
		layer: 3,
		required_roles: ['owner', 'finance'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: false,
				description: 'Linked project ID',
				extract_from_context: true
			},
			{ name: 'project_name', type: 'string', required: false, description: 'Linked project name' },
			{ name: 'customer_name', type: 'string', required: false, description: 'Customer name' },
			{ name: 'amount', type: 'number', required: false, description: 'Invoice amount' },
			{ name: 'currency', type: 'string', required: false, description: 'Currency: SGD / USD / CNY' },
			{ name: 'description', type: 'string', required: false, description: 'Invoice description' }
		]
	},
	{
		id: 'upload_project_document',
		module: 'ar',
		description: 'Open document upload for contracts, quotations, purchase orders, or expense documents',
		keywords: ['document upload', 'upload contract', 'upload quotation', 'upload file', 'doc hub'],
		entry: '/finance/doc-hub/upload',
		layer: 2,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: false,
				description: 'Linked project ID',
				extract_from_context: true
			},
			{ name: 'doc_type', type: 'string', required: false, description: 'Document type: contract / quotation / po / expense' }
		]
	},
	{
		id: 'view_customer_invoices',
		module: 'ar',
		description: 'View customer (sales) invoices',
		keywords: ['customer invoices', 'outgoing invoices', 'AR list', 'invoices'],
		entry: '/finance/doc-hub/customer-invoices',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_supplier_invoices',
		module: 'ar',
		description: 'View supplier (purchase) invoices',
		keywords: ['supplier invoice', 'AP invoice', 'vendor bill', 'incoming invoice'],
		entry: '/finance/doc-hub/supplier-invoices',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_contracts',
		module: 'ar',
		description: 'View contracts',
		keywords: ['contracts', 'contract list', 'project contracts'],
		entry: '/finance/doc-hub/contracts',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_quotations',
		module: 'ar',
		description: 'View quotations',
		keywords: ['quotation', 'quote', 'quotation list'],
		entry: '/finance/doc-hub/quotations',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_purchase_orders',
		module: 'ar',
		description: 'View purchase orders',
		keywords: ['purchase order', 'PO list', 'procurement orders'],
		entry: '/finance/doc-hub/purchase-orders',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	}
];

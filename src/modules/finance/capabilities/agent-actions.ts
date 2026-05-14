import type { AgentAction } from '$platform/ai/legacy-agent/types';

const arActions: AgentAction[] = [
	{
		id: 'create_customer_invoice',
		module: 'ar',
		description: 'Create a customer invoice draft; can prefill project, customer, and amount',
		keywords: ['invoice', 'create invoice', 'customer invoice', 'sales invoice', 'AR invoice'],
		entry: '/finance/revenue/generate',
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
			{
				name: 'doc_type',
				type: 'string',
				required: false,
				description: 'Document type: contract / quotation / po / expense'
			}
		]
	},
	{
		id: 'view_customer_invoices',
		module: 'ar',
		description: 'View customer (sales) invoices',
		keywords: ['customer invoices', 'outgoing invoices', 'AR list', 'invoices'],
		entry: '/finance/revenue',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'view_supplier_invoices',
		module: 'ar',
		description: 'View supplier (purchase) invoices',
		keywords: ['supplier invoice', 'AP invoice', 'vendor bill', 'incoming invoice'],
		entry: '/finance/expenses',
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

const expenseActions: AgentAction[] = [
	{
		id: 'view_expense_claims',
		module: 'expense',
		description: 'View expense records (Operating Expenses and Sales Cost)',
		keywords: ['expense', 'cost', 'opex', 'sales cost', 'spend'],
		entry: '/finance/expenses',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager', 'employee']
	},
	{
		id: 'create_expense_record',
		module: 'expense',
		description: 'Record an expense (saved immediately; no draft workflow)',
		keywords: ['new expense', 'record expense', 'log expense', 'upload expense'],
		entry: '/finance/expenses/upload',
		layer: 3,
		required_roles: ['owner', 'finance', 'project_manager'],
		params: [
			{
				name: 'project_id',
				type: 'string',
				required: false,
				description: 'Project ID (optional)',
				extract_from_context: true
			},
			{ name: 'amount', type: 'number', required: false, description: 'Expense amount' }
		]
	}
];

const taxActions: AgentAction[] = [
	{
		id: 'view_tax_home',
		module: 'tax',
		description: 'Open the tax overview page',
		keywords: ['tax', 'tax home', 'GST overview'],
		entry: '/finance/tax',
		layer: 1,
		required_roles: ['owner', 'finance']
	},
	{
		id: 'view_gst_quarter',
		module: 'tax',
		description: 'Fetch GST return box data for a given quarter',
		keywords: ['gst', 'GST quarter', 'box data', 'filing'],
		entry: '/finance/tax',
		api: 'GET /api/tax/gst/[year]/[quarter]',
		layer: 4,
		required_roles: ['owner', 'finance'],
		params: [
			{ name: 'year', type: 'number', required: true, description: 'Calendar year' },
			{ name: 'quarter', type: 'number', required: true, description: 'Quarter (1-4)' }
		]
	},
	{
		id: 'view_corporate_tax',
		module: 'tax',
		description: 'Open the corporate tax page',
		keywords: ['corporate tax', 'company tax', 'income tax'],
		entry: '/finance/tax/corporate',
		layer: 1,
		required_roles: ['owner', 'finance']
	}
];

const reportingActions: AgentAction[] = [
	{
		id: 'view_reports',
		module: 'reporting',
		description: 'Open the reports page',
		keywords: ['reports', 'analytics', 'reporting'],
		entry: '/finance/reports',
		layer: 1,
		required_roles: ['owner', 'finance', 'project_manager']
	},
	{
		id: 'export_projects_profit_report',
		module: 'reporting',
		description: 'Export the projects profit report',
		keywords: ['profit report', 'export report', 'projects profit', 'margin export'],
		entry: '/finance/reports',
		api: 'GET /api/reports/projects-profit/export',
		layer: 4,
		required_roles: ['owner', 'finance', 'project_manager']
	}
];

export interface FinanceAgentActionSets {
	ar: AgentAction[];
	expense: AgentAction[];
	tax: AgentAction[];
	reporting: AgentAction[];
}

export const financeAgentActionSets: FinanceAgentActionSets = {
	ar: arActions,
	expense: expenseActions,
	tax: taxActions,
	reporting: reportingActions
};

export const financeAllAgentActions = [
	...financeAgentActionSets.ar,
	...financeAgentActionSets.expense,
	...financeAgentActionSets.tax,
	...financeAgentActionSets.reporting
];

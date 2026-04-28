import type {
	FinanceForbiddenAction,
	FinanceIntent,
	FinanceOwnedDomain,
	FinanceRiskLevel
} from './types';

export interface FinanceAgentManifest {
	id: 'finance-agent';
	name: 'Finance Agent';
	domain: 'finance';
	version: string;
	description: string;
	owns: readonly FinanceOwnedDomain[];
	canHandle: readonly FinanceIntent[];
	cannotHandle: readonly string[];
	defaultRiskLevel: FinanceRiskLevel;
	requiresUserConfirmationFor: readonly string[];
	forbiddenActions: readonly FinanceForbiddenAction[];
}

export const financeAgentManifest: FinanceAgentManifest = {
	id: 'finance-agent',
	name: 'Finance Agent',
	domain: 'finance',
	version: '0.1.0',
	description:
		'Domain-bounded agent for finance workflows, including supplier invoice intake, expense recording, revenue recording, GST preparation, and financial summaries.',
	owns: [
		'expense',
		'revenue',
		'supplier_invoice',
		'customer_invoice',
		'receipt',
		'gst_summary',
		'profit_summary',
		'finance_task'
	],
	canHandle: [
		'record_supplier_invoice',
		'record_expense',
		'record_receipt',
		'record_allowance',
		'record_revenue',
		'query_expense_summary',
		'query_revenue_summary',
		'query_profit_summary',
		'prepare_gst_review',
		'explain_finance_record',
		'detect_possible_duplicate',
		'suggest_next_finance_task'
	],
	cannotHandle: [
		'manage_user_permissions',
		'execute_payment',
		'submit_tax_return',
		'delete_financial_record',
		'modify_project_master_data',
		'modify_employee_master_data',
		'read_unrelated_tenant_data'
	],
	defaultRiskLevel: 'R3',
	requiresUserConfirmationFor: [
		'create_expense_record',
		'create_revenue_record',
		'update_finance_record',
		'link_record_to_project',
		'confirm_gst_summary'
	],
	forbiddenActions: [
		'delete_record',
		'execute_payment',
		'submit_tax_return',
		'change_permission',
		'change_bank_account',
		'bypass_workflow',
		'bypass_validation'
	]
};

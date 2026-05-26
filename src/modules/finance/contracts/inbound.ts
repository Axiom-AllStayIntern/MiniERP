import type { InboundContract } from '../../../platform/registry/contracts';
import type { FinanceBillingApi } from '../services/billing-service';
import type { CategoryServiceApi } from '../services/category-service';
import type { FinanceDocumentsApi } from '../services/document-service';
import type { FinanceEInvoiceApi } from '../services/einvoice-service';
import type { FinanceExpensesApi } from '../services/expense-service';
import type { FinanceInsightsApi } from '../services/insight-service';
import type { FinanceRevenueApi } from '../services/revenue-service';
import type { FinanceTaxesApi } from '../services/tax-service';

export interface FinanceInboundContract {
	documents: FinanceDocumentsApi;
	billing: FinanceBillingApi;
	expenses: FinanceExpensesApi;
	revenue: FinanceRevenueApi;
	taxes: FinanceTaxesApi;
	insights: FinanceInsightsApi;
	categories: CategoryServiceApi;
	einvoice: FinanceEInvoiceApi;
}

export const FINANCE_PUBLIC_GROUPS = [
	'documents',
	'billing',
	'expenses',
	'revenue',
	'taxes',
	'insights',
	'categories',
	'einvoice'
] as const;

export type FinancePublicGroup = (typeof FINANCE_PUBLIC_GROUPS)[number];

export const financeInboundContracts: InboundContract[] = [
	{
		id: 'finance.documents',
		description: 'Finance document and doc-hub operations',
		mode: 'sync',
		input: { name: 'finance-document-input', version: 'v1' },
		output: { name: 'finance-document-output', version: 'v1' },
		requiredPermissions: ['finance:view']
	},
	{
		id: 'finance.billing',
		description: 'Finance billing and customer invoice operations',
		mode: 'sync',
		input: { name: 'finance-billing-input', version: 'v1' },
		output: { name: 'finance-billing-output', version: 'v1' },
		requiredPermissions: ['finance:view', 'finance:edit']
	},
	{
		id: 'finance.expenses',
		description: 'Expense recording and reimbursement operations',
		mode: 'sync',
		input: { name: 'finance-expense-input', version: 'v1' },
		output: { name: 'finance-expense-output', version: 'v1' },
		requiredPermissions: ['finance:view', 'finance:edit']
	},
	{
		id: 'finance.revenue',
		description: 'Revenue record operations',
		mode: 'sync',
		input: { name: 'finance-revenue-input', version: 'v1' },
		output: { name: 'finance-revenue-output', version: 'v1' },
		requiredPermissions: ['finance:view', 'finance:edit']
	},
	{
		id: 'finance.taxes',
		description: 'Finance tax and GST operations',
		mode: 'sync',
		input: { name: 'finance-tax-input', version: 'v1' },
		output: { name: 'finance-tax-output', version: 'v1' },
		requiredPermissions: ['finance:view', 'finance:tax']
	},
	{
		id: 'finance.insights',
		description: 'Finance reporting and insight operations',
		mode: 'sync',
		input: { name: 'finance-insight-input', version: 'v1' },
		output: { name: 'finance-insight-output', version: 'v1' },
		requiredPermissions: ['finance:view']
	},
	{
		id: 'finance.categories',
		description: 'Chart of accounts / expense category management',
		mode: 'sync',
		input: { name: 'finance-category-input', version: 'v1' },
		output: { name: 'finance-category-output', version: 'v1' },
		requiredPermissions: ['finance:view', 'finance:edit']
	},
	{
		id: 'finance.einvoice',
		description: 'Peppol BIS e-invoice generation and InvoiceNow Access Point operations',
		mode: 'sync',
		input: { name: 'finance-einvoice-input', version: 'v1' },
		output: { name: 'finance-einvoice-output', version: 'v1' },
		requiredPermissions: ['finance:view', 'finance:edit']
	}
];

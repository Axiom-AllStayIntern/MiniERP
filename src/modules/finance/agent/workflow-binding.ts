import type { FinanceIntent } from './types';

export const financeWorkflowBinding: Record<FinanceIntent, string | null> = {
	record_supplier_invoice: 'vendor-invoice-intake',
	record_expense: 'expense-recording',
	record_receipt: 'receipt-intake',
	record_allowance: 'allowance-recording',
	record_revenue: 'revenue-recording',
	prepare_gst_review: 'gst-review-preparation',
	query_expense_summary: null,
	query_revenue_summary: null,
	query_profit_summary: null,
	explain_finance_record: null,
	detect_possible_duplicate: null,
	suggest_next_finance_task: null,
	unknown: null
};

export function resolveWorkflowForIntent(intent: FinanceIntent): string | null {
	return financeWorkflowBinding[intent];
}

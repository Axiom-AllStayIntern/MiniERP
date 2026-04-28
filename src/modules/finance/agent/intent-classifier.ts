import type { FinanceIntent, FinanceIntentResult, FinanceRiskLevel } from './types';
import { resolveWorkflowForIntent } from './workflow-binding';

export interface ClassifyFinanceIntentInput {
	message?: string;
	intentHint?: FinanceIntent;
	currentPath?: string;
}

const INTENT_KEYWORDS: Array<{ intent: FinanceIntent; patterns: RegExp[] }> = [
	{
		intent: 'record_supplier_invoice',
		patterns: [
			/supplier\s+invoice/i,
			/vendor\s+invoice/i,
			/record\s+(this\s+)?invoice/i,
			/upload.*invoice/i,
			/match.*po/i
		]
	},
	{
		intent: 'record_expense',
		patterns: [/record.*expense/i, /log.*expense/i, /add.*(receipt|expense|bill)/i, /opex/i]
	},
	{ intent: 'record_receipt', patterns: [/record.*receipt/i, /payment\s+receipt/i] },
	{
		intent: 'record_allowance',
		patterns: [/allowance/i, /per[\s-]?diem/i, /business\s+trip/i]
	},
	{
		intent: 'record_revenue',
		patterns: [/record.*revenue/i, /customer\s+payment/i, /paid\s+invoice/i]
	},
	{
		intent: 'query_expense_summary',
		patterns: [/(how much|show).*spend/i, /expense\s+summary/i, /operating\s+expense/i]
	},
	{
		intent: 'query_revenue_summary',
		patterns: [/revenue\s+summary/i, /(how much|show).*revenue/i]
	},
	{
		intent: 'query_profit_summary',
		patterns: [/profit/i, /margin/i, /pnl|p&l/i]
	},
	{ intent: 'prepare_gst_review', patterns: [/gst/i, /tax\s+return/i, /quarter\s+filing/i] },
	{ intent: 'explain_finance_record', patterns: [/explain/i, /why/i] },
	{ intent: 'detect_possible_duplicate', patterns: [/duplicate/i, /already\s+recorded/i] },
	{ intent: 'suggest_next_finance_task', patterns: [/what\s+next/i, /suggest.*task/i] }
];

const PATH_INTENTS: Array<{ pattern: RegExp; intent: FinanceIntent }> = [
	{ pattern: /\/finance\/doc-hub\/supplier-invoices/, intent: 'record_supplier_invoice' },
	{ pattern: /\/expenses(?:\/|$)/, intent: 'record_expense' },
	{ pattern: /\/tax\/?$/, intent: 'prepare_gst_review' }
];

const INTENT_RISK: Record<FinanceIntent, FinanceRiskLevel> = {
	record_supplier_invoice: 'R3',
	record_expense: 'R3',
	record_receipt: 'R3',
	record_allowance: 'R3',
	record_revenue: 'R3',
	query_expense_summary: 'R1',
	query_revenue_summary: 'R1',
	query_profit_summary: 'R1',
	prepare_gst_review: 'R3',
	explain_finance_record: 'R0',
	detect_possible_duplicate: 'R1',
	suggest_next_finance_task: 'R1',
	unknown: 'R0'
};

const INTENT_REQUIRED_INPUTS: Record<FinanceIntent, string[]> = {
	record_supplier_invoice: ['document_artifact_or_file'],
	record_expense: ['category', 'date', 'amount', 'currency'],
	record_receipt: ['document_artifact_or_file'],
	record_allowance: ['destination', 'days'],
	record_revenue: ['amount', 'date', 'project_or_customer'],
	query_expense_summary: [],
	query_revenue_summary: [],
	query_profit_summary: [],
	prepare_gst_review: ['period'],
	explain_finance_record: ['record_id'],
	detect_possible_duplicate: ['candidate_payload'],
	suggest_next_finance_task: [],
	unknown: []
};

function build(intent: FinanceIntent, confidence: number, reason: string): FinanceIntentResult {
	return {
		intent,
		confidence,
		reason,
		requiredInputs: INTENT_REQUIRED_INPUTS[intent],
		suggestedWorkflow: resolveWorkflowForIntent(intent),
		riskLevel: INTENT_RISK[intent]
	};
}

/**
 * Phase 1 classifier: explicit hint > keyword match > path match > unknown.
 * The LLM fallback for free-form messages will land in Phase 2 alongside the
 * model router; until then, unmatched messages return `unknown` so the panel
 * can ask the user to pick a finance task.
 */
export function classifyFinanceIntent(input: ClassifyFinanceIntentInput): FinanceIntentResult {
	if (input.intentHint) {
		return build(input.intentHint, 1, 'explicit_hint');
	}

	const message = input.message?.trim();
	if (message) {
		for (const entry of INTENT_KEYWORDS) {
			if (entry.patterns.some((pattern) => pattern.test(message))) {
				return build(entry.intent, 0.85, 'keyword_match');
			}
		}
	}

	if (input.currentPath) {
		for (const entry of PATH_INTENTS) {
			if (entry.pattern.test(input.currentPath)) {
				return build(entry.intent, 0.6, 'path_match');
			}
		}
	}

	return build('unknown', 0, 'no_match');
}

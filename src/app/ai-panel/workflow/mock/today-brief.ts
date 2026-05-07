import type { BriefItem, QuickAction } from '../types';

/**
 * Phase 3 mock data. Quick Actions for new uploads route into the unified
 * `financial-document-intake` workflow with category hints. Existing drafted
 * documents route into the Ship 2C `finance-inbox` layer. The intake hint maps
 * to the canonical category ids in
 * `src/modules/finance/workflows/financial-document-intake/categories.ts`
 * so the workflow's bucket/kind steps can pre-select sensible defaults.
 *
 * The legacy `vendor-invoice-intake` route is still registered for
 * backward-compat; we keep one supplier-invoice brief item pointed at it
 * so the old demo path remains exercisable.
 *
 * Vendor names deliberately realistic per vision doc §5 (no "Test Vendor 1").
 */

export const mockBriefItems: BriefItem[] = [
	{
		id: 'brief-1',
		title: '3 supplier invoices waiting on you',
		detail: 'From Axiom Tech, Cloudfactor SG, Neon Robotics — OCR draft ready.',
		workflowId: 'finance-inbox',
		urgency: 'due-soon',
		count: 3
	},
	{
		id: 'brief-2',
		title: 'GST Q1 return due in 9 days',
		detail: "I've tallied input/output tax so far. Want to review the draft?",
		urgency: 'normal'
	},
	{
		id: 'brief-3',
		title: '2 expense claims need approval',
		detail: 'Joyce and Wei Ming submitted travel receipts this morning.',
		workflowId: 'finance-inbox',
		urgency: 'normal',
		count: 2
	}
];

export const mockGreetingLine =
	"Morning. 3 things I've pre-drafted, 2 need your eyes.";

export const mockQuickActions: QuickAction[] = [
	{
		id: 'qa-invoice',
		label: 'Record invoice',
		icon: 'receipt',
		workflowId: 'financial-document-intake',
		workflowHint: { docType: 'invoice_in' }
	},
	{
		id: 'qa-expense',
		label: 'Log expense',
		icon: 'wallet',
		workflowId: 'financial-document-intake',
		workflowHint: { docType: 'expense' }
	},
	{
		id: 'qa-contract',
		label: 'File contract',
		icon: 'file-text',
		workflowId: 'financial-document-intake',
		workflowHint: { docType: 'contract' }
	},
	{
		id: 'qa-inbox',
		label: 'Inbox',
		icon: 'inbox',
		workflowId: 'finance-inbox'
	},
	{
		id: 'qa-allowance',
		label: 'Log allowance',
		icon: 'plane',
		workflowId: 'allowance-recording'
	},
	{ id: 'qa-report', label: 'This month', icon: 'line-chart' }
];

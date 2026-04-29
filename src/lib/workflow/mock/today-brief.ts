import type { BriefItem, QuickAction } from '../types';

/**
 * Phase 1A/B mock data. All entry points route into the single `document-intake`
 * workflow — the hint biases the step-2 classifier so Quick Action "Record
 * invoice" pre-selects the supplier-invoice path without locking the user in.
 *
 * Vendor names deliberately realistic per vision doc §5 (no "Test Vendor 1").
 */

export const mockBriefItems: BriefItem[] = [
	{
		id: 'brief-1',
		title: '3 supplier invoices waiting on you',
		detail: 'From Axiom Tech, Cloudfactor SG, Neon Robotics — OCR draft ready.',
		workflowId: 'vendor-invoice-intake',
		workflowHint: { docType: 'invoice_in' },
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
		workflowId: 'document-intake',
		workflowHint: { docType: 'expense' },
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
		workflowId: 'vendor-invoice-intake',
		workflowHint: { docType: 'invoice_in' }
	},
	{
		id: 'qa-expense',
		label: 'Log expense',
		icon: 'wallet',
		workflowId: 'document-intake',
		workflowHint: { docType: 'expense' }
	},
	{
		id: 'qa-contract',
		label: 'File contract',
		icon: 'file-text',
		workflowId: 'document-intake',
		workflowHint: { docType: 'contract' }
	},
	{ id: 'qa-report', label: 'This month', icon: 'line-chart' }
];

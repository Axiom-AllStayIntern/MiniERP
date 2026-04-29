export interface SuggestedNextTask {
	title: string;
	detail: string;
	workflowId: 'vendor-invoice-intake' | null;
	count: number;
}

const FIXTURES: SuggestedNextTask[] = [
	{
		title: '2 more supplier invoices waiting',
		detail: 'Cloudfactor SG and Neon Robotics are next. I can prep them in the same flow.',
		workflowId: 'vendor-invoice-intake',
		count: 2
	},
	{
		title: 'GST Q1 review is open',
		detail: "I've tallied input/output tax so far. Want a draft for review?",
		workflowId: null,
		count: 1
	}
];

export function pickFollowUp(seed: { afterSupplierName?: string }): SuggestedNextTask {
	if (seed.afterSupplierName?.toLowerCase().includes('axiom')) {
		return FIXTURES[0];
	}
	return FIXTURES[0];
}

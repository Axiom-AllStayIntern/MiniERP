export const EMPLOYEE_EVENTS = {
	PAYOUT_SETTLED: 'payout.settled',
	ALLOCATION_UPDATED: 'allocation.updated'
} as const;

export type PayoutSettledPayload = {
	payoutId: string;
	projectId: string;
	personId: string;
	amount: number;
	period: string;
};

export type AllocationUpdatedPayload = {
	personId: string;
	projectId: string;
	weightPct: number;
};

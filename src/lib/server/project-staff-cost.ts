import { and, between, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { compensationComponents, payoutRecords } from '$lib/server/db/schema';

/** Confirmed / paid payouts count toward project Staff Cost; draft does not. */
export const staffCostPayoutStatuses = ['confirmed', 'paid'] as const;

/** Dividend / equity distributions: not payroll staff cost (book separately). */
export function staffCostExcludedIncomeTypes() {
	return ne(compensationComponents.incomeType, 'dividend');
}

export function staffCostPayoutJoinConditions() {
	return and(
		isNull(payoutRecords.deletedAt),
		isNull(compensationComponents.deletedAt),
		inArray(payoutRecords.status, [...staffCostPayoutStatuses]),
		staffCostExcludedIncomeTypes()
	);
}

/** `sum(computed_amount)` for staff-cost-eligible payouts on one project. */
export function staffCostSumExpr() {
	return sql<number>`coalesce(sum(${payoutRecords.computedAmount}), 0)`;
}

/** Filter payouts by `period` (date) inclusive range. */
export function staffCostPeriodBetween(start: string, end: string) {
	return between(payoutRecords.period, start, end);
}

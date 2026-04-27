import { and, between, inArray, isNull, ne, sql } from 'drizzle-orm';
import { compensationComponents, payoutRecords } from '../../../infrastructure/db/schema';

export const staffCostPayoutStatuses = ['confirmed', 'paid'] as const;

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

export function staffCostSumExpr() {
	return sql<number>`coalesce(sum(${payoutRecords.computedAmount}), 0)`;
}

export function staffCostPeriodBetween(start: string, end: string) {
	return between(payoutRecords.period, start, end);
}

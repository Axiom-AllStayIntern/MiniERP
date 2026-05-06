import { eq, isNull, and, between, inArray, ne, sql, desc } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import {
	employeeSalaries,
	employeeCompensationComponents,
	employeeProjectAllocations,
	compensationComponents,
	payoutRecords
} from './employee.schema';
import { BaseRepository } from '$platform/modules/base-repository';

// ---------------------------------------------------------------------------
// Staff cost SQL helpers (absorbed from project-staff-cost.ts)
// ---------------------------------------------------------------------------

/** Confirmed / paid payouts count toward project Staff Cost; draft does not. */
export const staffCostPayoutStatuses = ['confirmed', 'paid'] as const;

/** Dividend / equity distributions: not payroll staff cost. */
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

// ---------------------------------------------------------------------------
// CompensationComponentRepository (project-scoped)
// ---------------------------------------------------------------------------

export class CompensationComponentRepository extends BaseRepository<typeof compensationComponents> {
	constructor(db: DBClient) {
		super(db, compensationComponents);
	}

	async findByProjectEmployee(projectEmployeeId: string) {
		return this.db
			.select()
			.from(compensationComponents)
			.where(
				and(
					eq(compensationComponents.projectEmployeeId, projectEmployeeId),
					isNull(compensationComponents.deletedAt)
				)
			)
			.orderBy(desc(compensationComponents.createdAt));
	}
}

// ---------------------------------------------------------------------------
// PayoutRepository
// ---------------------------------------------------------------------------

export class PayoutRepository extends BaseRepository<typeof payoutRecords> {
	constructor(db: DBClient) {
		super(db, payoutRecords);
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(payoutRecords)
			.where(and(eq(payoutRecords.projectId, projectId), isNull(payoutRecords.deletedAt)))
			.orderBy(desc(payoutRecords.createdAt));
	}

	async findByComponent(componentId: string) {
		return this.db
			.select()
			.from(payoutRecords)
			.where(and(eq(payoutRecords.componentId, componentId), isNull(payoutRecords.deletedAt)))
			.orderBy(desc(payoutRecords.period));
	}

	/** Get total staff cost for a project */
	async getProjectStaffCost(projectId: string) {
		const rows = await this.db
			.select({ total: staffCostSumExpr() })
			.from(payoutRecords)
			.innerJoin(
				compensationComponents,
				eq(payoutRecords.componentId, compensationComponents.id)
			)
			.where(and(eq(payoutRecords.projectId, projectId), staffCostPayoutJoinConditions()));
		return rows[0]?.total ?? 0;
	}
}

// ---------------------------------------------------------------------------
// EmployeeCompensationRepository (company-level)
// ---------------------------------------------------------------------------

export class EmployeeCompensationRepository extends BaseRepository<typeof employeeCompensationComponents> {
	constructor(db: DBClient) {
		super(db, employeeCompensationComponents);
	}

	async findByEmployee(employeeId: string) {
		return this.db
			.select()
			.from(employeeCompensationComponents)
			.where(
				and(
					eq(employeeCompensationComponents.employeeId, employeeId),
					isNull(employeeCompensationComponents.deletedAt)
				)
			)
			.orderBy(desc(employeeCompensationComponents.createdAt));
	}
}

// ---------------------------------------------------------------------------
// AllocationRepository
// ---------------------------------------------------------------------------

export class AllocationRepository extends BaseRepository<typeof employeeProjectAllocations> {
	constructor(db: DBClient) {
		super(db, employeeProjectAllocations);
	}

	async findByEmployee(employeeId: string) {
		return this.db
			.select()
			.from(employeeProjectAllocations)
			.where(
				and(
					eq(employeeProjectAllocations.employeeId, employeeId),
					isNull(employeeProjectAllocations.deletedAt)
				)
			);
	}

	async findByProject(projectId: string) {
		return this.db
			.select()
			.from(employeeProjectAllocations)
			.where(
				and(
					eq(employeeProjectAllocations.projectId, projectId),
					isNull(employeeProjectAllocations.deletedAt)
				)
			);
	}
}

// ---------------------------------------------------------------------------
// SalaryRepository
// ---------------------------------------------------------------------------

export class SalaryRepository extends BaseRepository<typeof employeeSalaries> {
	constructor(db: DBClient) {
		super(db, employeeSalaries);
	}

	async findByEmployeeAndMonth(employeeId: string, month: string) {
		const rows = await this.db
			.select()
			.from(employeeSalaries)
			.where(
				and(
					eq(employeeSalaries.employeeId, employeeId),
					eq(employeeSalaries.month, month),
					isNull(employeeSalaries.deletedAt)
				)
			)
			.limit(1);
		return rows[0] ?? null;
	}
}

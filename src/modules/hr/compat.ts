import { and, eq, isNull, or } from 'drizzle-orm';

import { schema, type DBClient } from '../../infrastructure/db';
import {
	allocationPeriodDay,
	periodCalendarMonth,
	shadowCompensationComponentId
} from '$modules/hr/services/employee-service';

export {
	staffCostPayoutStatuses,
	staffCostExcludedIncomeTypes,
	staffCostPayoutJoinConditions,
	staffCostSumExpr,
	staffCostPeriodBetween
} from '$modules/hr/repositories/employee-repository';

export { allocationPeriodDay, periodCalendarMonth, shadowCompensationComponentId };

function monthStart(ym: string): string {
	return `${ym}-01`;
}

function sameCalendarMonth(isoDate: string | null | undefined, ym: string): boolean {
	if (!isoDate) return false;
	return periodCalendarMonth(isoDate) === ym;
}

// Compatibility wrapper retained for callers that still depend on the old
// top-level helper shape instead of ModuleContext-aware SettlementService.
export async function runSettleManualProjectComponentsForMonth(params: {
	db: DBClient;
	projectId: string;
	peId: string;
	monthYm: string;
}): Promise<number> {
	const { db, projectId, peId, monthYm } = params;
	if (!/^\d{4}-\d{2}$/.test(monthYm)) return 0;

	const components = await db
		.select()
		.from(schema.compensationComponents)
		.where(
			and(
				eq(schema.compensationComponents.projectEmployeeId, peId),
				or(
					eq(schema.compensationComponents.origin, 'manual'),
					isNull(schema.compensationComponents.origin)
				),
				isNull(schema.compensationComponents.deletedAt)
			)
		);

	const period = monthStart(monthYm);
	const now = new Date().toISOString();
	let lines = 0;

	for (const c of components) {
		if (c.frequency !== 'monthly' && c.frequency !== 'one_off') continue;
		if (c.frequency === 'monthly') {
			if (c.effectiveFrom > period) continue;
			if (c.effectiveTo && c.effectiveTo < period) continue;
		} else if (c.frequency === 'one_off') {
			if (!sameCalendarMonth(c.effectiveFrom, monthYm)) continue;
		}
		const amount = c.value ?? 0;
		const taxableAmount = c.taxable ? amount : 0;
		const note = `Project component settlement (${monthYm})`;

		const [existing] = await db
			.select({ id: schema.payoutRecords.id })
			.from(schema.payoutRecords)
			.where(
				and(
					eq(schema.payoutRecords.componentId, c.id),
					eq(schema.payoutRecords.projectId, projectId),
					eq(schema.payoutRecords.period, period),
					eq(schema.payoutRecords.source, 'settlement'),
					isNull(schema.payoutRecords.deletedAt)
				)
			)
			.limit(1);

		if (existing) {
			await db
				.update(schema.payoutRecords)
				.set({
					baseValue: amount,
					computedAmount: amount,
					taxableAmount,
					status: 'confirmed',
					note,
					updatedAt: now
				})
				.where(eq(schema.payoutRecords.id, existing.id));
		} else {
			await db.insert(schema.payoutRecords).values({
				id: crypto.randomUUID(),
				componentId: c.id,
				projectId,
				period,
				baseValue: amount,
				computedAmount: amount,
				cpfEmployee: 0,
				cpfEmployer: 0,
				taxableAmount,
				status: 'confirmed',
				source: 'settlement',
				note,
				createdAt: now,
				updatedAt: now
			});
		}
		lines += 1;
	}

	return lines;
}

// Compatibility wrapper retained for callers that still depend on the old
// top-level helper shape instead of ModuleContext-aware SettlementService.
export async function settleCompanyAllocationMonth(params: {
	db: DBClient;
	projectId: string;
	peId: string;
	employeeId: string;
	monthYm: string;
}): Promise<{ ok: true; lines: number } | { ok: false; message: string }> {
	const { db, projectId, peId, employeeId, monthYm } = params;
	if (!/^\d{4}-\d{2}$/.test(monthYm)) {
		return { ok: false, message: 'Invalid month.' };
	}

	const period = allocationPeriodDay(monthYm);
	const now = new Date().toISOString();

	const [allocationRow] = await db
		.select()
		.from(schema.employeeProjectAllocations)
		.where(
			and(
				eq(schema.employeeProjectAllocations.employeeId, employeeId),
				eq(schema.employeeProjectAllocations.projectId, projectId),
				isNull(schema.employeeProjectAllocations.deletedAt)
			)
		)
		.limit(1);

	const weightPct = allocationRow?.weightPct ?? 0;
	if (weightPct <= 0) {
		return { ok: false, message: 'No positive allocation weight for this project on the employee master.' };
	}

	const companyComponents = await db
		.select()
		.from(schema.employeeCompensationComponents)
		.where(
			and(
				eq(schema.employeeCompensationComponents.employeeId, employeeId),
				isNull(schema.employeeCompensationComponents.deletedAt)
			)
		);

	let lines = 0;

	for (const ecc of companyComponents) {
		if (ecc.incomeType === 'dividend') continue;
		if (ecc.ruleType !== 'fixed' || ecc.frequency !== 'monthly') continue;
		if (ecc.effectiveFrom > period) continue;
		if (ecc.effectiveTo != null && ecc.effectiveTo < period) continue;

		const amount = (ecc.value * weightPct) / 100;
		if (amount <= 0) continue;

		const shadowId = shadowCompensationComponentId(peId, ecc.id);
		const label = `[Company] ${ecc.label}`;
		const existingShadow = await db
			.select({ id: schema.compensationComponents.id })
			.from(schema.compensationComponents)
			.where(eq(schema.compensationComponents.id, shadowId))
			.limit(1);

		if (existingShadow.length > 0) {
			await db
				.update(schema.compensationComponents)
				.set({
					label,
					incomeType: ecc.incomeType,
					ruleType: 'fixed',
					value: amount,
					frequency: 'monthly',
					taxable: ecc.taxable,
					effectiveFrom: period,
					deletedAt: null,
					updatedAt: now,
					origin: 'company_allocated',
					employeeCompensationComponentId: ecc.id
				})
				.where(eq(schema.compensationComponents.id, shadowId));
		} else {
			await db.insert(schema.compensationComponents).values({
				id: shadowId,
				projectEmployeeId: peId,
				origin: 'company_allocated',
				employeeCompensationComponentId: ecc.id,
				label,
				incomeType: ecc.incomeType,
				ruleType: 'fixed',
				value: amount,
				floor: null,
				cap: null,
				frequency: 'monthly',
				taxable: ecc.taxable,
				effectiveFrom: period,
				effectiveTo: null,
				createdAt: now,
				updatedAt: now
			});
		}

		const taxableAmount = ecc.taxable ? amount : 0;
		const [existingPayout] = await db
			.select({ id: schema.payoutRecords.id })
			.from(schema.payoutRecords)
			.where(
				and(
					eq(schema.payoutRecords.componentId, shadowId),
					eq(schema.payoutRecords.projectId, projectId),
					eq(schema.payoutRecords.period, period),
					eq(schema.payoutRecords.source, 'allocated_from_company'),
					isNull(schema.payoutRecords.deletedAt)
				)
			)
			.limit(1);

		const note = `${ecc.label} è„�?${weightPct}% (company éˆ«?project)`;

		if (existingPayout) {
			await db
				.update(schema.payoutRecords)
				.set({
					baseValue: ecc.value,
					computedAmount: amount,
					taxableAmount,
					status: 'confirmed',
					note,
					updatedAt: now
				})
				.where(eq(schema.payoutRecords.id, existingPayout.id));
		} else {
			await db.insert(schema.payoutRecords).values({
				id: crypto.randomUUID(),
				componentId: shadowId,
				projectId,
				period,
				baseValue: ecc.value,
				computedAmount: amount,
				cpfEmployee: 0,
				cpfEmployer: 0,
				taxableAmount,
				status: 'confirmed',
				source: 'allocated_from_company',
				note,
				createdAt: now,
				updatedAt: now
			});
		}
		lines += 1;
	}

	if (lines === 0) {
		return {
			ok: false,
			message:
				'Nothing to settle: add monthly fixed company components (non-dividend), or check effective dates and allocation % on the employee master.'
		};
	}

	return { ok: true, lines };
}

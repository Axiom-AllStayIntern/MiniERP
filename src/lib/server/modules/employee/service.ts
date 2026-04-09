import { and, eq, isNull, or } from 'drizzle-orm';
import type { ModuleContext } from '../types';
import { createEvent } from '../event-bus';
import {
	CompensationComponentRepository,
	PayoutRepository,
	EmployeeCompensationRepository,
	AllocationRepository
} from './repository';
import {
	compensationComponents,
	employeeCompensationComponents,
	employeeProjectAllocations,
	payoutRecords
} from './schema';
import { projectEmployees } from '../project/schema';

// ---------------------------------------------------------------------------
// Helpers (absorbed from company-allocation-settle.ts)
// ---------------------------------------------------------------------------

export function allocationPeriodDay(monthYm: string): string {
	return `${monthYm}-01`;
}

export function periodCalendarMonth(period: string): string {
	if (period.length >= 7) return period.slice(0, 7);
	return period;
}

export function shadowCompensationComponentId(peId: string, eccId: string): string {
	return `alloc-${peId}-${eccId}`;
}

function monthStart(ym: string): string {
	return `${ym}-01`;
}

function sameCalendarMonth(isoDate: string | null | undefined, ym: string): boolean {
	if (!isoDate) return false;
	return periodCalendarMonth(isoDate) === ym;
}

// ---------------------------------------------------------------------------
// CompensationService
// ---------------------------------------------------------------------------

export class CompensationService {
	private compRepo: CompensationComponentRepository;
	private empCompRepo: EmployeeCompensationRepository;

	constructor(private ctx: ModuleContext) {
		this.compRepo = new CompensationComponentRepository(ctx.db);
		this.empCompRepo = new EmployeeCompensationRepository(ctx.db);
	}

	async getProjectComponents(projectEmployeeId: string) {
		return this.compRepo.findByProjectEmployee(projectEmployeeId);
	}

	async getEmployeeComponents(employeeId: string) {
		return this.empCompRepo.findByEmployee(employeeId);
	}

	async addProjectComponent(data: Record<string, unknown>) {
		return this.compRepo.create(data);
	}

	async removeProjectComponent(id: string) {
		return this.compRepo.softDelete(id);
	}

	async addEmployeeComponent(data: Record<string, unknown>) {
		return this.empCompRepo.create(data);
	}

	async removeEmployeeComponent(id: string) {
		return this.empCompRepo.softDelete(id);
	}
}

// ---------------------------------------------------------------------------
// SettlementService (absorbed from settle-project-components.ts + company-allocation-settle.ts)
// ---------------------------------------------------------------------------

export class SettlementService {
	constructor(private ctx: ModuleContext) {}

	/**
	 * Settle manual project compensation components for a given month.
	 * Absorbed from settle-project-components.ts
	 */
	async settleProjectComponents(params: {
		projectId: string;
		peId: string;
		monthYm: string;
	}): Promise<number> {
		const { db } = this.ctx;
		const { projectId, peId, monthYm } = params;
		if (!/^\d{4}-\d{2}$/.test(monthYm)) return 0;

		const components = await db
			.select()
			.from(compensationComponents)
			.where(
				and(
					eq(compensationComponents.projectEmployeeId, peId),
					or(eq(compensationComponents.origin, 'manual'), isNull(compensationComponents.origin)),
					isNull(compensationComponents.deletedAt)
				)
			);

		const period = monthStart(monthYm);
		const now = new Date().toISOString();
		let lines = 0;
		const [member] = await db
			.select({ personId: projectEmployees.personId, employeeId: projectEmployees.employeeId })
			.from(projectEmployees)
			.where(eq(projectEmployees.id, peId))
			.limit(1);
		const personId = member?.personId ?? member?.employeeId ?? peId;

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
				.select({ id: payoutRecords.id })
				.from(payoutRecords)
				.where(
					and(
						eq(payoutRecords.componentId, c.id),
						eq(payoutRecords.projectId, projectId),
						eq(payoutRecords.period, period),
						eq(payoutRecords.source, 'settlement'),
						isNull(payoutRecords.deletedAt)
					)
				)
				.limit(1);

			let payoutId: string;
			if (existing) {
				await db
					.update(payoutRecords)
					.set({
						baseValue: amount,
						computedAmount: amount,
						taxableAmount,
						status: 'confirmed',
						note,
						updatedAt: now
					})
					.where(eq(payoutRecords.id, existing.id));
				payoutId = existing.id;
			} else {
				const createdId = crypto.randomUUID();
				await db.insert(payoutRecords).values({
					id: createdId,
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
				payoutId = createdId;
			}

			await this.ctx.eventBus.emit(
				createEvent('payout.settled', 'employee', {
					payoutId,
					projectId,
					personId,
					amount,
					period
				})
			);
			lines += 1;
		}

		return lines;
	}

	/**
	 * Settle company-level salary allocation to a project for a given month.
	 * Absorbed from company-allocation-settle.ts
	 */
	async settleCompanyAllocation(params: {
		projectId: string;
		peId: string;
		employeeId: string;
		monthYm: string;
	}): Promise<{ ok: true; lines: number } | { ok: false; message: string }> {
		const { db } = this.ctx;
		const { projectId, peId, employeeId, monthYm } = params;
		if (!/^\d{4}-\d{2}$/.test(monthYm)) {
			return { ok: false, message: 'Invalid month.' };
		}

		const period = allocationPeriodDay(monthYm);
		const now = new Date().toISOString();

		const [allocationRow] = await db
			.select()
			.from(employeeProjectAllocations)
			.where(
				and(
					eq(employeeProjectAllocations.employeeId, employeeId),
					eq(employeeProjectAllocations.projectId, projectId),
					isNull(employeeProjectAllocations.deletedAt)
				)
			)
			.limit(1);

		const weightPct = allocationRow?.weightPct ?? 0;
		if (weightPct <= 0) {
			return { ok: false, message: 'No positive allocation weight for this project on the employee master.' };
		}

		const companyComponents = await db
			.select()
			.from(employeeCompensationComponents)
			.where(
				and(
					eq(employeeCompensationComponents.employeeId, employeeId),
					isNull(employeeCompensationComponents.deletedAt)
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
				.select({ id: compensationComponents.id })
				.from(compensationComponents)
				.where(eq(compensationComponents.id, shadowId))
				.limit(1);

			if (existingShadow.length > 0) {
				await db
					.update(compensationComponents)
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
					.where(eq(compensationComponents.id, shadowId));
			} else {
				await db.insert(compensationComponents).values({
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
				.select({ id: payoutRecords.id })
				.from(payoutRecords)
				.where(
					and(
						eq(payoutRecords.componentId, shadowId),
						eq(payoutRecords.projectId, projectId),
						eq(payoutRecords.period, period),
						eq(payoutRecords.source, 'allocated_from_company'),
						isNull(payoutRecords.deletedAt)
					)
				)
				.limit(1);

			const note = `${ecc.label} × ${weightPct}% (company → project)`;

			let payoutId: string;
			if (existingPayout) {
				await db
					.update(payoutRecords)
					.set({
						baseValue: ecc.value,
						computedAmount: amount,
						taxableAmount,
						status: 'confirmed',
						note,
						updatedAt: now
					})
					.where(eq(payoutRecords.id, existingPayout.id));
				payoutId = existingPayout.id;
			} else {
				const createdId = crypto.randomUUID();
				await db.insert(payoutRecords).values({
					id: createdId,
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
				payoutId = createdId;
			}

			await this.ctx.eventBus.emit(
				createEvent('payout.settled', 'employee', {
					payoutId,
					projectId,
					personId: employeeId,
					amount,
					period
				})
			);
			lines += 1;
		}

		if (lines === 0) {
			return {
				ok: false,
				message: 'Nothing to settle: add monthly fixed company components (non-dividend), or check effective dates and allocation % on the employee master.'
			};
		}

		return { ok: true, lines };
	}
}

// ---------------------------------------------------------------------------
// AllocationService
// ---------------------------------------------------------------------------

export class AllocationService {
	private repo: AllocationRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new AllocationRepository(ctx.db);
	}

	async getByEmployee(employeeId: string) {
		return this.repo.findByEmployee(employeeId);
	}

	async getByProject(projectId: string) {
		return this.repo.findByProject(projectId);
	}

	async saveAllocations(employeeId: string, allocations: { projectId: string; weightPct: number; effectiveFrom: string }[]) {
		// Soft-delete existing allocations
		const existing = await this.repo.findByEmployee(employeeId);
		for (const alloc of existing) {
			await this.repo.softDelete(alloc.id);
		}
		// Create new allocations
		for (const alloc of allocations) {
			await this.repo.create({
				employeeId,
				projectId: alloc.projectId,
				weightPct: alloc.weightPct,
				allocationMode: 'manual',
				effectiveFrom: alloc.effectiveFrom
			});
			await this.ctx.eventBus.emit(
				createEvent('allocation.updated', 'employee', {
					personId: employeeId,
					projectId: alloc.projectId,
					weightPct: alloc.weightPct
				})
			);
		}
	}
}

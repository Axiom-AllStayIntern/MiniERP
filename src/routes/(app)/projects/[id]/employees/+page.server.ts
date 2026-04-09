import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { periodCalendarMonth, settleCompanyAllocationMonth } from '$lib/server/company-allocation-settle';
import { getDb, schema } from '$lib/server/modules/legacy-db';
import {
	projectExpenseCogsSumExpr,
	projectExpenseOpexSumExpr
} from '$lib/server/project-expense-sums';
import {
	staffCostPayoutJoinConditions,
	staffCostSumExpr
} from '$lib/server/project-staff-cost';
import { runSettleManualProjectComponentsForMonth } from '$lib/server/settle-project-components';

function monthStart(ym: string): string {
	return `${ym}-01`;
}

function sameCalendarMonth(isoDate: string | null | undefined, ym: string): boolean {
	if (!isoDate) return false;
	return periodCalendarMonth(isoDate) === ym;
}

function initialsFromName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type RowStatus = 'paid' | 'confirmed' | 'draft' | 'pending' | 'off';

function settlementPayoutForComponent(
	payouts: Array<{ componentId: string; period: string; status: string; source: string }>,
	componentId: string,
	monthYm: string
): (typeof payouts)[number] | undefined {
	const period = monthStart(monthYm);
	return payouts.find(
		(p) =>
			p.componentId === componentId &&
			p.source === 'settlement' &&
			(p.period === period || periodCalendarMonth(p.period) === monthYm)
	);
}

function componentEligibleForMonth(
	c: { frequency: string; effectiveFrom: string; effectiveTo: string | null },
	monthYm: string
): boolean {
	const period = monthStart(monthYm);
	if (c.frequency === 'monthly') {
		if (c.effectiveFrom > period) return false;
		if (c.effectiveTo && c.effectiveTo < period) return false;
		return true;
	}
	if (c.frequency === 'one_off') {
		return sameCalendarMonth(c.effectiveFrom, monthYm);
	}
	return false;
}

export const load: PageServerLoad = async ({ params, platform, parent, url }) => {
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);

	const monthQ = url.searchParams.get('month');
	const selectedMonthYm =
		monthQ && /^\d{4}-\d{2}$/.test(monthQ) ? monthQ : new Date().toISOString().slice(0, 7);

	const y = Number(selectedMonthYm.slice(0, 4));
	const calMonth = Number(selectedMonthYm.slice(5, 7));
	const prevD = new Date(y, calMonth - 2, 1);
	const nextD = new Date(y, calMonth, 1);
	const prevMonthYm = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
	const nextMonthYm = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;

	const rosterRows = await db
		.select({
			pe: schema.projectEmployees,
			masterName: schema.employees.name
		})
		.from(schema.projectEmployees)
		.leftJoin(schema.employees, eq(schema.projectEmployees.employeeId, schema.employees.id))
		.where(and(eq(schema.projectEmployees.projectId, params.id), isNull(schema.projectEmployees.deletedAt)))
		.orderBy(asc(schema.projectEmployees.name));

	const roster = rosterRows.map((r) => ({
		...r.pe,
		masterName: r.masterName
	}));

	const assignedIds = roster.map((r) => r.employeeId);
	const peIds = roster.map((r) => r.id);

	const allocationRows =
		assignedIds.length > 0
			? await db
					.select()
					.from(schema.employeeProjectAllocations)
					.where(
						and(
							eq(schema.employeeProjectAllocations.projectId, params.id),
							inArray(schema.employeeProjectAllocations.employeeId, assignedIds),
							isNull(schema.employeeProjectAllocations.deletedAt)
						)
					)
			: [];

	const allocByEmployee = new Map(allocationRows.map((a) => [a.employeeId, a.weightPct ?? 0]));

	const allEmployees = await db
		.select({
			id: schema.employees.id,
			name: schema.employees.name,
			type: schema.employees.type,
			status: schema.employees.status
		})
		.from(schema.employees)
		.where(and(isNull(schema.employees.deletedAt), eq(schema.employees.status, 'active')))
		.orderBy(asc(schema.employees.name));

	const assignableEmployees = allEmployees.filter((e) => !assignedIds.includes(e.id));

	const [staffAllRow] = await db
		.select({ total: staffCostSumExpr() })
		.from(schema.payoutRecords)
		.innerJoin(
			schema.compensationComponents,
			eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
		)
		.where(and(eq(schema.payoutRecords.projectId, params.id), staffCostPayoutJoinConditions()));

	const [purchaseRow] = await db
		.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
		.from(schema.invoicesIn)
		.where(and(eq(schema.invoicesIn.projectId, params.id), isNull(schema.invoicesIn.deletedAt)));

	const expenseWhere = and(eq(schema.expenses.projectId, params.id), isNull(schema.expenses.deletedAt));
	const [expCogsRow, expOpexRow] = await Promise.all([
		db.select({ total: projectExpenseCogsSumExpr() }).from(schema.expenses).where(expenseWhere),
		db.select({ total: projectExpenseOpexSumExpr() }).from(schema.expenses).where(expenseWhere)
	]);
	const expenseTotal = (expCogsRow[0]?.total ?? 0) + (expOpexRow[0]?.total ?? 0);

	const staffCostAllTime = staffAllRow?.total ?? 0;
	const purchaseTotal = purchaseRow?.total ?? 0;
	const totalProjectCost = purchaseTotal + staffCostAllTime + expenseTotal;
	const staffPctOfTotalCost =
		totalProjectCost > 0 ? Math.round((staffCostAllTime / totalProjectCost) * 1000) / 10 : 0;

	const payoutList =
		peIds.length > 0
			? await db
					.select({
						id: schema.payoutRecords.id,
						period: schema.payoutRecords.period,
						computedAmount: schema.payoutRecords.computedAmount,
						taxableAmount: schema.payoutRecords.taxableAmount,
						status: schema.payoutRecords.status,
						source: schema.payoutRecords.source,
						componentId: schema.compensationComponents.id,
						componentLabel: schema.compensationComponents.label,
						incomeType: schema.compensationComponents.incomeType,
						projectEmployeeId: schema.compensationComponents.projectEmployeeId
					})
					.from(schema.payoutRecords)
					.innerJoin(
						schema.compensationComponents,
						eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
					)
					.where(
						and(
							eq(schema.payoutRecords.projectId, params.id),
							inArray(schema.compensationComponents.projectEmployeeId, peIds),
							isNull(schema.payoutRecords.deletedAt),
							isNull(schema.compensationComponents.deletedAt)
						)
					)
			: [];

	const manualComponents =
		peIds.length > 0
			? await db
					.select()
					.from(schema.compensationComponents)
					.where(
						and(
							inArray(schema.compensationComponents.projectEmployeeId, peIds),
							or(
								isNull(schema.compensationComponents.origin),
								eq(schema.compensationComponents.origin, 'manual')
							),
							isNull(schema.compensationComponents.deletedAt)
						)
					)
			: [];

	const payoutsByPe = new Map<string, typeof payoutList>();
	for (const p of payoutList) {
		const list = payoutsByPe.get(p.projectEmployeeId) ?? [];
		list.push(p);
		payoutsByPe.set(p.projectEmployeeId, list);
	}

	const componentsByPe = new Map<string, typeof manualComponents>();
	for (const c of manualComponents) {
		const list = componentsByPe.get(c.projectEmployeeId) ?? [];
		list.push(c);
		componentsByPe.set(c.projectEmployeeId, list);
	}

	const isStaffCostEligible = (p: (typeof payoutList)[number]) =>
		p.incomeType !== 'dividend' && (p.status === 'confirmed' || p.status === 'paid');
	const isDraft = (p: (typeof payoutList)[number]) => p.status === 'draft';

	const settledThisMonth = payoutList
		.filter((p) => periodCalendarMonth(p.period) === selectedMonthYm && isStaffCostEligible(p))
		.reduce((s, p) => s + p.computedAmount, 0);

	const draftPayoutsThisMonth = payoutList.filter(
		(p) => periodCalendarMonth(p.period) === selectedMonthYm && isDraft(p)
	);
	const pendingSettlementAmount = draftPayoutsThisMonth.reduce((s, p) => s + p.computedAmount, 0);
	let pendingComponentsCount = 0;

	const teamMembers = roster.map((pe, index) => {
		const pePayouts = payoutsByPe.get(pe.id) ?? [];
		const comps = componentsByPe.get(pe.id) ?? [];

		const settledPayouts = pePayouts.filter(isStaffCostEligible);
		const totalSettled = settledPayouts.reduce((s, p) => s + p.computedAmount, 0);
		const withDraft = pePayouts.filter(
			(p) =>
				p.incomeType !== 'dividend' &&
				(p.status === 'confirmed' || p.status === 'paid' || p.status === 'draft')
		);
		const totalWithDraft = withDraft.reduce((s, p) => s + p.computedAmount, 0);

		const draftMonthAmount = pePayouts
			.filter((p) => periodCalendarMonth(p.period) === selectedMonthYm && isDraft(p))
			.reduce((s, p) => s + p.computedAmount, 0);

		let pePendingComp = 0;
		const componentRows = comps.map((c) => {
			const sp = settlementPayoutForComponent(pePayouts, c.id, selectedMonthYm);
			let rowStatus: RowStatus = 'off';
			if (sp) {
				if (sp.status === 'paid') rowStatus = 'paid';
				else if (sp.status === 'confirmed') rowStatus = 'confirmed';
				else if (sp.status === 'draft') rowStatus = 'draft';
			} else if (componentEligibleForMonth(c, selectedMonthYm)) {
				rowStatus = 'pending';
				pePendingComp += 1;
			}
			return {
				id: c.id,
				label: c.label,
				amount: c.value ?? 0,
				taxable: c.taxable,
				frequency: c.frequency,
				incomeType: c.incomeType,
				rowStatus
			};
		});
		pendingComponentsCount += pePendingComp;

		const sortedPayouts = [...pePayouts].sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0));
		const recentPayouts = sortedPayouts.slice(0, 8).map((p) => ({
			period: p.period,
			label: p.componentLabel,
			amount: p.computedAmount,
			taxableAmount: p.taxableAmount,
			status: p.status,
			incomeType: p.incomeType
		}));

		const reimbursementTotal = settledPayouts
			.filter((p) => p.incomeType === 'reimbursement')
			.reduce((s, p) => s + p.computedAmount, 0);
		const taxableTotal = settledPayouts.reduce((s, p) => s + p.taxableAmount, 0);

		const allocationPct = allocByEmployee.get(pe.employeeId) ?? 0;

		return {
			peId: pe.id,
			name: pe.name,
			staffType: pe.staffType,
			role: pe.role,
			employeeId: pe.employeeId,
			masterName: pe.masterName,
			allocationPct,
			initials: initialsFromName(pe.name),
			avatarHue: index % 4,
			totalSettled,
			totalWithDraft,
			draftMonthAmount,
			hasPendingSettlement: draftMonthAmount > 0 || pePendingComp > 0,
			components: componentRows,
			recentPayouts,
			summary: {
				computedTotal: totalSettled,
				taxableTotal,
				reimbursementTotal
			}
		};
	});

	const monthLabel = new Date(`${selectedMonthYm}-01`).toLocaleString('en-SG', {
		month: 'short',
		year: 'numeric'
	});

	return {
		roster,
		assignableEmployees,
		teamMembers,
		selectedMonthYm,
		prevMonthYm,
		nextMonthYm,
		monthLabel,
		summaryStats: {
			totalStaffCost: staffCostAllTime,
			memberCount: roster.length,
			settledThisMonth,
			pendingSettlementAmount,
			pendingSettlementLabel:
				draftPayoutsThisMonth.length > 0 || pendingComponentsCount > 0
					? `${draftPayoutsThisMonth.length} draft payout(s) · ${pendingComponentsCount} unsettled component(s)`
					: 'None',
			staffPctOfTotalCost: staffPctOfTotalCost
		}
	};
};

export const actions: Actions = {
	settleAllForMonth: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const monthYm = String(form.get('monthYm') ?? '').trim();
		if (!/^\d{4}-\d{2}$/.test(monthYm)) return fail(400, { message: 'Select a month.' });

		const db = getDb(platform.env);
		const rosterRows = await db
			.select({ pe: schema.projectEmployees })
			.from(schema.projectEmployees)
			.where(
				and(eq(schema.projectEmployees.projectId, params.id), isNull(schema.projectEmployees.deletedAt))
			);

		let allocLines = 0;
		let allocSkipped = 0;
		let compLines = 0;

		for (const { pe } of rosterRows) {
			const ar = await settleCompanyAllocationMonth({
				db,
				projectId: params.id,
				peId: pe.id,
				employeeId: pe.employeeId,
				monthYm
			});
			if (ar.ok) allocLines += ar.lines;
			else allocSkipped += 1;

			compLines += await runSettleManualProjectComponentsForMonth({
				db,
				projectId: params.id,
				peId: pe.id,
				monthYm
			});
		}

		return {
			ok: true,
			message: `${monthYm}: posted ${allocLines} company-allocation payout line(s) (${allocSkipped} roster member(s) skipped—no allocation or nothing to settle), ${compLines} project component line(s).`
		};
	},
	addToProject: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const employeeId = String(form.get('employeeId') ?? '');
		const role = String(form.get('role') ?? '').trim() || null;
		const staffType = String(form.get('staffType') ?? 'fulltime');
		const dateIn = String(form.get('dateIn') ?? '').trim() || null;
		const dateOut = String(form.get('dateOut') ?? '').trim() || null;

		if (!employeeId) return fail(400, { message: 'Choose an employee.' });

		const db = getDb(platform.env);

		const [existing] = await db
			.select({ id: schema.projectEmployees.id })
			.from(schema.projectEmployees)
			.where(
				and(
					eq(schema.projectEmployees.projectId, params.id),
					eq(schema.projectEmployees.employeeId, employeeId),
					isNull(schema.projectEmployees.deletedAt)
				)
			)
			.limit(1);

		if (existing) return fail(400, { message: 'That employee is already on this project.' });

		const [emp] = await db
			.select()
			.from(schema.employees)
			.where(and(eq(schema.employees.id, employeeId), isNull(schema.employees.deletedAt)))
			.limit(1);

		if (!emp) return fail(400, { message: 'Employee not found.' });

		const peId = `pe-${params.id}-${employeeId}`;
		const now = new Date().toISOString();

		const [prior] = await db
			.select()
			.from(schema.projectEmployees)
			.where(
				and(eq(schema.projectEmployees.projectId, params.id), eq(schema.projectEmployees.employeeId, employeeId))
			)
			.limit(1);

		if (prior?.deletedAt) {
			await db
				.update(schema.projectEmployees)
				.set({
					name: emp.name,
					role,
					staffType: staffType as (typeof schema.projectEmployees.$inferInsert)['staffType'],
					dateIn,
					dateOut,
					cpfApplicable: emp.cpfApplicable,
					deletedAt: null,
					updatedAt: now
				})
				.where(eq(schema.projectEmployees.id, prior.id));
		} else {
			await db.insert(schema.projectEmployees).values({
				id: peId,
				projectId: params.id,
				employeeId,
				name: emp.name,
				role,
				staffType: staffType as (typeof schema.projectEmployees.$inferInsert)['staffType'],
				dateIn,
				dateOut,
				cpfApplicable: emp.cpfApplicable,
				createdAt: now,
				updatedAt: now
			});
		}

		return { ok: true };
	},
	removeFromProject: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const peId = String(form.get('peId') ?? '');
		if (!peId) return fail(400, { message: 'Missing assignment id.' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();

		const [pe] = await db
			.select({ id: schema.projectEmployees.id })
			.from(schema.projectEmployees)
			.where(
				and(
					eq(schema.projectEmployees.id, peId),
					eq(schema.projectEmployees.projectId, params.id),
					isNull(schema.projectEmployees.deletedAt)
				)
			)
			.limit(1);

		if (!pe) return fail(400, { message: 'Assignment not found.' });

		const components = await db
			.select({ id: schema.compensationComponents.id })
			.from(schema.compensationComponents)
			.where(
				and(
					eq(schema.compensationComponents.projectEmployeeId, peId),
					isNull(schema.compensationComponents.deletedAt)
				)
			);

		for (const c of components) {
			await db
				.update(schema.compensationComponents)
				.set({ deletedAt: now, updatedAt: now })
				.where(eq(schema.compensationComponents.id, c.id));
		}

		await db
			.update(schema.projectEmployees)
			.set({ deletedAt: now, updatedAt: now })
			.where(eq(schema.projectEmployees.id, peId));

		return { ok: true };
	}
};

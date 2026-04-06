import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { periodCalendarMonth, settleCompanyAllocationMonth } from '$lib/server/company-allocation-settle';
import { getDb, schema } from '$lib/server/db';

function monthStart(ym: string): string {
	return `${ym}-01`;
}

function sameCalendarMonth(isoDate: string | null | undefined, ym: string): boolean {
	if (!isoDate) return false;
	return periodCalendarMonth(isoDate) === ym;
}

export const load: PageServerLoad = async ({ params, platform, parent, url }) => {
	const parentData = await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);

	const monthQ = url.searchParams.get('month');
	const selectedMonthYm =
		monthQ && /^\d{4}-\d{2}$/.test(monthQ) ? monthQ : new Date().toISOString().slice(0, 7);

	const [pe] = await db
		.select()
		.from(schema.projectEmployees)
		.where(
			and(
				eq(schema.projectEmployees.id, params.peId),
				eq(schema.projectEmployees.projectId, params.id),
				isNull(schema.projectEmployees.deletedAt)
			)
		)
		.limit(1);

	if (!pe) throw error(404, 'Project assignment not found');

	const [employee] = await db
		.select()
		.from(schema.employees)
		.where(and(eq(schema.employees.id, pe.employeeId), isNull(schema.employees.deletedAt)))
		.limit(1);

	const [allocationRow] = await db
		.select()
		.from(schema.employeeProjectAllocations)
		.where(
			and(
				eq(schema.employeeProjectAllocations.employeeId, pe.employeeId),
				eq(schema.employeeProjectAllocations.projectId, params.id),
				isNull(schema.employeeProjectAllocations.deletedAt)
			)
		)
		.limit(1);

	const companyComponents = await db
		.select()
		.from(schema.employeeCompensationComponents)
		.where(
			and(
				eq(schema.employeeCompensationComponents.employeeId, pe.employeeId),
				isNull(schema.employeeCompensationComponents.deletedAt)
			)
		)
		.orderBy(desc(schema.employeeCompensationComponents.effectiveFrom));

	const weightPct = allocationRow?.weightPct ?? 0;
	const companyAllocationPreview = companyComponents.map((cc) => {
		let allocatedMonthly: number | null = null;
		if (weightPct > 0 && cc.ruleType === 'fixed' && cc.frequency === 'monthly') {
			allocatedMonthly = (cc.value * weightPct) / 100;
		}
		return {
			id: cc.id,
			label: cc.label,
			incomeType: cc.incomeType,
			ruleType: cc.ruleType,
			value: cc.value,
			frequency: cc.frequency,
			weightPct,
			allocatedMonthly
		};
	});

	const companyAllocatedEstimate = companyAllocationPreview.reduce(
		(s, r) => s + (r.allocatedMonthly ?? 0),
		0
	);

	const projectComponents = await db
		.select()
		.from(schema.compensationComponents)
		.where(
			and(
				eq(schema.compensationComponents.projectEmployeeId, pe.id),
				isNull(schema.compensationComponents.deletedAt),
				or(eq(schema.compensationComponents.origin, 'manual'), isNull(schema.compensationComponents.origin))
			)
		)
		.orderBy(desc(schema.compensationComponents.effectiveFrom));

	const payouts = await db
		.select({
			id: schema.payoutRecords.id,
			period: schema.payoutRecords.period,
			computedAmount: schema.payoutRecords.computedAmount,
			status: schema.payoutRecords.status,
			source: schema.payoutRecords.source,
			note: schema.payoutRecords.note,
			componentLabel: schema.compensationComponents.label,
			incomeType: schema.compensationComponents.incomeType
		})
		.from(schema.payoutRecords)
		.innerJoin(
			schema.compensationComponents,
			eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
		)
		.where(
			and(
				eq(schema.payoutRecords.projectId, params.id),
				eq(schema.compensationComponents.projectEmployeeId, pe.id),
				isNull(schema.payoutRecords.deletedAt),
				isNull(schema.compensationComponents.deletedAt)
			)
		)
		.orderBy(desc(schema.payoutRecords.period), desc(schema.payoutRecords.createdAt));

	const payoutsThisMonth = payouts.filter((p) => periodCalendarMonth(p.period) === selectedMonthYm);
	const isConfirmed = (p: (typeof payouts)[number]) => p.status === 'confirmed' || p.status === 'paid';
	const confirmedEligible = payoutsThisMonth.filter((p) => isConfirmed(p) && p.incomeType !== 'dividend');
	const confirmedStaffCostThisMonth = confirmedEligible.reduce((s, p) => s + p.computedAmount, 0);
	const allocatedSettledThisMonth = confirmedEligible
		.filter((p) => p.source === 'allocated_from_company')
		.reduce((s, p) => s + p.computedAmount, 0);
	const projectRulesSettledThisMonth = confirmedEligible
		.filter((p) => p.source === 'settlement')
		.reduce((s, p) => s + p.computedAmount, 0);
	const adjustmentSettledThisMonth = confirmedEligible
		.filter((p) => p.source === 'adjustment')
		.reduce((s, p) => s + p.computedAmount, 0);

	const y = Number(selectedMonthYm.slice(0, 4));
	const calMonth = Number(selectedMonthYm.slice(5, 7));
	const prevD = new Date(y, calMonth - 2, 1);
	const nextD = new Date(y, calMonth, 1);
	const prevMonthYm = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
	const nextMonthYm = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;

	return {
		project: parentData.project,
		pe,
		employee,
		allocationRow: allocationRow ?? null,
		companyAllocationPreview,
		companyAllocatedEstimate,
		projectComponents,
		payouts,
		selectedMonthYm,
		prevMonthYm,
		nextMonthYm,
		confirmedStaffCostThisMonth,
		allocatedSettledThisMonth,
		projectRulesSettledThisMonth,
		adjustmentSettledThisMonth
	};
};

export const actions: Actions = {
	updateAssignment: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const role = String(form.get('role') ?? '').trim() || null;
		const staffType = String(form.get('staffType') ?? 'fulltime');
		const dateIn = String(form.get('dateIn') ?? '').trim() || null;
		const dateOut = String(form.get('dateOut') ?? '').trim() || null;
		const cpfApplicable = form.get('cpfApplicable') === 'on';

		const db = getDb(platform.env);
		const now = new Date().toISOString();

		const [pe] = await db
			.select()
			.from(schema.projectEmployees)
			.where(
				and(
					eq(schema.projectEmployees.id, params.peId),
					eq(schema.projectEmployees.projectId, params.id),
					isNull(schema.projectEmployees.deletedAt)
				)
			)
			.limit(1);

		if (!pe) return fail(400, { message: 'Assignment not found.' });

		const [emp] = await db
			.select({ name: schema.employees.name })
			.from(schema.employees)
			.where(eq(schema.employees.id, pe.employeeId))
			.limit(1);

		await db
			.update(schema.projectEmployees)
			.set({
				name: emp?.name ?? pe.name,
				role,
				staffType: staffType as (typeof schema.projectEmployees.$inferInsert)['staffType'],
				dateIn,
				dateOut,
				cpfApplicable,
				updatedAt: now
			})
			.where(eq(schema.projectEmployees.id, params.peId));

		return { ok: true };
	},
	addProjectComponent: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const label = String(form.get('label') ?? '').trim();
		const incomeType = String(form.get('incomeType') ?? 'bonus');
		const ruleType = String(form.get('ruleType') ?? 'manual');
		const value = Number.parseFloat(String(form.get('value') ?? '0'));
		const frequency = String(form.get('frequency') ?? 'one_off');
		const effectiveFrom = String(form.get('effectiveFrom') ?? '').trim();
		const taxable = form.get('taxable') === 'on';

		if (!label) return fail(400, { message: 'Label is required.' });
		if (!effectiveFrom) return fail(400, { message: 'Effective from is required.' });

		const db = getDb(platform.env);
		const [pe] = await db
			.select({ id: schema.projectEmployees.id })
			.from(schema.projectEmployees)
			.where(
				and(
					eq(schema.projectEmployees.id, params.peId),
					eq(schema.projectEmployees.projectId, params.id),
					isNull(schema.projectEmployees.deletedAt)
				)
			)
			.limit(1);

		if (!pe) return fail(400, { message: 'Assignment not found.' });

		const now = new Date().toISOString();
		await db.insert(schema.compensationComponents).values({
			id: crypto.randomUUID(),
			projectEmployeeId: params.peId,
			origin: 'manual',
			employeeCompensationComponentId: null,
			label,
			incomeType: incomeType as (typeof schema.compensationComponents.$inferInsert)['incomeType'],
			ruleType: ruleType as (typeof schema.compensationComponents.$inferInsert)['ruleType'],
			value: Number.isFinite(value) ? value : 0,
			floor: null,
			cap: null,
			frequency: frequency as (typeof schema.compensationComponents.$inferInsert)['frequency'],
			taxable,
			effectiveFrom,
			effectiveTo: null,
			createdAt: now,
			updatedAt: now
		});

		return { ok: true };
	},
	removeProjectComponent: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const componentId = String(form.get('componentId') ?? '');
		if (!componentId) return fail(400, { message: 'Missing component id.' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();

		await db
			.update(schema.compensationComponents)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.compensationComponents.id, componentId),
					eq(schema.compensationComponents.projectEmployeeId, params.peId),
					or(eq(schema.compensationComponents.origin, 'manual'), isNull(schema.compensationComponents.origin)),
					isNull(schema.compensationComponents.deletedAt)
				)
			);

		return { ok: true };
	},
	settleCompanyAllocation: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const monthYm = String(form.get('monthYm') ?? '').trim();
		if (!/^\d{4}-\d{2}$/.test(monthYm)) return fail(400, { message: 'Select a month to settle.' });

		const db = getDb(platform.env);
		const [pe] = await db
			.select()
			.from(schema.projectEmployees)
			.where(
				and(
					eq(schema.projectEmployees.id, params.peId),
					eq(schema.projectEmployees.projectId, params.id),
					isNull(schema.projectEmployees.deletedAt)
				)
			)
			.limit(1);

		if (!pe) return fail(400, { message: 'Assignment not found.' });

		const result = await settleCompanyAllocationMonth({
			db,
			projectId: params.id,
			peId: params.peId,
			employeeId: pe.employeeId,
			monthYm
		});

		if (!result.ok) return fail(400, { message: result.message });

		return {
			ok: true,
			message: `Recorded ${result.lines} allocated line(s) for ${monthYm} (confirmed, staff cost).`
		};
	},
	settleProjectComponents: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const monthYm = String(form.get('monthYm') ?? '').trim();
		if (!/^\d{4}-\d{2}$/.test(monthYm)) return fail(400, { message: 'Select a month to settle.' });

		const db = getDb(platform.env);
		const [pe] = await db
			.select({ id: schema.projectEmployees.id })
			.from(schema.projectEmployees)
			.where(
				and(
					eq(schema.projectEmployees.id, params.peId),
					eq(schema.projectEmployees.projectId, params.id),
					isNull(schema.projectEmployees.deletedAt)
				)
			)
			.limit(1);
		if (!pe) return fail(400, { message: 'Assignment not found.' });

		const components = await db
			.select()
			.from(schema.compensationComponents)
			.where(
				and(
					eq(schema.compensationComponents.projectEmployeeId, params.peId),
					or(eq(schema.compensationComponents.origin, 'manual'), isNull(schema.compensationComponents.origin)),
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
						eq(schema.payoutRecords.projectId, params.id),
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
					projectId: params.id,
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

		if (lines === 0) {
			return fail(400, {
				message:
					'No settle-eligible project components for this month. Currently supported: monthly and one_off manual components.'
			});
		}

		return {
			ok: true,
			message: `Recorded ${lines} project component payout line(s) for ${monthYm} (confirmed).`
		};
	}
};

import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);
	const [employee] = await db
		.select()
		.from(schema.employees)
		.where(and(eq(schema.employees.id, params.id), isNull(schema.employees.deletedAt)))
		.limit(1);

	if (!employee) throw error(404, 'Employee not found');

	const [companyComponents, allocations, participation] = await Promise.all([
		db
			.select()
			.from(schema.employeeCompensationComponents)
			.where(
				and(
					eq(schema.employeeCompensationComponents.employeeId, params.id),
					isNull(schema.employeeCompensationComponents.deletedAt)
				)
			)
			.orderBy(desc(schema.employeeCompensationComponents.effectiveFrom)),
		db
			.select({
				id: schema.employeeProjectAllocations.id,
				projectId: schema.employeeProjectAllocations.projectId,
				projectName: schema.projects.name,
				weightPct: schema.employeeProjectAllocations.weightPct,
				allocationMode: schema.employeeProjectAllocations.allocationMode,
				effectiveFrom: schema.employeeProjectAllocations.effectiveFrom
			})
			.from(schema.employeeProjectAllocations)
			.innerJoin(schema.projects, eq(schema.employeeProjectAllocations.projectId, schema.projects.id))
			.where(
				and(
					eq(schema.employeeProjectAllocations.employeeId, params.id),
					isNull(schema.employeeProjectAllocations.deletedAt),
					isNull(schema.projects.deletedAt)
				)
			)
			.orderBy(asc(schema.projects.name)),
		db
			.select({
				peId: schema.projectEmployees.id,
				projectId: schema.projectEmployees.projectId,
				projectName: schema.projects.name,
				role: schema.projectEmployees.role,
				dateIn: schema.projectEmployees.dateIn,
				dateOut: schema.projectEmployees.dateOut,
				staffType: schema.projectEmployees.staffType
			})
			.from(schema.projectEmployees)
			.innerJoin(schema.projects, eq(schema.projectEmployees.projectId, schema.projects.id))
			.where(
				and(
					eq(schema.projectEmployees.employeeId, params.id),
					isNull(schema.projectEmployees.deletedAt),
					isNull(schema.projects.deletedAt)
				)
			)
			.orderBy(asc(schema.projects.name))
	]);

	const allocationByProjectId = Object.fromEntries(allocations.map((a) => [a.projectId, a.weightPct] as const));

	return {
		employee,
		companyComponents,
		allocations,
		allocationByProjectId,
		participation
	};
};

export const actions: Actions = {
	updateProfile: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? 'full_time');
		const status = String(form.get('status') ?? 'active');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const contact = String(form.get('contact') ?? '').trim();
		const taxId = String(form.get('taxId') ?? '').trim();
		const taxResidentLabel = String(form.get('taxResidentLabel') ?? '').trim();
		const cpfApplicable = form.get('cpfApplicable') === 'on';

		if (!name) return fail(400, { message: 'Employee name is required.' });

		const db = getDb(platform.env);
		await db
			.update(schema.employees)
			.set({
				name,
				type: type as (typeof schema.employees.$inferInsert)['type'],
				status,
				startDate: startDate || null,
				endDate: endDate || null,
				contact: contact || null,
				taxId: taxId || null,
				cpfApplicable,
				taxResidentLabel: taxResidentLabel || null,
				updatedAt: new Date().toISOString()
			})
			.where(and(eq(schema.employees.id, params.id), isNull(schema.employees.deletedAt)));

		return { ok: true };
	},
	addCompanyComponent: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const label = String(form.get('label') ?? '').trim();
		const incomeType = String(form.get('incomeType') ?? 'salary');
		const ruleType = String(form.get('ruleType') ?? 'fixed');
		const value = Number.parseFloat(String(form.get('value') ?? '0'));
		const frequency = String(form.get('frequency') ?? 'monthly');
		const effectiveFrom = String(form.get('effectiveFrom') ?? '').trim();
		const taxable = form.get('taxable') === 'on';

		if (!label) return fail(400, { message: 'Component label is required.' });
		if (!effectiveFrom) return fail(400, { message: 'Effective from date is required.' });

		const db = getDb(platform.env);
		await db.insert(schema.employeeCompensationComponents).values({
			id: crypto.randomUUID(),
			employeeId: params.id,
			label,
			incomeType: incomeType as (typeof schema.employeeCompensationComponents.$inferInsert)['incomeType'],
			ruleType: ruleType as (typeof schema.employeeCompensationComponents.$inferInsert)['ruleType'],
			value: Number.isFinite(value) ? value : 0,
			floor: null,
			cap: null,
			frequency: frequency as (typeof schema.employeeCompensationComponents.$inferInsert)['frequency'],
			taxable,
			effectiveFrom,
			effectiveTo: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		return { ok: true };
	},
	removeCompanyComponent: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const componentId = String(form.get('componentId') ?? '');
		if (!componentId) return fail(400, { message: 'Missing component id.' });

		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.employeeCompensationComponents)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.employeeCompensationComponents.id, componentId),
					eq(schema.employeeCompensationComponents.employeeId, params.id),
					isNull(schema.employeeCompensationComponents.deletedAt)
				)
			);

		return { ok: true };
	},
	saveAllocations: async ({ params, request, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const form = await request.formData();
		const effectiveFrom = String(form.get('effectiveFrom') ?? '').trim() || new Date().toISOString().slice(0, 10);

		const db = getDb(platform.env);
		const participating = await db
			.select({ projectId: schema.projectEmployees.projectId })
			.from(schema.projectEmployees)
			.where(and(eq(schema.projectEmployees.employeeId, params.id), isNull(schema.projectEmployees.deletedAt)));

		const weights: { projectId: string; pct: number }[] = [];
		for (const row of participating) {
			const raw = String(form.get(`w_${row.projectId}`) ?? '').trim();
			if (!raw) continue;
			const pct = Number.parseFloat(raw);
			if (!Number.isFinite(pct) || pct <= 0) continue;
			weights.push({ projectId: row.projectId, pct });
		}

		const sum = weights.reduce((a, b) => a + b.pct, 0);
		if (weights.length > 0 && Math.abs(sum - 100) > 0.02) {
			return fail(400, {
				message: `Project weights must sum to 100% (currently ${sum.toFixed(2)}%).`
			});
		}

		const now = new Date().toISOString();
		await db
			.update(schema.employeeProjectAllocations)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.employeeProjectAllocations.employeeId, params.id),
					isNull(schema.employeeProjectAllocations.deletedAt)
				)
			);

		for (const row of weights) {
			await db.insert(schema.employeeProjectAllocations).values({
				id: crypto.randomUUID(),
				employeeId: params.id,
				projectId: row.projectId,
				weightPct: row.pct,
				allocationMode: 'manual',
				effectiveFrom,
				effectiveTo: null,
				createdAt: now,
				updatedAt: now
			});
		}

		return { ok: true };
	},
	deleteEmployee: async ({ params, platform }) => {
		if (!platform) return fail(500, { message: 'Cloudflare platform bindings are required' });
		const db = getDb(platform.env);
		const now = new Date().toISOString();
		await db
			.update(schema.employees)
			.set({ deletedAt: now, updatedAt: now, status: 'inactive' })
			.where(and(eq(schema.employees.id, params.id), isNull(schema.employees.deletedAt)));

		throw redirect(303, '/employees');
	}
};

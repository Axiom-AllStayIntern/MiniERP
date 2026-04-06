import { and, asc, eq, isNull } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getDb, schema } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	await parent();
	if (!platform) throw error(500, 'Cloudflare platform bindings are required');

	const db = getDb(platform.env);

	const rosterRows = await db
		.select({
			pe: schema.projectEmployees,
			masterName: schema.employees.name
		})
		.from(schema.projectEmployees)
		.leftJoin(schema.employees, eq(schema.projectEmployees.employeeId, schema.employees.id))
		.where(and(eq(schema.projectEmployees.projectId, params.id), isNull(schema.projectEmployees.deletedAt)))
		.orderBy(asc(schema.projectEmployees.name));

	const assignedIds = await db
		.select({ employeeId: schema.projectEmployees.employeeId })
		.from(schema.projectEmployees)
		.where(and(eq(schema.projectEmployees.projectId, params.id), isNull(schema.projectEmployees.deletedAt)));

	const assignedSet = new Set(assignedIds.map((r) => r.employeeId));

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

	const assignableEmployees = allEmployees.filter((e) => !assignedSet.has(e.id));

	return {
		roster: rosterRows.map((r) => ({
			...r.pe,
			masterName: r.masterName
		})),
		assignableEmployees
	};
};

export const actions: Actions = {
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
			.where(and(eq(schema.projectEmployees.projectId, params.id), eq(schema.projectEmployees.employeeId, employeeId)))
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
				and(eq(schema.compensationComponents.projectEmployeeId, peId), isNull(schema.compensationComponents.deletedAt))
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

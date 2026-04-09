import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createProjectApi } from '$lib/server/modules/project/api';
import { createArApi } from '$lib/server/modules/ar/api';
import { createEmployeeApi } from '$lib/server/modules/employee/api';
import { createExpenseApi } from '$lib/server/modules/expense/api';
import { NotFoundError } from '$lib/server/modules/errors';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);
		const ar = createArApi(ctx);
		const employee = createEmployeeApi(ctx);
		const expense = createExpenseApi(ctx);

		const p = await project.getById(event.params.id);

		const financials = await project.getProjectFinancials(event.params.id, {
			getRevenue: () => ar.getProjectRevenue(event.params.id),
			getPurchaseCost: () => ar.getProjectPurchaseCost(event.params.id),
			getStaffCost: () => employee.getProjectStaffCost(event.params.id),
			getExpenseSums: () => expense.getProjectExpenseSums(event.params.id)
		});

		return ok({
			...p,
			profit: {
				revenue: financials.revenue,
				cost: financials.purchaseCost + financials.staffCost + financials.expenseCogs + financials.expenseOpex,
				net: financials.netProfit
			}
		});
	} catch (e) {
		if (e instanceof NotFoundError) return fail(e.message, 404);
		return fail((e as Error).message, 500);
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);

		// Verify project exists
		await project.getById(event.params.id);

		const body = (await event.request.json()) as {
			name?: string;
			status?: string;
			description?: string | null;
			startDate?: string | null;
			endDate?: string | null;
		};

		const updates: Record<string, unknown> = {};
		if (body.name !== undefined) updates.name = body.name;
		if (body.status !== undefined) updates.status = body.status;
		if (body.description !== undefined) updates.description = body.description;
		if (body.startDate !== undefined) updates.startDate = body.startDate;
		if (body.endDate !== undefined) updates.endDate = body.endDate;

		await project.update(event.params.id, updates);

		return ok({ id: event.params.id, updated: true });
	} catch (e) {
		if (e instanceof NotFoundError) return fail(e.message, 404);
		return fail((e as Error).message, 500);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);

		await project.softDelete(event.params.id);

		return ok({ id: event.params.id, deleted: true });
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

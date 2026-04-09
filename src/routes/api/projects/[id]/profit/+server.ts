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

		// Verify project exists
		await project.getById(event.params.id);

		const financials = await project.getProjectFinancials(event.params.id, {
			getRevenue: () => ar.getProjectRevenue(event.params.id),
			getPurchaseCost: () => ar.getProjectPurchaseCost(event.params.id),
			getStaffCost: () => employee.getProjectStaffCost(event.params.id),
			getExpenseSums: () => expense.getProjectExpenseSums(event.params.id)
		});

		return ok({
			revenue: financials.revenue,
			purchaseCost: financials.purchaseCost,
			staffCost: financials.staffCost,
			expenseCost: financials.expenseCogs + financials.expenseOpex,
			expenseCogsCost: financials.expenseCogs,
			expenseOpexCost: financials.expenseOpex,
			grossProfit: financials.grossProfit,
			profit: financials.netProfit
		});
	} catch (e) {
		if (e instanceof NotFoundError) return fail(e.message, 404);
		return fail((e as Error).message, 500);
	}
};

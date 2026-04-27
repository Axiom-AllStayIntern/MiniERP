import type { RequestHandler } from './$types';

import { createModuleContext } from '$lib/server/modules';
import { createProjectApi } from '../../../../../modules/project';
import { createEmployeeApi } from '../../../../../modules/hr';
import { createFinanceApi } from '../../../../../modules/finance';
import { NotFoundError } from '$lib/server/modules/errors';
import { fail, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);
		const finance = createFinanceApi(ctx);
		const billing = finance.billing;
		const employee = createEmployeeApi(ctx);
		const expenses = finance.expenses;

		// Verify project exists
		await project.getById(event.params.id);

		const financials = await project.getProjectFinancials(event.params.id, {
			getRevenue: () => billing.getProjectRevenue(event.params.id),
			getPurchaseCost: () => billing.getProjectPurchaseCost(event.params.id),
			getStaffCost: () => employee.getProjectStaffCost(event.params.id),
			getExpenseSums: async () => {
				const sums = await expenses.getProjectExpenseSums(event.params.id);
				return { cogs: sums.salesCost, opex: sums.opex };
			}
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

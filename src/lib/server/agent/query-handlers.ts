import type { QueryContext, QueryDataResult } from './types';
import { createFinanceApi } from '../../../modules/finance';
import { createProjectApi } from '../../../modules/project';
import { createEmployeeApi } from '../../../modules/hr';
import { createWorkerContext } from '../../../platform/context';

async function resolveProjectId(
	project: ReturnType<typeof createProjectApi>,
	params: Record<string, unknown>
): Promise<{ id: string; name: string } | null> {
	const projectId = params.project_id as string | undefined;
	const projectName = params.project_name as string | undefined;

	if (projectId) {
		try {
			const p = await project.getById(projectId);
			return { id: p.id, name: p.name };
		} catch {
			return null;
		}
	}

	if (projectName) {
		const rows = await project.list({ q: projectName, pageSize: 5 });
		const needle = projectName.toLowerCase();

		const exact = rows.find((r) => r.project.name.toLowerCase() === needle);
		if (exact) return { id: exact.project.id, name: exact.project.name };

		const partial = rows.find((r) => r.project.name.toLowerCase().includes(needle));
		if (partial) return { id: partial.project.id, name: partial.project.name };
	}

	return null;
}

/**
 * Public function to resolve project_name to project_id.
 * Used by executor when entry contains [id] placeholder but only project_name is available.
 */
export async function resolveProjectIdByName(
	ctx: QueryContext,
	projectName: string
): Promise<string | null> {
	try {
		const moduleCtx = await createWorkerContext(ctx.env, {
			id: ctx.userId,
			email: '',
			role: ctx.userRole as 'owner' | 'finance' | 'project_manager' | 'employee'
		});
		const project = createProjectApi(moduleCtx);
		const resolved = await resolveProjectId(project, { project_name: projectName });
		return resolved?.id ?? null;
	} catch {
		return null;
	}
}

async function handleProjectProfitQuery(
	ctx: QueryContext,
	params: Record<string, unknown>
): Promise<QueryDataResult> {
	try {
		const moduleCtx = await createWorkerContext(ctx.env, {
			id: ctx.userId,
			email: '',
			role: ctx.userRole as 'owner' | 'finance' | 'project_manager' | 'employee'
		});

		const project = createProjectApi(moduleCtx);
		const resolved = await resolveProjectId(project, params);

		if (!resolved) {
			return { success: false, error: 'A project name or ID is required to look up profit.' };
		}

		const employee = createEmployeeApi(moduleCtx);
		const finance = createFinanceApi(moduleCtx);

		const financials = await project.getProjectFinancials(resolved.id, {
			getRevenue: () => finance.billing.getProjectRevenue(resolved.id),
			getPurchaseCost: () => finance.billing.getProjectPurchaseCost(resolved.id),
			getStaffCost: () => employee.getProjectStaffCost(resolved.id),
			getExpenseSums: async () => {
				const sums = await finance.expenses.getProjectExpenseSums(resolved.id);
				return { cogs: sums.salesCost, opex: sums.opex };
			}
		});

		const totalCost =
			financials.purchaseCost + financials.staffCost + financials.expenseCogs + financials.expenseOpex;
		const profitMargin = financials.revenue > 0 ? (financials.netProfit / financials.revenue) * 100 : 0;

		return {
			success: true,
			data: {
				project_name: resolved.name,
				project_id: resolved.id,
				revenue: financials.revenue,
				total_cost: totalCost,
				purchase_cost: financials.purchaseCost,
				staff_cost: financials.staffCost,
				expense_cogs: financials.expenseCogs,
				expense_opex: financials.expenseOpex,
				gross_profit: financials.grossProfit,
				net_profit: financials.netProfit,
				profit_margin_pct: Math.round(profitMargin * 10) / 10
			}
		};
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
}

async function handleProjectListQuery(
	ctx: QueryContext,
	_params: Record<string, unknown>
): Promise<QueryDataResult> {
	try {
		const moduleCtx = await createWorkerContext(ctx.env, {
			id: ctx.userId,
			email: '',
			role: ctx.userRole as 'owner' | 'finance' | 'project_manager' | 'employee'
		});

		const project = createProjectApi(moduleCtx);
		const rows = await project.list({ page: 1, pageSize: 10, status: 'active' });

		return {
			success: true,
			data: {
				count: rows.length,
				projects: rows.map((r) => ({
					id: r.project.id,
					name: r.project.name,
					status: r.project.status,
					customer_name: r.customerName
				}))
			}
		};
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
}

async function handleInvoiceListQuery(
	ctx: QueryContext,
	params: Record<string, unknown>
): Promise<QueryDataResult> {
	try {
		const moduleCtx = await createWorkerContext(ctx.env, {
			id: ctx.userId,
			email: '',
			role: ctx.userRole as 'owner' | 'finance' | 'project_manager' | 'employee'
		});

		const finance = createFinanceApi(moduleCtx);
		const projectId = params.project_id as string | undefined;

		if (projectId) {
			const invoices = await finance.billing.getCustomerInvoicesByProject(projectId);
			return {
				success: true,
				data: {
					count: invoices.length,
					invoices: invoices.slice(0, 10).map((inv) => ({
						id: inv.id,
						invoice_no: inv.invoiceNo,
						subtotal: inv.subtotal,
						total: inv.total,
						currency: inv.currency,
						status: inv.status,
						date: inv.date
					}))
				}
			};
		}

		return {
			success: false,
			error: 'Listing all invoices is not supported; specify a project.'
		};
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
}

const queryHandlers: Record<
	string,
	(ctx: QueryContext, params: Record<string, unknown>) => Promise<QueryDataResult>
> = {
	view_project_profit: handleProjectProfitQuery,
	view_projects: handleProjectListQuery,
	view_customer_invoices: handleInvoiceListQuery
};

export async function executeQuery(
	ctx: QueryContext,
	actionId: string,
	params: Record<string, unknown>
): Promise<QueryDataResult> {
	const handler = queryHandlers[actionId];
	if (!handler) {
		return { success: false, error: `Query handler "${actionId}" is not implemented.` };
	}
	return handler(ctx, params);
}

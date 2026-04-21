import { desc, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';
import type { ExpenseType, ExpenseCategory } from '$lib/constants/expense-upload';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform) {
		return { expenses: [], employees: [], totals: { total: 0, opex: 0, salesCost: 0 } };
	}

	const db = getDb(platform.env);

	const expenseRows = await db
		.select({
			id: schema.expenses.id,
			projectId: schema.expenses.projectId,
			projectName: schema.projects.name,
			expenseType: schema.expenses.expenseType,
			category: schema.expenses.category,
			docType: schema.expenses.docType,
			date: schema.expenses.date,
			amount: schema.expenses.amount,
			currency: schema.expenses.currency,
			sgdEquivalent: schema.expenses.sgdEquivalent,
			gstAmount: schema.expenses.gstAmount,
			vendorOrSupplier: schema.expenses.vendorOrSupplier,
			staffName: schema.expenses.staffName,
			reimbursement: schema.expenses.reimbursement,
			businessTrip: schema.expenses.businessTrip,
			destination: schema.expenses.destination,
			documentRef: schema.expenses.documentRef,
			notes: schema.expenses.notes,
			createdAt: schema.expenses.createdAt
		})
		.from(schema.expenses)
		.leftJoin(schema.projects, eq(schema.expenses.projectId, schema.projects.id))
		.where(isNull(schema.expenses.deletedAt))
		.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt));

	const expenses = expenseRows.map((row) => ({
		...row,
		hasAttachment: Boolean(row.documentRef && !row.documentRef.startsWith('manual://'))
	}));

	const employees = await db
		.select({
			id: schema.employees.id,
			name: schema.employees.name
		})
		.from(schema.employees)
		.where(isNull(schema.employees.deletedAt))
		.orderBy(schema.employees.name);

	const totals = expenses.reduce(
		(acc, exp) => {
			const amt = exp.sgdEquivalent ?? exp.amount ?? 0;
			acc.total += amt;
			if (exp.expenseType === 'sales_cost') {
				acc.salesCost += amt;
			} else {
				acc.opex += amt;
			}
			return acc;
		},
		{ total: 0, opex: 0, salesCost: 0 }
	);

	return { expenses, employees, totals };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		if (!platform) {
			return fail(500, { error: 'Platform not available' });
		}

		const formData = await request.formData();
		const db = getDb(platform.env);
		const now = new Date().toISOString();

		const id = crypto.randomUUID();
		const expenseType = (formData.get('expenseType') as ExpenseType) || 'opex';
		const category = (formData.get('category') as string) || 'others';
		const amount = Number(formData.get('amount') || 0);
		const currency = String(formData.get('currency') || 'SGD').trim().toUpperCase();
		const date = String(formData.get('date') || now.slice(0, 10));
		const vendorOrSupplier = String(formData.get('vendorOrSupplier') || '') || null;
		const staffName = String(formData.get('staffName') || '') || null;
		const reimbursement = formData.get('reimbursement') === 'on';
		const businessTripVal = formData.get('businessTrip') === 'on';
		const destinationVal = String(formData.get('destination') || '') || null;
		const notes = String(formData.get('notes') || '') || null;

		const sgdEq = await resolveSgdEquivalentForWrite({ amount, currency, dateYmd: date });
		await db.insert(schema.expenses).values({
			id,
			projectId: null,
			expenseType,
			category,
			date,
			amount,
			currency,
			sgdEquivalent: sgdEq,
			gstAmount: 0,
			vendorOrSupplier,
			staffName,
			reimbursement,
			businessTrip: businessTripVal,
			destination: destinationVal,
			notes,
			createdAt: now,
			updatedAt: now
		});

		return { success: true };
	}
};

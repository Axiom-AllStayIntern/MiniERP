import { desc, isNull, eq, and, inArray } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

import { parseDocumentMetadata } from '$lib/server/document-metadata';
import { getDb, schema } from '$lib/server/modules/legacy-db';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';
import { ALLOWANCE_RATES } from '$lib/constants/expense-upload';

const DOCUMENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, platform, parent }) => {
	const { project } = await parent();

	if (!platform) {
		return {
			expenses: [],
			employees: [],
			totals: { total: 0, opex: 0, salesCost: 0 },
			businessTrips: []
		};
	}

	const db = getDb(platform.env);
	const projectId = params.id;

	const expenseRows = await db
		.select({
			id: schema.expenses.id,
			expenseType: schema.expenses.expenseType,
			category: schema.expenses.category,
			docType: schema.expenses.docType,
			amount: schema.expenses.amount,
			sgdEquivalent: schema.expenses.sgdEquivalent,
			currency: schema.expenses.currency,
			date: schema.expenses.date,
			gstAmount: schema.expenses.gstAmount,
			vendorOrSupplier: schema.expenses.vendorOrSupplier,
			staffName: schema.expenses.staffName,
			reimbursement: schema.expenses.reimbursement,
			businessTrip: schema.expenses.businessTrip,
			destination: schema.expenses.destination,
			documentRef: schema.expenses.documentRef,
			metadata: schema.expenses.metadata,
			notes: schema.expenses.notes,
			createdAt: schema.expenses.createdAt
		})
		.from(schema.expenses)
		.where(and(eq(schema.expenses.projectId, projectId), isNull(schema.expenses.deletedAt)))
		.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt));

	const docIdRefs = [
		...new Set(
			expenseRows
				.map((e) => e.documentRef)
				.filter((r): r is string => !!r && DOCUMENT_ID_RE.test(r))
		)
	];
	const fileKeyByDocumentId = new Map<string, string>();
	if (docIdRefs.length > 0) {
		const docRows = await db
			.select({ id: schema.documents.id, fileKey: schema.documents.fileKey })
			.from(schema.documents)
			.where(inArray(schema.documents.id, docIdRefs));
		for (const d of docRows) {
			fileKeyByDocumentId.set(d.id, d.fileKey);
		}
	}

	function resolveStorageKey(documentRef: string | null): string | null {
		if (!documentRef || documentRef.startsWith('manual://')) return null;
		if (DOCUMENT_ID_RE.test(documentRef)) {
			return fileKeyByDocumentId.get(documentRef) ?? null;
		}
		return documentRef;
	}

	const expenses = expenseRows.map((exp) => {
		const storageKey = resolveStorageKey(exp.documentRef);
		const hasAttachment = Boolean(exp.documentRef && !exp.documentRef.startsWith('manual://'));
		const meta = parseDocumentMetadata(exp.metadata ?? null);
		let statusLabel = '—';
		if (meta.parseStatus === 'reviewed') statusLabel = 'Reviewed';
		else if (meta.parseStatus === 'parsed') statusLabel = 'Parsed';
		else if (meta.parseStatus === 'not_parsed') statusLabel = 'Pending review';
		else if (storageKey || (exp.documentRef && !exp.documentRef.startsWith('manual://')))
			statusLabel = 'Document';
		else statusLabel = 'Manual';

		return {
			...exp,
			projectName: project.name,
			hasAttachment,
			statusLabel
		};
	});

	const totals = expenseRows.reduce(
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

	const employees = await db
		.select({
			id: schema.employees.id,
			name: schema.employees.name
		})
		.from(schema.employees)
		.where(isNull(schema.employees.deletedAt))
		.orderBy(schema.employees.name);

	let businessTrips: Array<{
		id: string;
		destination: string | null;
		startDate: string | null;
		endDate: string | null;
		days: number | null;
		dailyAllowanceRate: number | null;
	}> = [];
	try {
		businessTrips = await db
			.select({
				id: schema.businessTrips.id,
				destination: schema.businessTrips.destination,
				startDate: schema.businessTrips.startDate,
				endDate: schema.businessTrips.endDate,
				days: schema.businessTrips.days,
				dailyAllowanceRate: schema.businessTrips.dailyAllowanceRate
			})
			.from(schema.businessTrips)
			.where(and(eq(schema.businessTrips.projectId, projectId), isNull(schema.businessTrips.deletedAt)))
			.orderBy(desc(schema.businessTrips.startDate));
	} catch {
		businessTrips = [];
	}

	return { expenses, employees, totals, businessTrips, project };
};

export const actions: Actions = {
	create: async ({ request, platform, params }) => {
		if (!platform) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const db = getDb(platform.env);
		const now = new Date().toISOString();

		const id = crypto.randomUUID();
		const expenseType = (formData.get('expenseType') as string) || 'opex';
		const category = String(formData.get('category') || 'others');
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
			projectId: params.id,
			expenseType: expenseType as 'opex' | 'sales_cost',
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
	},

	createTrip: async ({ request, platform, params }) => {
		if (!platform) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const db = getDb(platform.env);
		const now = new Date().toISOString();

		const employeeId = String(formData.get('employeeId'));
		const destination = String(formData.get('destination'));
		const startDate = String(formData.get('startDate'));
		const endDate = String(formData.get('endDate'));
		const dailyAllowanceRate = Number(formData.get('dailyAllowanceRate') || 50);

		if (!employeeId || !destination || !startDate || !endDate) {
			return fail(400, { error: 'Missing required fields' });
		}

		const start = new Date(startDate);
		const end = new Date(endDate);
		const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		if (days < 1) return fail(400, { error: 'End date must be after start date' });

		const [employee] = await db
			.select({ name: schema.employees.name })
			.from(schema.employees)
			.where(eq(schema.employees.id, employeeId))
			.limit(1);

		const tripId = crypto.randomUUID();

		await db.insert(schema.businessTrips).values({
			id: tripId,
			employeeId,
			projectId: params.id,
			destination,
			startDate,
			endDate,
			days,
			dailyAllowanceRate,
			status: 'active',
			createdAt: now,
			updatedAt: now
		});

		const allowanceAmount = days * dailyAllowanceRate;
		await db.insert(schema.expenses).values({
			id: crypto.randomUUID(),
			projectId: params.id,
			expenseType: 'opex',
			category: 'allowance',
			date: startDate,
			amount: allowanceAmount,
			currency: 'SGD',
			sgdEquivalent: allowanceAmount,
			gstAmount: 0,
			staffName: employee?.name || null,
			reimbursement: false,
			businessTrip: true,
			destination,
			notes: `Travel allowance: ${destination} (${days} days @ $${dailyAllowanceRate}/day)`,
			metadata: JSON.stringify({
				days,
				daily_rate: dailyAllowanceRate,
				date_start: startDate,
				date_end: endDate
			}),
			createdAt: now,
			updatedAt: now
		});

		return { success: true, tripId };
	}
};

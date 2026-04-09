import { and, between, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';
import { estimateSingaporeResidentTax } from '$lib/server/singapore-resident-tax-estimate';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const year = Number.parseInt(params.year, 10);
	if (!Number.isFinite(year)) {
		return fail('Invalid year');
	}

	const employeeId = params.employeeId?.trim();
	if (!employeeId) {
		return fail('Invalid employee id');
	}

	const start = `${year}-01-01`;
	const end = `${year}-12-31`;

	const db = getDb(platform.env);
	const [employee] = await db
		.select({ id: schema.employees.id })
		.from(schema.employees)
		.where(and(eq(schema.employees.id, employeeId), isNull(schema.employees.deletedAt)))
		.limit(1);

	if (!employee) {
		return fail('Employee not found', 404);
	}

	const payoutFilter = and(
		eq(schema.projectEmployees.employeeId, employeeId),
		between(schema.payoutRecords.period, start, end),
		inArray(schema.payoutRecords.status, ['confirmed', 'paid'])
	);

	const [aggRows, byIncomeTypeRows] = await Promise.all([
		db
			.select({
				taxableTotal: sql<number>`coalesce(sum(${schema.payoutRecords.taxableAmount}), 0)`,
				computedTotal: sql<number>`coalesce(sum(${schema.payoutRecords.computedAmount}), 0)`,
				cpfEmployeeTotal: sql<number>`coalesce(sum(${schema.payoutRecords.cpfEmployee}), 0)`,
				payoutCount: sql<number>`count(*)`
			})
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.innerJoin(
				schema.projectEmployees,
				eq(schema.compensationComponents.projectEmployeeId, schema.projectEmployees.id)
			)
			.where(payoutFilter),
		db
			.select({
				incomeType: schema.compensationComponents.incomeType,
				computedSum: sql<number>`coalesce(sum(${schema.payoutRecords.computedAmount}), 0)`,
				taxableSum: sql<number>`coalesce(sum(${schema.payoutRecords.taxableAmount}), 0)`,
				cpfEmployeeSum: sql<number>`coalesce(sum(${schema.payoutRecords.cpfEmployee}), 0)`,
				lineCount: sql<number>`count(*)`
			})
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.innerJoin(
				schema.projectEmployees,
				eq(schema.compensationComponents.projectEmployeeId, schema.projectEmployees.id)
			)
			.where(payoutFilter)
			.groupBy(schema.compensationComponents.incomeType)
	]);

	const [agg] = aggRows;
	const taxableTotal = agg?.taxableTotal ?? 0;
	const cpfEmployeeTotal = agg?.cpfEmployeeTotal ?? 0;
	const chargeableBeforeOtherReliefs = taxableTotal - cpfEmployeeTotal;
	const estimatedResidentTax = estimateSingaporeResidentTax(chargeableBeforeOtherReliefs);
	const byIncomeType = [...byIncomeTypeRows].sort((a, b) =>
		String(a.incomeType).localeCompare(String(b.incomeType))
	);

	return ok({
		year,
		range: { start, end },
		employeeId,
		payoutCount: agg?.payoutCount ?? 0,
		taxableTotal,
		computedTotal: agg?.computedTotal ?? 0,
		cpfEmployeeTotal,
		chargeableBeforeOtherReliefs,
		estimatedResidentTax,
		byIncomeType,
		note:
			'Summaries payout_records by project assignment. IRAS reliefs beyond employee CPF are not modeled; estimatedResidentTax is illustrative (resident progressive bands).'
	});
};

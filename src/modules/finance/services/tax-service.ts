import { and, between, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { ModuleContext } from '$platform/modules/types';
import {
	companySettings,
	compensationComponents,
	employees,
	expenses,
	invoicesIn,
	invoicesOut,
	payoutRecords,
	projectEmployees,
	revenue
} from '../../../infrastructure/db/schema';
import { estimateSingaporeResidentTax } from '../rules';
import {
	projectExpenseTotalSumExpr,
	projectRevenueTotalSumExpr,
	staffCostPeriodBetween,
	staffCostPayoutJoinConditions,
	staffCostSumExpr
} from '../repositories';

const MANUAL_GST_BOX_KEYS = [
	'gst_box9_manual',
	'gst_box10_manual',
	'gst_box11_manual',
	'gst_box12_manual'
] as const;

type ManualGstBoxKey = (typeof MANUAL_GST_BOX_KEYS)[number];

function getQuarterRange(year: string, quarter: string) {
	const y = Number.parseInt(year, 10);
	const q = Number.parseInt(quarter, 10);
	if (!Number.isFinite(y) || ![1, 2, 3, 4].includes(q)) {
		return null;
	}

	const startMonth = (q - 1) * 3 + 1;
	const start = new Date(Date.UTC(y, startMonth - 1, 1));
	const end = new Date(Date.UTC(y, startMonth + 2, 0));

	return {
		start: start.toISOString().slice(0, 10),
		end: end.toISOString().slice(0, 10)
	};
}

function calcCorporateTax(taxableIncome: number) {
	const firstBand = Math.min(taxableIncome, 10000) * 0.0425;
	const secondBand = Math.min(Math.max(taxableIncome - 10000, 0), 190000) * 0.085;
	const thirdBand = Math.max(taxableIncome - 200000, 0) * 0.17;
	return firstBand + secondBand + thirdBand;
}

export function createFinanceTaxApi(ctx: ModuleContext) {
	const getGstManualBoxValues = async () => {
		const rows = await ctx.db
			.select({ key: companySettings.key, value: companySettings.value })
			.from(companySettings)
			.where(and(inArray(companySettings.key, [...MANUAL_GST_BOX_KEYS]), isNull(companySettings.deletedAt)));

		const valueMap = new Map(rows.map((row) => [row.key, Number.parseFloat(row.value)]));
		return {
			gst_box9_manual: valueMap.get('gst_box9_manual') ?? 0,
			gst_box10_manual: valueMap.get('gst_box10_manual') ?? 0,
			gst_box11_manual: valueMap.get('gst_box11_manual') ?? 0,
			gst_box12_manual: valueMap.get('gst_box12_manual') ?? 0
		};
	};

	const saveGstManualBoxValues = async (values: Record<ManualGstBoxKey, number>) => {
		const now = new Date().toISOString();
		for (const key of MANUAL_GST_BOX_KEYS) {
			const normalized = Number.isFinite(values[key]) ? values[key] : 0;
			const [existing] = await ctx.db
				.select({ key: companySettings.key })
				.from(companySettings)
				.where(eq(companySettings.key, key))
				.limit(1);

			if (existing) {
				await ctx.db
					.update(companySettings)
					.set({
						value: `${normalized}`,
						deletedAt: null,
						updatedAt: now
					})
					.where(eq(companySettings.key, key));
			} else {
				await ctx.db.insert(companySettings).values({
					key,
					value: `${normalized}`,
					createdAt: now,
					updatedAt: now
				});
			}
		}
	};

	const getGstReturnEstimate = async (year: string, quarter: string) => {
		const range = getQuarterRange(year, quarter);
		if (!range) return null;

		const [box1] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${invoicesOut.subtotal}), 0)` })
			.from(invoicesOut)
			.where(
				and(
					eq(invoicesOut.gstType, 'standard'),
					between(invoicesOut.date, range.start, range.end),
					isNull(invoicesOut.deletedAt)
				)
			);
		const [box2] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${invoicesOut.subtotal}), 0)` })
			.from(invoicesOut)
			.where(
				and(
					eq(invoicesOut.gstType, 'zero'),
					between(invoicesOut.date, range.start, range.end),
					isNull(invoicesOut.deletedAt)
				)
			);
		const [box3] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${invoicesOut.subtotal}), 0)` })
			.from(invoicesOut)
			.where(
				and(
					eq(invoicesOut.gstType, 'exempt'),
					between(invoicesOut.date, range.start, range.end),
					isNull(invoicesOut.deletedAt)
				)
			);
		const [purchases] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${invoicesIn.amount}), 0)` })
			.from(invoicesIn)
			.where(and(between(invoicesIn.invoiceDate, range.start, range.end), isNull(invoicesIn.deletedAt)));
		const [expenseRows] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
			.from(expenses)
			.where(and(between(expenses.date, range.start, range.end), isNull(expenses.deletedAt)));
		const [box6] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${invoicesOut.gstAmount}), 0)` })
			.from(invoicesOut)
			.where(
				and(
					eq(invoicesOut.gstType, 'standard'),
					between(invoicesOut.date, range.start, range.end),
					isNull(invoicesOut.deletedAt)
				)
			);
		const [box7] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${invoicesIn.gstAmount}), 0)` })
			.from(invoicesIn)
			.where(and(between(invoicesIn.invoiceDate, range.start, range.end), isNull(invoicesIn.deletedAt)));
		const manual = await getGstManualBoxValues();

		const b1 = box1?.total ?? 0;
		const b2 = box2?.total ?? 0;
		const b3 = box3?.total ?? 0;
		const b4 = b1 + b2 + b3;
		const b5 = (purchases?.total ?? 0) + (expenseRows?.total ?? 0);
		const b6 = box6?.total ?? 0;
		const b7 = box7?.total ?? 0;
		const b9 = Number.isFinite(manual.gst_box9_manual) ? manual.gst_box9_manual : 0;
		const b10 = Number.isFinite(manual.gst_box10_manual) ? manual.gst_box10_manual : 0;
		const b11 = Number.isFinite(manual.gst_box11_manual) ? manual.gst_box11_manual : 0;
		const b12 = Number.isFinite(manual.gst_box12_manual) ? manual.gst_box12_manual : 0;
		const b13 = b4;

		return {
			year,
			quarter,
			range,
			boxes: {
				box1: b1,
				box2: b2,
				box3: b3,
				box4: b4,
				box5: b5,
				box6: b6,
				box7: b7,
				box8: b6 - b7,
				box9: b9,
				box10: b10,
				box11: b11,
				box12: b12,
				box13: b13
			},
			meta: {
				manualBoxes: ['box9', 'box10', 'box11', 'box12'],
				notes: [
					'Box 1-3: value of supplies (subtotal excl. GST) from customer invoices by gst_type.',
					'Box 4: sum of boxes 1-3 (Box 4 = Box 1 + Box 2 + Box 3).',
					'Box 5: supplier invoice amounts (invoices_in.amount) plus expenses (expenses.amount) (Box 5 = purchases + expenses). Expenses rows usually lack a split-out GST field - see Box 7 note.',
					'Box 6: output GST from standard-rated sales only (invoices_out.gst_amount where gst_type = standard).',
					'Box 7: input GST from supplier tax invoices only (invoices_in.gst_amount). Expense records do not currently store GST; their tax is not in Box 7 until modeled.',
					'Box 8 = Box 6 - Box 7 (simplified) (Box 8 = Box 6 - Box 7). IRAS net payable can also involve Boxes 9-12 - maintain manually where applicable.',
					'Box 9-12: company_settings keys gst_box9_manual - gst_box12_manual.',
					'Box 13: set equal to Box 4 for this page (Box 13 = Box 4).'
				]
			}
		};
	};

	const getGstBoxDetail = async (year: string, quarter: string, boxNo: number) => {
		const range = getQuarterRange(year, quarter);
		if (!range) return null;

		if ([1, 2, 3].includes(boxNo)) {
			const gstType = boxNo === 1 ? 'standard' : boxNo === 2 ? 'zero' : 'exempt';
			const invoices = await ctx.db
				.select({
					id: invoicesOut.id,
					invoiceNo: invoicesOut.invoiceNo,
					date: invoicesOut.date,
					amount: invoicesOut.subtotal,
					gstAmount: invoicesOut.gstAmount
				})
				.from(invoicesOut)
				.where(
					and(
						eq(invoicesOut.gstType, gstType as 'standard' | 'zero' | 'exempt'),
						between(invoicesOut.date, range.start, range.end),
						isNull(invoicesOut.deletedAt)
					)
				);
			return { box: boxNo, invoices };
		}

		if (boxNo === 6) {
			const invoices = await ctx.db
				.select({
					id: invoicesOut.id,
					invoiceNo: invoicesOut.invoiceNo,
					date: invoicesOut.date,
					amount: invoicesOut.subtotal,
					gstAmount: invoicesOut.gstAmount
				})
				.from(invoicesOut)
				.where(
					and(
						eq(invoicesOut.gstType, 'standard'),
						between(invoicesOut.date, range.start, range.end),
						isNull(invoicesOut.deletedAt)
					)
				);
			return { box: boxNo, invoices };
		}

		if (boxNo === 5) {
			const purchases = await ctx.db
				.select({
					id: invoicesIn.id,
					date: invoicesIn.invoiceDate,
					counterparty: invoicesIn.supplierName,
					amount: invoicesIn.amount,
					type: sql<string>`'supplier_invoice'`
				})
				.from(invoicesIn)
				.where(and(between(invoicesIn.invoiceDate, range.start, range.end), isNull(invoicesIn.deletedAt)));
			const expenseRecords = await ctx.db
				.select({
					id: expenses.id,
					date: expenses.date,
					counterparty: sql<string>`coalesce(${expenses.category}, ${expenses.staffName}, 'Expense')`,
					amount: expenses.amount,
					type: sql<string>`'expense'`
				})
				.from(expenses)
				.where(and(between(expenses.date, range.start, range.end), isNull(expenses.deletedAt)));

			return { box: boxNo, records: [...purchases, ...expenseRecords] };
		}

		if (boxNo === 7) {
			const invoices = await ctx.db
				.select({
					id: invoicesIn.id,
					invoiceDate: invoicesIn.invoiceDate,
					supplierName: invoicesIn.supplierName,
					gstAmount: invoicesIn.gstAmount
				})
				.from(invoicesIn)
				.where(and(between(invoicesIn.invoiceDate, range.start, range.end), isNull(invoicesIn.deletedAt)));
			return { box: boxNo, invoices };
		}

		if (boxNo === 8) {
			const [box6] = await ctx.db
				.select({ total: sql<number>`coalesce(sum(${invoicesOut.gstAmount}), 0)` })
				.from(invoicesOut)
				.where(
					and(
						eq(invoicesOut.gstType, 'standard'),
						between(invoicesOut.date, range.start, range.end),
						isNull(invoicesOut.deletedAt)
					)
				);
			const [box7] = await ctx.db
				.select({ total: sql<number>`coalesce(sum(${invoicesIn.gstAmount}), 0)` })
				.from(invoicesIn)
				.where(and(between(invoicesIn.invoiceDate, range.start, range.end), isNull(invoicesIn.deletedAt)));
			return {
				box: 8,
				breakdown: {
					box6: box6?.total ?? 0,
					box7: box7?.total ?? 0,
					net: (box6?.total ?? 0) - (box7?.total ?? 0)
				}
			};
		}

		if ([9, 10, 11, 12].includes(boxNo)) {
			const key = `gst_box${boxNo}_manual`;
			const [setting] = await ctx.db
				.select({ value: companySettings.value })
				.from(companySettings)
				.where(and(eq(companySettings.key, key), isNull(companySettings.deletedAt)))
				.limit(1);
			return {
				box: boxNo,
				manualValue: setting ? Number.parseFloat(setting.value) : 0,
				source: 'company_settings',
				key
			};
		}

		if (boxNo === 4) {
			const invoices = await ctx.db
				.select({
					id: invoicesOut.id,
					invoiceNo: invoicesOut.invoiceNo,
					date: invoicesOut.date,
					amount: invoicesOut.subtotal,
					gstType: invoicesOut.gstType,
					gstAmount: invoicesOut.gstAmount
				})
				.from(invoicesOut)
				.where(and(between(invoicesOut.date, range.start, range.end), isNull(invoicesOut.deletedAt)));
			return {
				box: boxNo,
				invoices,
				note: 'Box 4 equals Box 1 + 2 + 3 (supply values excl. GST). One row per invoice for reconciliation.'
			};
		}

		if (boxNo === 13) {
			const invoices = await ctx.db
				.select({
					id: invoicesOut.id,
					invoiceNo: invoicesOut.invoiceNo,
					date: invoicesOut.date,
					amount: invoicesOut.total,
					gstAmount: invoicesOut.gstAmount
				})
				.from(invoicesOut)
				.where(and(between(invoicesOut.date, range.start, range.end), isNull(invoicesOut.deletedAt)));
			return { box: boxNo, invoices };
		}

		return { box: boxNo, invoices: [] };
	};

	const getCorporateTaxEstimate = async (year: number) => {
		const start = `${year}-01-01`;
		const end = `${year}-12-31`;

		const [revenueRows] = await ctx.db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(revenue)
			.where(and(between(revenue.date, start, end), isNull(revenue.deletedAt)));
		const [purchaseRows] = await ctx.db
			.select({ total: sql<number>`coalesce(sum(${invoicesIn.amount}), 0)` })
			.from(invoicesIn)
			.where(and(between(invoicesIn.invoiceDate, start, end), isNull(invoicesIn.deletedAt)));
		const [staffRows] = await ctx.db
			.select({ total: staffCostSumExpr() })
			.from(payoutRecords)
			.innerJoin(compensationComponents, eq(payoutRecords.componentId, compensationComponents.id))
			.where(and(staffCostPeriodBetween(start, end), staffCostPayoutJoinConditions()));
		const [expenseRows] = await ctx.db
			.select({ total: projectExpenseTotalSumExpr() })
			.from(expenses)
			.where(and(between(expenses.date, start, end), isNull(expenses.deletedAt)));

		const taxableIncome =
			(revenueRows?.total ?? 0) -
			(purchaseRows?.total ?? 0) -
			(staffRows?.total ?? 0) -
			(expenseRows?.total ?? 0);
		const taxPayable = calcCorporateTax(Math.max(taxableIncome, 0));

		return {
			year,
			range: { start, end },
			revenue: revenueRows?.total ?? 0,
			costBreakdown: {
				purchase: purchaseRows?.total ?? 0,
				staff: staffRows?.total ?? 0,
				expense: expenseRows?.total ?? 0
			},
			taxableIncome,
			taxPayable,
			effectiveRate: taxableIncome > 0 ? taxPayable / taxableIncome : 0,
			bands: {
				first10k: 0.0425,
				next190k: 0.085,
				above200k: 0.17
			}
		};
	};

	const getEmployeeTaxSummary = async (employeeId: string, year: number) => {
		const start = `${year}-01-01`;
		const end = `${year}-12-31`;

		const [employee] = await ctx.db
			.select({ id: employees.id })
			.from(employees)
			.where(and(eq(employees.id, employeeId), isNull(employees.deletedAt)))
			.limit(1);

		if (!employee) return null;

		const payoutFilter = and(
			eq(projectEmployees.employeeId, employeeId),
			between(payoutRecords.period, start, end),
			inArray(payoutRecords.status, ['confirmed', 'paid'])
		);

		const [aggRows, byIncomeTypeRows] = await Promise.all([
			ctx.db
				.select({
					taxableTotal: sql<number>`coalesce(sum(${payoutRecords.taxableAmount}), 0)`,
					computedTotal: sql<number>`coalesce(sum(${payoutRecords.computedAmount}), 0)`,
					cpfEmployeeTotal: sql<number>`coalesce(sum(${payoutRecords.cpfEmployee}), 0)`,
					payoutCount: sql<number>`count(*)`
				})
				.from(payoutRecords)
				.innerJoin(compensationComponents, eq(payoutRecords.componentId, compensationComponents.id))
				.innerJoin(projectEmployees, eq(compensationComponents.projectEmployeeId, projectEmployees.id))
				.where(payoutFilter),
			ctx.db
				.select({
					incomeType: compensationComponents.incomeType,
					computedSum: sql<number>`coalesce(sum(${payoutRecords.computedAmount}), 0)`,
					taxableSum: sql<number>`coalesce(sum(${payoutRecords.taxableAmount}), 0)`,
					cpfEmployeeSum: sql<number>`coalesce(sum(${payoutRecords.cpfEmployee}), 0)`,
					lineCount: sql<number>`count(*)`
				})
				.from(payoutRecords)
				.innerJoin(compensationComponents, eq(payoutRecords.componentId, compensationComponents.id))
				.innerJoin(projectEmployees, eq(compensationComponents.projectEmployeeId, projectEmployees.id))
				.where(payoutFilter)
				.groupBy(compensationComponents.incomeType)
		]);

		const [agg] = aggRows;
		const taxableTotal = agg?.taxableTotal ?? 0;
		const cpfEmployeeTotal = agg?.cpfEmployeeTotal ?? 0;
		const chargeableBeforeOtherReliefs = taxableTotal - cpfEmployeeTotal;
		const estimatedResidentTax = estimateSingaporeResidentTax(chargeableBeforeOtherReliefs);
		const byIncomeType = [...byIncomeTypeRows].sort((a, b) =>
			String(a.incomeType).localeCompare(String(b.incomeType))
		);

		return {
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
		};
	};

	return {
		getGstManualBoxValues,
		saveGstManualBoxValues,
		getGstReturnEstimate,
		getGstBoxDetail,
		getCorporateTaxEstimate,
		getEmployeeTaxSummary
	};
}

export type FinanceTaxesApi = ReturnType<typeof createFinanceTaxApi>;

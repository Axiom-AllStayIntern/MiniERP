import { and, between, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { ModuleContext } from '$platform/modules/types';
import { schema } from '$infrastructure/db';
import { projectExpenseTotalSumExpr, projectRevenueTotalSumExpr } from '$modules/finance/repositories/legacy-expense-repository';
import {
	staffCostPayoutJoinConditions,
	staffCostPeriodBetween,
	staffCostSumExpr
} from '$modules/hr/repositories/employee-repository';
import {
	GstReturnRepository,
	PersonIncomeRepository,
	TimeLogRepository
} from '../repositories/legacy-tax-repository';

// ---------------------------------------------------------------------------
// Singapore resident progressive tax schedule
// (absorbed from singapore-resident-tax-estimate.ts)
// ---------------------------------------------------------------------------

export function estimateSingaporeResidentTax(chargeableIncome: number): number {
	if (!Number.isFinite(chargeableIncome) || chargeableIncome <= 0) return 0;
	let tax = 0;
	let left = chargeableIncome;
	const bands: { size: number; rate: number }[] = [
		{ size: 20000, rate: 0 },
		{ size: 10000, rate: 0.02 },
		{ size: 10000, rate: 0.035 },
		{ size: 40000, rate: 0.07 },
		{ size: 40000, rate: 0.115 },
		{ size: 40000, rate: 0.15 },
		{ size: 40000, rate: 0.18 },
		{ size: 40000, rate: 0.19 },
		{ size: 40000, rate: 0.195 },
		{ size: 40000, rate: 0.2 },
		{ size: 180000, rate: 0.22 }
	];
	for (const b of bands) {
		if (left <= 0) break;
		const slice = Math.min(b.size, left);
		tax += slice * b.rate;
		left -= slice;
	}
	if (left > 0) tax += left * 0.24;
	return Math.round(tax * 100) / 100;
}

function calcCorporateTax(taxableIncome: number) {
	const firstBand = Math.min(taxableIncome, 10000) * 0.0425;
	const secondBand = Math.min(Math.max(taxableIncome - 10000, 0), 190000) * 0.085;
	const thirdBand = Math.max(taxableIncome - 200000, 0) * 0.17;
	return firstBand + secondBand + thirdBand;
}

const MANUAL_GST_BOX_KEYS = ['gst_box9_manual', 'gst_box10_manual', 'gst_box11_manual', 'gst_box12_manual'] as const;

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

// ---------------------------------------------------------------------------
// GstService
// ---------------------------------------------------------------------------

export class GstService {
	private repo: GstReturnRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new GstReturnRepository(ctx.db);
	}

	async getReturn(year: string, quarter: string) {
		return this.repo.findByQuarter(year, quarter);
	}

	async getManualBoxValues() {
		const rows = await this.ctx.db
			.select({ key: schema.companySettings.key, value: schema.companySettings.value })
			.from(schema.companySettings)
			.where(
				and(
					inArray(schema.companySettings.key, [...MANUAL_GST_BOX_KEYS]),
					isNull(schema.companySettings.deletedAt)
				)
			);

		const valueMap = new Map(rows.map((row) => [row.key, Number.parseFloat(row.value)]));
		return {
			gst_box9_manual: valueMap.get('gst_box9_manual') ?? 0,
			gst_box10_manual: valueMap.get('gst_box10_manual') ?? 0,
			gst_box11_manual: valueMap.get('gst_box11_manual') ?? 0,
			gst_box12_manual: valueMap.get('gst_box12_manual') ?? 0
		};
	}

	async saveManualBoxValues(values: Record<ManualGstBoxKey, number>) {
		const now = new Date().toISOString();
		for (const key of MANUAL_GST_BOX_KEYS) {
			const normalized = Number.isFinite(values[key]) ? values[key] : 0;
			const [existing] = await this.ctx.db
				.select({ key: schema.companySettings.key })
				.from(schema.companySettings)
				.where(eq(schema.companySettings.key, key))
				.limit(1);

			if (existing) {
				await this.ctx.db
					.update(schema.companySettings)
					.set({
						value: `${normalized}`,
						deletedAt: null,
						updatedAt: now
					})
					.where(eq(schema.companySettings.key, key));
			} else {
				await this.ctx.db.insert(schema.companySettings).values({
					key,
					value: `${normalized}`,
					createdAt: now,
					updatedAt: now
				});
			}
		}
	}

	async getReturnEstimate(year: string, quarter: string) {
		const range = getQuarterRange(year, quarter);
		if (!range) return null;

		const db = this.ctx.db;
		const [box1] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
			.from(schema.invoicesOut)
			.where(
				and(
					eq(schema.invoicesOut.gstType, 'standard'),
					between(schema.invoicesOut.date, range.start, range.end),
					isNull(schema.invoicesOut.deletedAt)
				)
			);
		const [box2] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
			.from(schema.invoicesOut)
			.where(
				and(
					eq(schema.invoicesOut.gstType, 'zero'),
					between(schema.invoicesOut.date, range.start, range.end),
					isNull(schema.invoicesOut.deletedAt)
				)
			);
		const [box3] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.subtotal}), 0)` })
			.from(schema.invoicesOut)
			.where(
				and(
					eq(schema.invoicesOut.gstType, 'exempt'),
					between(schema.invoicesOut.date, range.start, range.end),
					isNull(schema.invoicesOut.deletedAt)
				)
			);
		const [purchases] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
			.from(schema.invoicesIn)
			.where(
				and(between(schema.invoicesIn.invoiceDate, range.start, range.end), isNull(schema.invoicesIn.deletedAt))
			);
		const [expenses] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)` })
			.from(schema.expenses)
			.where(and(between(schema.expenses.date, range.start, range.end), isNull(schema.expenses.deletedAt)));
		const [box6] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.gstAmount}), 0)` })
			.from(schema.invoicesOut)
			.where(
				and(
					eq(schema.invoicesOut.gstType, 'standard'),
					between(schema.invoicesOut.date, range.start, range.end),
					isNull(schema.invoicesOut.deletedAt)
				)
			);
		const [box7] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.gstAmount}), 0)` })
			.from(schema.invoicesIn)
			.where(
				and(between(schema.invoicesIn.invoiceDate, range.start, range.end), isNull(schema.invoicesIn.deletedAt))
			);
		const manual = await this.getManualBoxValues();

		const b1 = box1?.total ?? 0;
		const b2 = box2?.total ?? 0;
		const b3 = box3?.total ?? 0;
		const b4 = b1 + b2 + b3;
		const b5 = (purchases?.total ?? 0) + (expenses?.total ?? 0);
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
	}

	async getBoxDetail(year: string, quarter: string, boxNo: number) {
		const range = getQuarterRange(year, quarter);
		if (!range) return null;

		const db = this.ctx.db;
		if ([1, 2, 3].includes(boxNo)) {
			const gstType = boxNo === 1 ? 'standard' : boxNo === 2 ? 'zero' : 'exempt';
			const invoices = await db
				.select({
					id: schema.invoicesOut.id,
					invoiceNo: schema.invoicesOut.invoiceNo,
					date: schema.invoicesOut.date,
					amount: schema.invoicesOut.subtotal,
					gstAmount: schema.invoicesOut.gstAmount
				})
				.from(schema.invoicesOut)
				.where(
					and(
						eq(schema.invoicesOut.gstType, gstType as 'standard' | 'zero' | 'exempt'),
						between(schema.invoicesOut.date, range.start, range.end),
						isNull(schema.invoicesOut.deletedAt)
					)
				);
			return { box: boxNo, invoices };
		}

		if (boxNo === 6) {
			const invoices = await db
				.select({
					id: schema.invoicesOut.id,
					invoiceNo: schema.invoicesOut.invoiceNo,
					date: schema.invoicesOut.date,
					amount: schema.invoicesOut.subtotal,
					gstAmount: schema.invoicesOut.gstAmount
				})
				.from(schema.invoicesOut)
				.where(
					and(
						eq(schema.invoicesOut.gstType, 'standard'),
						between(schema.invoicesOut.date, range.start, range.end),
						isNull(schema.invoicesOut.deletedAt)
					)
				);
			return { box: boxNo, invoices };
		}

		if (boxNo === 5) {
			const purchases = await db
				.select({
					id: schema.invoicesIn.id,
					date: schema.invoicesIn.invoiceDate,
					counterparty: schema.invoicesIn.supplierName,
					amount: schema.invoicesIn.amount,
					type: sql<string>`'supplier_invoice'`
				})
				.from(schema.invoicesIn)
				.where(
					and(
						between(schema.invoicesIn.invoiceDate, range.start, range.end),
						isNull(schema.invoicesIn.deletedAt)
					)
				);
			const expenses = await db
				.select({
					id: schema.expenses.id,
					date: schema.expenses.date,
					counterparty: sql<string>`coalesce(${schema.expenses.category}, ${schema.expenses.staffName}, 'Expense')`,
					amount: schema.expenses.amount,
					type: sql<string>`'expense'`
				})
				.from(schema.expenses)
				.where(and(between(schema.expenses.date, range.start, range.end), isNull(schema.expenses.deletedAt)));

			return { box: boxNo, records: [...purchases, ...expenses] };
		}

		if (boxNo === 7) {
			const invoices = await db
				.select({
					id: schema.invoicesIn.id,
					invoiceDate: schema.invoicesIn.invoiceDate,
					supplierName: schema.invoicesIn.supplierName,
					gstAmount: schema.invoicesIn.gstAmount
				})
				.from(schema.invoicesIn)
				.where(
					and(
						between(schema.invoicesIn.invoiceDate, range.start, range.end),
						isNull(schema.invoicesIn.deletedAt)
					)
				);
			return { box: boxNo, invoices };
		}

		if (boxNo === 8) {
			const [box6] = await db
				.select({ total: sql<number>`coalesce(sum(${schema.invoicesOut.gstAmount}), 0)` })
				.from(schema.invoicesOut)
				.where(
					and(
						eq(schema.invoicesOut.gstType, 'standard'),
						between(schema.invoicesOut.date, range.start, range.end),
						isNull(schema.invoicesOut.deletedAt)
					)
				);
			const [box7] = await db
				.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.gstAmount}), 0)` })
				.from(schema.invoicesIn)
				.where(
					and(
						between(schema.invoicesIn.invoiceDate, range.start, range.end),
						isNull(schema.invoicesIn.deletedAt)
					)
				);
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
			const [setting] = await db
				.select({ value: schema.companySettings.value })
				.from(schema.companySettings)
				.where(and(eq(schema.companySettings.key, key), isNull(schema.companySettings.deletedAt)))
				.limit(1);
			return {
				box: boxNo,
				manualValue: setting ? Number.parseFloat(setting.value) : 0,
				source: 'company_settings',
				key
			};
		}

		if (boxNo === 4) {
			const invoices = await db
				.select({
					id: schema.invoicesOut.id,
					invoiceNo: schema.invoicesOut.invoiceNo,
					date: schema.invoicesOut.date,
					amount: schema.invoicesOut.subtotal,
					gstType: schema.invoicesOut.gstType,
					gstAmount: schema.invoicesOut.gstAmount
				})
				.from(schema.invoicesOut)
				.where(
					and(between(schema.invoicesOut.date, range.start, range.end), isNull(schema.invoicesOut.deletedAt))
				);
			return {
				box: boxNo,
				invoices,
				note: 'Box 4 equals Box 1 + 2 + 3 (supply values excl. GST). One row per invoice for reconciliation.'
			};
		}

		if (boxNo === 13) {
			const invoices = await db
				.select({
					id: schema.invoicesOut.id,
					invoiceNo: schema.invoicesOut.invoiceNo,
					date: schema.invoicesOut.date,
					amount: schema.invoicesOut.total,
					gstAmount: schema.invoicesOut.gstAmount
				})
				.from(schema.invoicesOut)
				.where(
					and(between(schema.invoicesOut.date, range.start, range.end), isNull(schema.invoicesOut.deletedAt))
				);
			return { box: boxNo, invoices };
		}

		return { box: boxNo, invoices: [] };
	}
}

// ---------------------------------------------------------------------------
// CorporateTaxService
// ---------------------------------------------------------------------------

export class CorporateTaxService {
	constructor(private ctx: ModuleContext) {}

	async getEstimate(year: number) {
		const start = `${year}-01-01`;
		const end = `${year}-12-31`;
		const db = this.ctx.db;

		const [revenue] = await db
			.select({ total: projectRevenueTotalSumExpr() })
			.from(schema.revenue)
			.where(and(between(schema.revenue.date, start, end), isNull(schema.revenue.deletedAt)));
		const [purchase] = await db
			.select({ total: sql<number>`coalesce(sum(${schema.invoicesIn.amount}), 0)` })
			.from(schema.invoicesIn)
			.where(and(between(schema.invoicesIn.invoiceDate, start, end), isNull(schema.invoicesIn.deletedAt)));
		const [staff] = await db
			.select({ total: staffCostSumExpr() })
			.from(schema.payoutRecords)
			.innerJoin(
				schema.compensationComponents,
				eq(schema.payoutRecords.componentId, schema.compensationComponents.id)
			)
			.where(and(staffCostPeriodBetween(start, end), staffCostPayoutJoinConditions()));
		const [expense] = await db
			.select({ total: projectExpenseTotalSumExpr() })
			.from(schema.expenses)
			.where(and(between(schema.expenses.date, start, end), isNull(schema.expenses.deletedAt)));

		const taxableIncome =
			(revenue?.total ?? 0) - (purchase?.total ?? 0) - (staff?.total ?? 0) - (expense?.total ?? 0);
		const taxPayable = calcCorporateTax(Math.max(taxableIncome, 0));

		return {
			year,
			range: { start, end },
			revenue: revenue?.total ?? 0,
			costBreakdown: {
				purchase: purchase?.total ?? 0,
				staff: staff?.total ?? 0,
				expense: expense?.total ?? 0
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
	}
}

// ---------------------------------------------------------------------------
// IncomeTaxService
// ---------------------------------------------------------------------------

export class IncomeTaxService {
	private incomeRepo: PersonIncomeRepository;

	constructor(private ctx: ModuleContext) {
		this.incomeRepo = new PersonIncomeRepository(ctx.db);
	}

	async getPersonIncome(personId: string, yearOfAssessment?: string) {
		return this.incomeRepo.findByPerson(personId, yearOfAssessment);
	}

	estimateResidentTax(chargeableIncome: number) {
		return estimateSingaporeResidentTax(chargeableIncome);
	}

	async getEmployeeTaxSummary(employeeId: string, year: number) {
		const start = `${year}-01-01`;
		const end = `${year}-12-31`;
		const db = this.ctx.db;

		const [employee] = await db
			.select({ id: schema.employees.id })
			.from(schema.employees)
			.where(and(eq(schema.employees.id, employeeId), isNull(schema.employees.deletedAt)))
			.limit(1);

		if (!employee) return null;

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
	}
}

// ---------------------------------------------------------------------------
// TimeLogService
// ---------------------------------------------------------------------------

export class TimeLogService {
	private repo: TimeLogRepository;

	constructor(ctx: ModuleContext) {
		this.repo = new TimeLogRepository(ctx.db);
	}

	async getByPersonAndProject(personId: string, projectId: string) {
		return this.repo.findByPersonAndProject(personId, projectId);
	}

	async create(data: {
		personId: string;
		projectId?: string;
		date: string;
		hours: number;
		description?: string;
		billable?: boolean;
	}) {
		return this.repo.create({
			...data,
			billable: data.billable ?? true
		});
	}
}

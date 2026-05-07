import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { ModuleContext } from '$platform/modules/types';
import {
	ExpenseRepository,
	RevenueRepository,
	ExpenseCategoryRepository
} from '../repositories/legacy-expense-repository';
import { createEvent } from '$platform/modules';
import type { ExpenseType } from '$modules/finance/schemas/expense-upload';
import { resolveSgdEquivalentForWrite } from '$modules/finance/services/fx/resolve-sgd-equivalent';
import { buildDocumentMetadata, parseDocumentMetadata } from '$modules/finance/schemas/document-metadata';
import { resolveExpenseFilePreview } from '$modules/finance/services/expense-file-preview';
import { schema } from '$infrastructure/db';

const DOCUMENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// ExpenseService
// ---------------------------------------------------------------------------

export class ExpenseService {
	private repo: ExpenseRepository;
	private revenueRepo: RevenueRepository;
	private categoryRepo: ExpenseCategoryRepository;

	constructor(private ctx: ModuleContext) {
		this.repo = new ExpenseRepository(ctx.db);
		this.revenueRepo = new RevenueRepository(ctx.db);
		this.categoryRepo = new ExpenseCategoryRepository(ctx.db);
	}

	async getByProject(projectId: string) {
		return this.repo.findByProject(projectId);
	}

	async getProjectExpenseSums(projectId: string) {
		return this.repo.getProjectExpenseSums(projectId);
	}

	async getProjectExpenseDetail(projectId: string, expenseId: string) {
		const [expense] = await this.ctx.db
			.select()
			.from(schema.expenses)
			.where(
				and(
					eq(schema.expenses.id, expenseId),
					eq(schema.expenses.projectId, projectId),
					isNull(schema.expenses.deletedAt)
				)
			)
			.limit(1);

		if (!expense) return null;

		const docMeta = parseDocumentMetadata(expense.metadata);
		const { fileViewUrl, fileDownloadUrl, previewDisplay } = await resolveExpenseFilePreview(
			this.ctx.db,
			expense.documentRef,
			docMeta
		);

		return { expense, docMeta, fileViewUrl, fileDownloadUrl, previewDisplay };
	}

	async getProjectExpensePage(projectId: string, projectName: string) {
		const db = this.ctx.db;
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
			let statusLabel = '-';
			if (meta.parseStatus === 'reviewed') statusLabel = 'Reviewed';
			else if (meta.parseStatus === 'parsed') statusLabel = 'Parsed';
			else if (meta.parseStatus === 'not_parsed') statusLabel = 'Pending review';
			else if (storageKey || (exp.documentRef && !exp.documentRef.startsWith('manual://')))
				statusLabel = 'Document';
			else statusLabel = 'Manual';

			return {
				...exp,
				projectName,
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
				id: schema.persons.id,
				name: schema.persons.name
			})
			.from(schema.persons)
			.where(isNull(schema.persons.deletedAt))
			.orderBy(schema.persons.name);

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

		return { expenses, employees, totals, businessTrips };
	}

	async getExpenseListPage() {
		const db = this.ctx.db;
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

		const employees = await this.getEmployeeDirectory();
		const totals = expenses.reduce(
			(acc, expense) => {
				const amount = expense.sgdEquivalent ?? expense.amount ?? 0;
				acc.total += amount;
				if (expense.expenseType === 'sales_cost') {
					acc.salesCost += amount;
				} else {
					acc.opex += amount;
				}
				return acc;
			},
			{ total: 0, opex: 0, salesCost: 0 }
		);

		return { expenses, employees, totals };
	}

	async getReimbursementsPage() {
		const reimbursements = await this.ctx.db
			.select({
				id: schema.expenses.id,
				expenseType: schema.expenses.expenseType,
				category: schema.expenses.category,
				amount: schema.expenses.amount,
				sgdEquivalent: schema.expenses.sgdEquivalent,
				currency: schema.expenses.currency,
				date: schema.expenses.date,
				vendorOrSupplier: schema.expenses.vendorOrSupplier,
				staffName: schema.expenses.staffName,
				destination: schema.expenses.destination,
				notes: schema.expenses.notes,
				projectId: schema.expenses.projectId,
				createdAt: schema.expenses.createdAt
			})
			.from(schema.expenses)
			.where(and(eq(schema.expenses.reimbursement, true), isNull(schema.expenses.deletedAt)))
			.orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt));

		const total = reimbursements.reduce((sum, reimbursement) => {
			return sum + (reimbursement.sgdEquivalent || reimbursement.amount || 0);
		}, 0);

		return { reimbursements, total };
	}

	async getExpenseUploadPage(projectIdParam: string) {
		let preselectedProject: {
			id: string;
			name: string;
			customerName: string | null;
			status: string;
			startDate: string | null;
			endDate: string | null;
		} | null = null;

		if (projectIdParam) {
			const [row] = await this.ctx.db
				.select({
					id: schema.projects.id,
					name: schema.projects.name,
					status: schema.projects.status,
					startDate: schema.projects.startDate,
					endDate: schema.projects.endDate,
					businessPartnerId: schema.projects.businessPartnerId
				})
				.from(schema.projects)
				.where(and(eq(schema.projects.id, projectIdParam), isNull(schema.projects.deletedAt)))
				.limit(1);

			if (row) {
				const [customer] = row.businessPartnerId
					? await this.ctx.db
							.select({ name: schema.businessPartners.name })
							.from(schema.businessPartners)
							.where(eq(schema.businessPartners.id, row.businessPartnerId))
							.limit(1)
					: [];
				preselectedProject = {
					id: row.id,
					name: row.name,
					customerName: customer?.name ?? null,
					status: row.status,
					startDate: row.startDate,
					endDate: row.endDate
				};
			}
		}

		const employees = await this.getEmployeeDirectory();
		return { employees, preselectedProject };
	}

	async createStandaloneExpense(data: {
		expenseType: ExpenseType;
		category: string;
		amount: number;
		currency: string;
		date: string;
		vendorOrSupplier?: string | null;
		staffName?: string | null;
		reimbursement?: boolean;
		businessTrip?: boolean;
		destination?: string | null;
		notes?: string | null;
	}) {
		const currency = data.currency.trim().toUpperCase();
		const sgdEquivalent = await resolveSgdEquivalentForWrite({
			amount: data.amount,
			currency,
			dateYmd: data.date
		});
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		await this.ctx.db.insert(schema.expenses).values({
			id,
			projectId: null,
			expenseType: data.expenseType,
			category: data.category,
			date: data.date,
			amount: data.amount,
			currency,
			sgdEquivalent,
			gstAmount: 0,
			vendorOrSupplier: data.vendorOrSupplier ?? null,
			staffName: data.staffName ?? null,
			reimbursement: data.reimbursement ?? false,
			businessTrip: data.businessTrip ?? false,
			destination: data.destination ?? null,
			notes: data.notes ?? null,
			createdAt: now,
			updatedAt: now
		});

		return { id };
	}

	async getStandaloneExpenseDetail(expenseId: string) {
		const [expense] = await this.ctx.db
			.select()
			.from(schema.expenses)
			.where(and(eq(schema.expenses.id, expenseId), isNull(schema.expenses.deletedAt)))
			.limit(1);

		if (!expense) return null;

		const docMeta = parseDocumentMetadata(expense.metadata);
		const { fileViewUrl, fileDownloadUrl, previewDisplay } = await resolveExpenseFilePreview(
			this.ctx.db,
			expense.documentRef,
			docMeta
		);

		return { expense, docMeta, fileViewUrl, fileDownloadUrl, previewDisplay };
	}

	async updateStandaloneExpense(
		expenseId: string,
		data: {
			category: string;
			expenseType: string;
			amount: number;
			currency: string;
			date: string;
			staffName?: string | null;
			vendorOrSupplier?: string | null;
			notes?: string | null;
		}
	) {
		const [current] = await this.ctx.db
			.select({ metadata: schema.expenses.metadata, projectId: schema.expenses.projectId })
			.from(schema.expenses)
			.where(and(eq(schema.expenses.id, expenseId), isNull(schema.expenses.deletedAt)))
			.limit(1);

		if (!current) return { ok: false as const, status: 'not_found' as const, message: 'Expense not found.' };
		if (current.projectId) {
			return {
				ok: false as const,
				status: 'linked_project' as const,
				message: 'This expense is linked to a project; open it from the project.'
			};
		}

		const metadata = buildDocumentMetadata({
			raw: current.metadata ?? null,
			notes: data.notes || undefined
		});
		const amount = Number.isFinite(data.amount) ? data.amount : 0;
		const currency = data.currency.trim().toUpperCase();
		const sgdEquivalent = await resolveSgdEquivalentForWrite({
			amount,
			currency,
			dateYmd: data.date
		});

		await this.ctx.db
			.update(schema.expenses)
			.set({
				expenseType: data.expenseType as 'opex' | 'sales_cost',
				category: data.category,
				amount,
				currency,
				sgdEquivalent,
				date: data.date,
				staffName: data.staffName || null,
				vendorOrSupplier: data.vendorOrSupplier || null,
				metadata,
				notes: data.notes || null,
				updatedAt: new Date().toISOString()
			})
			.where(and(eq(schema.expenses.id, expenseId), isNull(schema.expenses.deletedAt)));

		return { ok: true as const };
	}

	async softDeleteStandaloneExpense(expenseId: string) {
		const [row] = await this.ctx.db
			.select({ projectId: schema.expenses.projectId })
			.from(schema.expenses)
			.where(and(eq(schema.expenses.id, expenseId), isNull(schema.expenses.deletedAt)))
			.limit(1);

		if (!row) return { ok: false as const, status: 'not_found' as const, message: 'Expense not found.' };
		if (row.projectId) {
			return {
				ok: false as const,
				status: 'linked_project' as const,
				message: 'This expense is linked to a project; delete it from the project.'
			};
		}

		const now = new Date().toISOString();
		await this.ctx.db
			.update(schema.expenses)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(schema.expenses.id, expenseId), isNull(schema.expenses.deletedAt)));

		return { ok: true as const };
	}

	private async getEmployeeDirectory() {
		return this.ctx.db
			.select({
				id: schema.persons.id,
				name: schema.persons.name
			})
			.from(schema.persons)
			.where(isNull(schema.persons.deletedAt))
			.orderBy(asc(schema.persons.name));
	}

	async create(data: {
		projectId?: string | null;
		expenseType: ExpenseType;
		category: string;
		amount: number;
		currency?: string;
		date: string;
		vendorOrSupplier?: string | null;
		staffName?: string | null;
		reimbursement?: boolean;
		businessTrip?: boolean;
		destination?: string | null;
		notes?: string | null;
		metadata?: string | null;
		documentRef?: string | null;
	}) {
		const currency = (data.currency ?? 'SGD').trim().toUpperCase();
		const sgdEquivalent = await resolveSgdEquivalentForWrite({
			amount: data.amount,
			currency,
			dateYmd: data.date
		});
		const result = await this.repo.create({
			...data,
			currency,
			sgdEquivalent,
			reimbursement: data.reimbursement ?? false,
			businessTrip: data.businessTrip ?? false
		});

		await this.ctx.eventBus.emit(
			createEvent('expense.created', 'expense', {
				expenseId: result.id,
				projectId: data.projectId,
				amount: data.amount,
				expenseType: data.expenseType
			})
		);

		return result;
	}

	async createBusinessTripWithAllowance(data: {
		projectId?: string | null;
		employeeId: string;
		destination: string;
		startDate: string;
		endDate: string;
		dailyAllowanceRate: number;
		notes?: string | null;
		requireEmployee?: boolean;
	}) {
		const { projectId, employeeId, destination, startDate, endDate, dailyAllowanceRate } = data;
		const start = new Date(startDate);
		const end = new Date(endDate);
		const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		if (days < 1) {
			return { ok: false as const, error: 'End date must be after start date' };
		}

		const [employee] = await this.ctx.db
			.select({ name: schema.persons.name })
			.from(schema.persons)
			.where(eq(schema.persons.id, employeeId))
			.limit(1);
		if (!employee && data.requireEmployee) {
			return { ok: false as const, error: 'Employee not found', status: 404 };
		}

		const now = new Date().toISOString();
		const tripId = crypto.randomUUID();
		await this.ctx.db.insert(schema.businessTrips).values({
			id: tripId,
			employeeId,
			projectId: projectId || null,
			destination,
			startDate,
			endDate,
			days,
			dailyAllowanceRate,
			status: 'active',
			notes: data.notes || null,
			createdAt: now,
			updatedAt: now
		});

		const allowanceAmount = days * dailyAllowanceRate;
		const expense = await this.create({
			projectId: projectId || null,
			expenseType: 'opex',
			category: 'allowance',
			date: startDate,
			amount: allowanceAmount,
			currency: 'SGD',
			vendorOrSupplier: null,
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
			})
		});

		return { ok: true as const, tripId, expenseId: expense.id, days, allowanceAmount };
	}

	async listBusinessTrips(filters: { projectId?: string | null; employeeId?: string | null } = {}) {
		return this.ctx.db
			.select()
			.from(schema.businessTrips)
			.where(
				and(
					isNull(schema.businessTrips.deletedAt),
					filters.projectId ? eq(schema.businessTrips.projectId, filters.projectId) : undefined,
					filters.employeeId ? eq(schema.businessTrips.employeeId, filters.employeeId) : undefined
				)
			)
			.orderBy(desc(schema.businessTrips.startDate));
	}

	async update(id: string, data: Record<string, unknown>) {
		return this.repo.update(id, data);
	}

	async updateProjectExpense(
		projectId: string,
		expenseId: string,
		data: {
			category: string;
			expenseType: string;
			amount: number;
			currency: string;
			date: string;
			staffName?: string | null;
			vendorOrSupplier?: string | null;
			notes?: string | null;
		}
	) {
		const [current] = await this.ctx.db
			.select({ metadata: schema.expenses.metadata })
			.from(schema.expenses)
			.where(
				and(
					eq(schema.expenses.id, expenseId),
					eq(schema.expenses.projectId, projectId),
					isNull(schema.expenses.deletedAt)
				)
			)
			.limit(1);

		const metadata = buildDocumentMetadata({
			raw: current?.metadata ?? null,
			notes: data.notes || undefined
		});

		const amt = Number.isFinite(data.amount) ? data.amount : 0;
		const currency = data.currency.trim().toUpperCase();
		const sgdEq = await resolveSgdEquivalentForWrite({ amount: amt, currency, dateYmd: data.date });

		await this.ctx.db
			.update(schema.expenses)
			.set({
				expenseType: data.expenseType as 'opex' | 'sales_cost',
				category: data.category,
				amount: amt,
				currency,
				sgdEquivalent: sgdEq,
				date: data.date,
				staffName: data.staffName || null,
				vendorOrSupplier: data.vendorOrSupplier || null,
				metadata,
				notes: data.notes || null,
				updatedAt: new Date().toISOString()
			})
			.where(
				and(
					eq(schema.expenses.id, expenseId),
					eq(schema.expenses.projectId, projectId),
					isNull(schema.expenses.deletedAt)
				)
			);
	}

	async softDelete(id: string) {
		const expense = await this.repo.findById(id);
		if (!expense) return;

		await this.repo.softDelete(id);

		await this.ctx.eventBus.emit(
			createEvent('expense.deleted', 'expense', {
				expenseId: id,
				projectId: expense.projectId
			})
		);
	}

	async softDeleteProjectExpense(projectId: string, expenseId: string) {
		const now = new Date().toISOString();
		await this.ctx.db
			.update(schema.expenses)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(schema.expenses.id, expenseId),
					eq(schema.expenses.projectId, projectId),
					isNull(schema.expenses.deletedAt)
				)
			);
	}

	// Revenue methods
	async getRevenueByProject(projectId: string) {
		return this.revenueRepo.findByProject(projectId);
	}

	async getProjectRevenueTotal(projectId: string) {
		return this.revenueRepo.getProjectRevenueTotal(projectId);
	}

	async getProjectRevenuePage(projectId: string) {
		const db = this.ctx.db;
		const revenueRecords = await db
			.select({
				id: schema.revenue.id,
				invoiceType: schema.revenue.invoiceType,
				invoiceNumber: schema.revenue.invoiceNumber,
				clientName: schema.revenue.clientName,
				date: schema.revenue.date,
				amount: schema.revenue.amount,
				currency: schema.revenue.currency,
				sgdEquivalent: schema.revenue.sgdEquivalent,
				gstAmount: schema.revenue.gstAmount,
				notes: schema.revenue.notes,
				createdAt: schema.revenue.createdAt
			})
			.from(schema.revenue)
			.where(and(eq(schema.revenue.projectId, projectId), isNull(schema.revenue.deletedAt)))
			.orderBy(desc(schema.revenue.date), desc(schema.revenue.createdAt));

		// Wave 2.1d: invoicesOut table dropped. revenue is the canonical fact table;
		// callers should treat the legacy `invoices` field as empty for compat.
		const invoices: Array<{
			id: string;
			invoiceNo: string;
			date: string | null;
			dueDate: string | null;
			currency: string;
			subtotal: number | null;
			gstType: string | null;
			gstAmount: number | null;
			total: number | null;
			status: string | null;
		}> = [];

		const revenueTotal = await this.getProjectRevenueTotal(projectId);
		return {
			revenueRecords,
			invoices,
			totals: {
				total: revenueTotal,
				revenue: revenueTotal,
				invoiced: revenueTotal
			}
		};
	}

	async getProjectRevenueDocumentDetail(projectId: string, revenueId: string) {
		const [revenue] = await this.ctx.db
			.select()
			.from(schema.revenue)
			.where(
				and(
					eq(schema.revenue.id, revenueId),
					eq(schema.revenue.projectId, projectId),
					isNull(schema.revenue.deletedAt)
				)
			)
			.limit(1);

		if (!revenue) return null;

		const docMeta = parseDocumentMetadata(null);
		const { fileViewUrl, fileDownloadUrl, previewDisplay } = await resolveExpenseFilePreview(
			this.ctx.db,
			revenue.documentRef,
			docMeta
		);

		return { revenue, docMeta, fileViewUrl, fileDownloadUrl, previewDisplay };
	}

	async createRevenue(data: {
		projectId?: string | null;
		invoiceType: 'standard' | 'zero_rate' | 'tax_invoice';
		invoiceNumber?: string | null;
		clientName?: string | null;
		date: string;
		amount: number;
		currency?: string;
		gstAmount?: number;
		notes?: string | null;
	}) {
		const currency = (data.currency ?? 'SGD').trim().toUpperCase();
		const sgdEquivalent = await resolveSgdEquivalentForWrite({
			amount: data.amount,
			currency,
			dateYmd: data.date
		});
		return this.revenueRepo.create({
			...data,
			currency,
			sgdEquivalent,
			gstAmount: data.gstAmount ?? 0
		});
	}

	async getCategories() {
		return this.categoryRepo.findAll();
	}
}

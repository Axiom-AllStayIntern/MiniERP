import type { ModuleContext } from '$platform/modules/types';
import { NotFoundError } from '$platform/modules/errors';
import { and, desc, eq, gte, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import {
	auditLogs,
	businessPartners,
	contracts,
	expenses,
	projects,
	purchaseOrders,
	quotations,
	revenue
} from '../../../infrastructure/db/schema';
import {
	activityVariantForAction,
	parseAuditMetadata,
	summarizeAuditForProject
} from '$modules/project/services/audit-display';
import { createProjectLegacySource } from '../adapters/legacy';
import type { ProjectSource } from '../contracts/source';
import { ProjectRepository } from '../repositories';
import { createProjectPublicApi } from './project-service';

const PROJECT_LIST_PAGE_SIZE = 10;

function fileLabelFromUrl(fileUrl: string | null, fallbackDate: string | null): string {
	if (!fileUrl || fileUrl.startsWith('manual://')) {
		return fallbackDate ? `Record - ${fallbackDate}` : 'Manual entry';
	}
	const tail = fileUrl.split('/').pop() ?? fileUrl;
	try {
		return decodeURIComponent(tail) || 'Document';
	} catch {
		return tail;
	}
}

export function createProjectApi(ctx: ModuleContext) {
	const legacySource = createProjectLegacySource(ctx);
	const projectRepository = new ProjectRepository(ctx.db);

	const getById: ProjectSource['getById'] = async (projectId) => {
		const project = await projectRepository.findById(projectId);
		if (!project) throw new NotFoundError('Project', projectId);
		return project;
	};

	const getWithCustomer: ProjectSource['getWithCustomer'] = async (projectId) => {
		const project = await projectRepository.findWithCustomer(projectId);
		if (!project) throw new NotFoundError('Project', projectId);
		return project;
	};

	const list: ProjectSource['list'] = async (opts) => projectRepository.list(opts);

	const getListCounts: ProjectSource['getListCounts'] = async () => projectRepository.getListCounts();

	const getMembers: ProjectSource['getMembers'] = async (projectId) =>
		projectRepository.getMembers(projectId);

	const getProjectFinancials: ProjectSource['getProjectFinancials'] = async (
		projectId,
		deps
	) => {
		const [revenue, purchaseCost, staffCost, expenseSums] = await Promise.all([
			deps.getRevenue(),
			deps.getPurchaseCost(),
			deps.getStaffCost(),
			deps.getExpenseSums()
		]);

		const expenseCogs = expenseSums.cogs;
		const expenseOpex = expenseSums.opex;
		const grossProfit = revenue - purchaseCost - staffCost - expenseCogs;
		const netProfit = grossProfit - expenseOpex;
		const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

		return {
			revenue,
			purchaseCost,
			staffCost,
			expenseCogs,
			expenseOpex,
			grossProfit,
			netProfit,
			margin: Math.round(margin * 100) / 100
		};
	};

	const getProjectListPage: ProjectSource['getProjectListPage'] = async (input) => {
		const q = input.q?.trim() ?? '';
		const status = input.status?.trim() ?? '';
		const startedAfter = input.startedAfter?.trim() ?? '';
		const pageRaw = input.page ?? 1;
		const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

		const projectConditions: SQL[] = [isNull(projects.deletedAt)];
		if (q) {
			projectConditions.push(
				or(like(projects.name, `%${q}%`), like(projects.id, `%${q}%`), like(sql`coalesce(${businessPartners.name}, '')`, `%${q}%`))!
			);
		}
		if (status) projectConditions.push(eq(projects.status, status));
		if (startedAfter) projectConditions.push(gte(projects.startDate, startedAfter));

		const [[allProjectsCountRow], [activeProjectsCountRow], projectCountRows] = await Promise.all([
			ctx.db.select({ n: sql<number>`count(*)` }).from(projects).where(isNull(projects.deletedAt)),
			ctx.db
				.select({ n: sql<number>`count(*)` })
				.from(projects)
				.where(and(isNull(projects.deletedAt), eq(projects.status, 'active'))),
			ctx.db
				.select({ total: sql<number>`count(*)` })
				.from(projects)
				.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
				.where(and(...projectConditions))
		]);

		const total = Number(projectCountRows[0]?.total ?? 0);
		const totalPages = Math.max(1, Math.ceil(total / PROJECT_LIST_PAGE_SIZE));
		const safePage = Math.min(page, totalPages);
		const safeOffset = (safePage - 1) * PROJECT_LIST_PAGE_SIZE;

		const projectRows = await ctx.db
			.select({
				id: projects.id,
				name: projects.name,
				customerId: projects.businessPartnerId,
				status: projects.status,
				startDate: projects.startDate,
				endDate: projects.endDate,
				updatedAt: projects.updatedAt,
				customerName: businessPartners.name
			})
			.from(projects)
			.leftJoin(businessPartners, eq(projects.businessPartnerId, businessPartners.id))
			.where(and(...projectConditions))
			.orderBy(desc(projects.updatedAt))
			.limit(PROJECT_LIST_PAGE_SIZE)
			.offset(safeOffset);

		// Wave 2.1d: invoice counts now come from revenue (canonical fact table).
		const invoiceCountRows = await ctx.db
			.select({ projectId: revenue.projectId, total: sql<number>`count(*)` })
			.from(revenue)
			.where(isNull(revenue.deletedAt))
			.groupBy(revenue.projectId);
		const invoiceCountMap = new Map(
			invoiceCountRows.map((row) => [row.projectId, Number(row.total ?? 0)])
		);

		const pageProjects = projectRows.map((row) => ({
			...row,
			customerName: row.customerName ?? row.customerId,
			invoiceCount: invoiceCountMap.get(row.id) ?? 0
		}));

		return {
			projects: pageProjects,
			projectListCounts: {
				all: Number(allProjectsCountRow?.n ?? 0),
				active: Number(activeProjectsCountRow?.n ?? 0)
			},
			filters: {
				q,
				status,
				startedAfter,
				page: safePage
			},
			pagination: {
				page: safePage,
				pageSize: PROJECT_LIST_PAGE_SIZE,
				total,
				totalPages,
				hasPrev: safePage > 1,
				hasNext: safePage < totalPages
			}
		};
	};

	const getProjectShell: ProjectSource['getProjectShell'] = async (projectId) => {
		const [project] = await ctx.db
			.select()
			.from(projects)
			.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
			.limit(1);

		if (!project) {
			throw new NotFoundError('Project', projectId);
		}

		const [customer] = project.businessPartnerId
			? await ctx.db
					.select({ id: businessPartners.id, name: businessPartners.name })
					.from(businessPartners)
					.where(eq(businessPartners.id, project.businessPartnerId))
					.limit(1)
			: [];

		const [projectListCounts, [contractsCountRow], [quotationsCountRow], [purchaseOrdersCountRow], [expensesCountRow]] =
			await Promise.all([
				projectRepository.getListCounts(),
				ctx.db
					.select({ n: sql<number>`count(*)` })
					.from(contracts)
					.where(and(eq(contracts.projectId, projectId), isNull(contracts.deletedAt))),
				ctx.db
					.select({ n: sql<number>`count(*)` })
					.from(quotations)
					.where(and(eq(quotations.projectId, projectId), isNull(quotations.deletedAt))),
				ctx.db
					.select({ n: sql<number>`count(*)` })
					.from(purchaseOrders)
					.where(and(eq(purchaseOrders.projectId, projectId), isNull(purchaseOrders.deletedAt))),
				ctx.db
					.select({ n: sql<number>`count(*)` })
					.from(expenses)
					.where(and(eq(expenses.projectId, projectId), isNull(expenses.deletedAt)))
			]);

		const [contractsPick, quotationsPick, purchaseOrdersPick, expensesPickRows] = await Promise.all([
			ctx.db
				.select({
					id: contracts.id,
					fileUrl: contracts.fileUrl,
					date: contracts.effectiveDate,
					amount: contracts.amount,
					currency: contracts.currency
				})
				.from(contracts)
				.where(and(eq(contracts.projectId, projectId), isNull(contracts.deletedAt)))
				.orderBy(desc(contracts.createdAt)),
			ctx.db
				.select({
					id: quotations.id,
					fileUrl: quotations.fileUrl,
					date: quotations.date,
					amount: quotations.amount,
					currency: quotations.currency,
					quotationNumber: quotations.quotationNumber
				})
				.from(quotations)
				.where(and(eq(quotations.projectId, projectId), isNull(quotations.deletedAt)))
				.orderBy(desc(quotations.createdAt)),
			ctx.db
				.select({
					id: purchaseOrders.id,
					poNumber: purchaseOrders.poNumber,
					supplierName: purchaseOrders.supplierName,
					date: purchaseOrders.date,
					amount: purchaseOrders.amount,
					currency: purchaseOrders.currency
				})
				.from(purchaseOrders)
				.where(and(eq(purchaseOrders.projectId, projectId), isNull(purchaseOrders.deletedAt)))
				.orderBy(desc(purchaseOrders.createdAt)),
			ctx.db
				.select({
					id: expenses.id,
					category: expenses.category,
					expenseType: expenses.expenseType,
					date: expenses.date,
					amount: expenses.amount,
					currency: expenses.currency
				})
				.from(expenses)
				.where(and(eq(expenses.projectId, projectId), isNull(expenses.deletedAt)))
				.orderBy(desc(expenses.date), desc(expenses.createdAt))
		]);

		const arPickLists = {
			contracts: contractsPick.map((row) => ({
				id: row.id,
				label: fileLabelFromUrl(row.fileUrl, row.date),
				subtitle: `${row.date ?? 'N/A'} - ${row.amount ?? 0} ${row.currency ?? 'SGD'}`
			})),
			quotations: quotationsPick.map((row) => ({
				id: row.id,
				label: fileLabelFromUrl(row.fileUrl ?? '', row.date),
				subtitle: `${row.date ?? 'N/A'} - ${row.amount ?? 0} ${row.currency ?? 'SGD'}${row.quotationNumber ? ` - ${row.quotationNumber}` : ''}`
			})),
			purchaseOrders: purchaseOrdersPick.map((row) => ({
				id: row.id,
				label: row.poNumber,
				subtitle: `${row.supplierName ?? 'N/A'} - ${row.date ?? 'N/A'} - ${row.amount ?? 0} ${row.currency ?? 'SGD'}`
			})),
			expenses: expensesPickRows.map((row) => ({
				id: row.id,
				label: `${row.expenseType === 'sales_cost' ? 'SC' : 'OpEx'}: ${row.category}`,
				subtitle: `${row.date ?? 'N/A'} - ${row.amount ?? 0} ${row.currency ?? 'SGD'}`
			}))
		};

		const activityRows = await ctx.db
			.select({
				id: auditLogs.id,
				action: auditLogs.action,
				actorEmail: auditLogs.actorEmail,
				createdAt: auditLogs.createdAt,
				metadata: auditLogs.metadata
			})
			.from(auditLogs)
			.where(and(eq(auditLogs.projectId, projectId), isNull(auditLogs.deletedAt)))
			.orderBy(desc(auditLogs.createdAt))
			.limit(25);

		const activityFeed = activityRows.map((row) => {
			const meta = parseAuditMetadata(row.metadata);
			const when = new Date(row.createdAt);
			const timeLabel = Number.isNaN(when.getTime())
				? row.createdAt
				: when.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' });

			return {
				id: row.id,
				summary: summarizeAuditForProject(row.action, meta),
				actor: row.actorEmail ?? 'System',
				timeLabel,
				variant: activityVariantForAction(row.action)
			};
		});

		return {
			project,
			customerName: customer?.name ?? project.businessPartnerId ?? '',
			projectListCounts,
			submoduleCounts: {
				contracts: Number(contractsCountRow?.n ?? 0),
				quotations: Number(quotationsCountRow?.n ?? 0),
				purchaseOrders: Number(purchaseOrdersCountRow?.n ?? 0),
				expenses: Number(expensesCountRow?.n ?? 0)
			},
			arPickLists,
			activityFeed
		};
	};

	return createProjectPublicApi({
		...legacySource,
		getById,
		getWithCustomer,
		list,
		getProjectListPage,
		getListCounts,
		getProjectShell,
		getMembers,
		getProjectFinancials
	});
}

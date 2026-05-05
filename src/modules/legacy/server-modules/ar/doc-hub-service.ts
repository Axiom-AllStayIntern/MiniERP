import { and, asc, desc, eq, gte, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import type { ModuleContext } from '$platform/modules/types';
import { schema } from '$infrastructure/db';
import { parseStoredInvoiceLineItems } from '$modules/finance/schemas/invoice-line-items';
import { parseDocumentMetadata } from '$modules/finance/schemas/document-metadata';

const DOC_HUB_PROJECT_PAGE_SIZE = 5;

type ProjectFilterInput = {
	projectId: string;
	q: string;
	status: string;
	startedAfter: string;
	page: number;
};

type DocHubProjectWithStats = {
	id: string;
	name: string;
	customerName: string | null;
	status: string;
	startDate: string | null;
	endDate: string | null;
	[key: string]: string | number | null;
};

function textParam(params: URLSearchParams, key: string, fallback = ''): string {
	return params.get(key)?.trim() ?? fallback;
}

function positivePage(params: URLSearchParams): number {
	const pageRaw = Number.parseInt(params.get('page') ?? '1', 10);
	return Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
}

function parseProjectFilters(params: URLSearchParams): ProjectFilterInput {
	return {
		projectId: params.get('projectId') ?? '',
		q: textParam(params, 'q'),
		status: textParam(params, 'status'),
		startedAfter: textParam(params, 'startedAfter'),
		page: positivePage(params)
	};
}

function fileViewUrl(fileUrl: string | null): string | null {
	return fileUrl && !fileUrl.startsWith('manual://') ? `/api/files?key=${encodeURIComponent(fileUrl)}` : null;
}

function tryParseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export class ArDocHubService {
	constructor(private ctx: ModuleContext) {}

	async getContractDocHubPage(params: URLSearchParams) {
		const projectFilters = parseProjectFilters(params);
		const contractQ = textParam(params, 'contractQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const contractFieldRaw = textParam(params, 'contractField', 'all');
		const listMode =
			listModeRaw === 'all' || listModeRaw === 'unassigned' || listModeRaw === 'selected'
				? listModeRaw
				: 'all';
		const contractField =
			contractFieldRaw === 'id' ||
			contractFieldRaw === 'amount' ||
			contractFieldRaw === 'date' ||
			contractFieldRaw === 'notes' ||
			contractFieldRaw === 'all'
				? contractFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(schema.contracts.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(schema.contracts.projectId, projectFilters.projectId) : sql`1 = 0`);
		} else if (listMode === 'unassigned') {
			conditions.push(isNull(schema.contracts.projectId));
		}
		if (contractQ) {
			if (contractField === 'id') {
				conditions.push(like(schema.contracts.id, `%${contractQ}%`));
			} else if (contractField === 'amount') {
				conditions.push(like(sql`cast(coalesce(${schema.contracts.amount}, 0) as text)`, `%${contractQ}%`));
			} else if (contractField === 'date') {
				conditions.push(like(schema.contracts.effectiveDate, `%${contractQ}%`));
			} else if (contractField === 'notes') {
				conditions.push(like(sql`coalesce(${schema.contracts.metadata}, '')`, `%${contractQ}%`));
			} else {
				conditions.push(
					or(
						like(schema.contracts.id, `%${contractQ}%`),
						like(sql`cast(coalesce(${schema.contracts.amount}, 0) as text)`, `%${contractQ}%`),
						like(schema.contracts.effectiveDate, `%${contractQ}%`),
						like(sql`coalesce(${schema.contracts.metadata}, '')`, `%${contractQ}%`)
					)!
				);
			}
		}

		const contracts = await this.ctx.db
			.select()
			.from(schema.contracts)
			.where(and(...conditions))
			.orderBy(desc(schema.contracts.effectiveDate), desc(schema.contracts.createdAt));

		const countRows = await this.ctx.db
			.select({ projectId: schema.contracts.projectId, total: sql<number>`count(*)` })
			.from(schema.contracts)
			.where(isNull(schema.contracts.deletedAt))
			.groupBy(schema.contracts.projectId);
		const projectPage = await this.getProjectPicker(
			projectFilters,
			countRows,
			contracts.map((item) => item.projectId),
			'contractCount'
		);

		return {
			contracts: contracts.map((item) => ({
				...item,
				projectName: item.projectId
					? projectPage.projectMap.get(item.projectId) ?? item.projectId
					: 'Unassigned Contract',
				fileViewUrl: fileViewUrl(item.fileUrl),
				docMeta: parseDocumentMetadata(item.metadata)
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, contractQ, listMode, contractField },
			pagination: projectPage.pagination
		};
	}

	async getQuotationDocHubPage(params: URLSearchParams) {
		const projectFilters = parseProjectFilters(params);
		const quotationQ = textParam(params, 'quotationQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const quotationFieldRaw = textParam(params, 'quotationField', 'all');
		const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
		const quotationField =
			quotationFieldRaw === 'id' ||
			quotationFieldRaw === 'amount' ||
			quotationFieldRaw === 'date' ||
			quotationFieldRaw === 'notes' ||
			quotationFieldRaw === 'source' ||
			quotationFieldRaw === 'all'
				? quotationFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(schema.quotations.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(schema.quotations.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (quotationQ) {
			if (quotationField === 'id') conditions.push(like(schema.quotations.id, `%${quotationQ}%`));
			else if (quotationField === 'amount')
				conditions.push(like(sql`cast(coalesce(${schema.quotations.amount}, 0) as text)`, `%${quotationQ}%`));
			else if (quotationField === 'date') conditions.push(like(schema.quotations.date, `%${quotationQ}%`));
			else if (quotationField === 'notes')
				conditions.push(like(sql`coalesce(${schema.quotations.metadata}, '')`, `%${quotationQ}%`));
			else if (quotationField === 'source')
				conditions.push(like(sql`coalesce(${schema.quotations.quotationNumber}, '')`, `%${quotationQ}%`));
			else {
				conditions.push(
					or(
						like(schema.quotations.id, `%${quotationQ}%`),
						like(sql`cast(coalesce(${schema.quotations.amount}, 0) as text)`, `%${quotationQ}%`),
						like(schema.quotations.date, `%${quotationQ}%`),
						like(sql`coalesce(${schema.quotations.quotationNumber}, '')`, `%${quotationQ}%`),
						like(sql`coalesce(${schema.quotations.metadata}, '')`, `%${quotationQ}%`)
					)!
				);
			}
		}

		const quotations = await this.ctx.db
			.select()
			.from(schema.quotations)
			.where(and(...conditions))
			.orderBy(desc(schema.quotations.date), desc(schema.quotations.createdAt));
		const countRows = await this.ctx.db
			.select({ projectId: schema.quotations.projectId, total: sql<number>`count(*)` })
			.from(schema.quotations)
			.where(isNull(schema.quotations.deletedAt))
			.groupBy(schema.quotations.projectId);
		const projectPage = await this.getProjectPicker(
			projectFilters,
			countRows,
			quotations.map((item) => item.projectId),
			'quotationCount'
		);

		return {
			quotations: quotations.map((item) => ({
				...item,
				projectName: item.projectId ? projectPage.projectMap.get(item.projectId) ?? item.projectId : item.projectId,
				fileViewUrl: fileViewUrl(item.fileUrl),
				docMeta: parseDocumentMetadata(item.metadata)
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, quotationQ, listMode, quotationField },
			pagination: projectPage.pagination
		};
	}

	async getPurchaseOrderDocHubPage(params: URLSearchParams) {
		const projectFilters = parseProjectFilters(params);
		const poQ = textParam(params, 'poQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const poFieldRaw = textParam(params, 'poField', 'all');
		const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
		const poField =
			poFieldRaw === 'id' ||
			poFieldRaw === 'poNumber' ||
			poFieldRaw === 'supplier' ||
			poFieldRaw === 'amount' ||
			poFieldRaw === 'date' ||
			poFieldRaw === 'notes' ||
			poFieldRaw === 'all'
				? poFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(schema.purchaseOrders.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(schema.purchaseOrders.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (poQ) {
			if (poField === 'id') conditions.push(like(schema.purchaseOrders.id, `%${poQ}%`));
			else if (poField === 'poNumber') conditions.push(like(schema.purchaseOrders.poNumber, `%${poQ}%`));
			else if (poField === 'supplier')
				conditions.push(like(sql`coalesce(${schema.purchaseOrders.supplierName}, '')`, `%${poQ}%`));
			else if (poField === 'amount')
				conditions.push(like(sql`cast(coalesce(${schema.purchaseOrders.amount}, 0) as text)`, `%${poQ}%`));
			else if (poField === 'date')
				conditions.push(like(sql`coalesce(${schema.purchaseOrders.date}, '')`, `%${poQ}%`));
			else if (poField === 'notes')
				conditions.push(like(sql`coalesce(${schema.purchaseOrders.metadata}, '')`, `%${poQ}%`));
			else {
				conditions.push(
					or(
						like(schema.purchaseOrders.id, `%${poQ}%`),
						like(schema.purchaseOrders.poNumber, `%${poQ}%`),
						like(sql`coalesce(${schema.purchaseOrders.supplierName}, '')`, `%${poQ}%`),
						like(sql`cast(coalesce(${schema.purchaseOrders.amount}, 0) as text)`, `%${poQ}%`),
						like(sql`coalesce(${schema.purchaseOrders.date}, '')`, `%${poQ}%`),
						like(sql`coalesce(${schema.purchaseOrders.metadata}, '')`, `%${poQ}%`)
					)!
				);
			}
		}

		const purchaseOrders = await this.ctx.db
			.select()
			.from(schema.purchaseOrders)
			.where(and(...conditions))
			.orderBy(desc(schema.purchaseOrders.date), desc(schema.purchaseOrders.createdAt));
		const countRows = await this.ctx.db
			.select({ projectId: schema.purchaseOrders.projectId, total: sql<number>`count(*)` })
			.from(schema.purchaseOrders)
			.where(isNull(schema.purchaseOrders.deletedAt))
			.groupBy(schema.purchaseOrders.projectId);
		const projectPage = await this.getProjectPicker(
			projectFilters,
			countRows,
			purchaseOrders.map((item) => item.projectId),
			'poCount'
		);

		return {
			purchaseOrders: purchaseOrders.map((item) => ({
				...item,
				projectName: item.projectId ? projectPage.projectMap.get(item.projectId) ?? item.projectId : item.projectId,
				fileViewUrl: fileViewUrl(item.fileUrl),
				docMeta: parseDocumentMetadata(item.metadata)
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, poQ, listMode, poField },
			pagination: projectPage.pagination
		};
	}

	async getSupplierInvoiceDocHubPage(params: URLSearchParams) {
		const projectFilters = parseProjectFilters(params);
		const supplierQ = textParam(params, 'supplierQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const supplierFieldRaw = textParam(params, 'supplierField', 'all');
		const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
		const supplierField =
			supplierFieldRaw === 'id' ||
			supplierFieldRaw === 'supplier' ||
			supplierFieldRaw === 'amount' ||
			supplierFieldRaw === 'date' ||
			supplierFieldRaw === 'status' ||
			supplierFieldRaw === 'poNumber' ||
			supplierFieldRaw === 'all'
				? supplierFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(schema.invoicesIn.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(schema.invoicesIn.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (supplierQ) {
			if (supplierField === 'id') conditions.push(like(schema.invoicesIn.id, `%${supplierQ}%`));
			else if (supplierField === 'supplier')
				conditions.push(like(sql`coalesce(${schema.invoicesIn.supplierName}, '')`, `%${supplierQ}%`));
			else if (supplierField === 'amount')
				conditions.push(like(sql`cast(coalesce(${schema.invoicesIn.amount}, 0) as text)`, `%${supplierQ}%`));
			else if (supplierField === 'date')
				conditions.push(like(sql`coalesce(${schema.invoicesIn.invoiceDate}, '')`, `%${supplierQ}%`));
			else if (supplierField === 'status') conditions.push(like(schema.invoicesIn.status, `%${supplierQ}%`));
			else if (supplierField === 'poNumber')
				conditions.push(like(sql`coalesce(${schema.invoicesIn.poNumber}, '')`, `%${supplierQ}%`));
			else {
				conditions.push(
					or(
						like(schema.invoicesIn.id, `%${supplierQ}%`),
						like(sql`coalesce(${schema.invoicesIn.supplierName}, '')`, `%${supplierQ}%`),
						like(sql`cast(coalesce(${schema.invoicesIn.amount}, 0) as text)`, `%${supplierQ}%`),
						like(sql`coalesce(${schema.invoicesIn.invoiceDate}, '')`, `%${supplierQ}%`),
						like(schema.invoicesIn.status, `%${supplierQ}%`),
						like(sql`coalesce(${schema.invoicesIn.poNumber}, '')`, `%${supplierQ}%`)
					)!
				);
			}
		}

		const invoiceRows = await this.ctx.db
			.select()
			.from(schema.invoicesIn)
			.where(and(...conditions))
			.orderBy(desc(schema.invoicesIn.invoiceDate), desc(schema.invoicesIn.createdAt));
		const countRows = await this.ctx.db
			.select({ projectId: schema.invoicesIn.projectId, total: sql<number>`count(*)` })
			.from(schema.invoicesIn)
			.where(isNull(schema.invoicesIn.deletedAt))
			.groupBy(schema.invoicesIn.projectId);
		const projectPage = await this.getProjectPicker(
			projectFilters,
			countRows,
			invoiceRows.map((row) => row.projectId),
			'supplierInvoiceCount'
		);

		return {
			invoices: invoiceRows.map((item) => ({
				...item,
				projectName: item.projectId ? projectPage.projectMap.get(item.projectId) ?? item.projectId : item.projectId,
				rawParsed: item.rawOcr ? tryParseJson(item.rawOcr) : null
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, supplierQ, listMode, supplierField },
			pagination: projectPage.pagination
		};
	}

	async getCustomerInvoiceDocHubPage(params: URLSearchParams) {
		const projectFilters = parseProjectFilters(params);
		const invoiceQ = textParam(params, 'invoiceQ');
		const listModeRaw = textParam(params, 'listMode', 'all');
		const invoiceFieldRaw = textParam(params, 'invoiceField', 'all');
		const listMode = listModeRaw === 'selected' || listModeRaw === 'all' ? listModeRaw : 'all';
		const invoiceField =
			invoiceFieldRaw === 'invoiceNo' ||
			invoiceFieldRaw === 'total' ||
			invoiceFieldRaw === 'date' ||
			invoiceFieldRaw === 'status' ||
			invoiceFieldRaw === 'customer' ||
			invoiceFieldRaw === 'id' ||
			invoiceFieldRaw === 'all'
				? invoiceFieldRaw
				: 'all';

		const conditions: SQL[] = [isNull(schema.invoicesOut.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(schema.invoicesOut.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (invoiceQ) {
			if (invoiceField === 'invoiceNo') conditions.push(like(schema.invoicesOut.invoiceNo, `%${invoiceQ}%`));
			else if (invoiceField === 'total')
				conditions.push(like(sql`cast(coalesce(${schema.invoicesOut.total}, 0) as text)`, `%${invoiceQ}%`));
			else if (invoiceField === 'date') conditions.push(like(schema.invoicesOut.date, `%${invoiceQ}%`));
			else if (invoiceField === 'status') conditions.push(like(schema.invoicesOut.status, `%${invoiceQ}%`));
			else if (invoiceField === 'customer')
				conditions.push(like(sql`coalesce(${schema.customers.name}, '')`, `%${invoiceQ}%`));
			else if (invoiceField === 'id') conditions.push(like(schema.invoicesOut.id, `%${invoiceQ}%`));
			else {
				conditions.push(
					or(
						like(schema.invoicesOut.id, `%${invoiceQ}%`),
						like(schema.invoicesOut.invoiceNo, `%${invoiceQ}%`),
						like(sql`cast(coalesce(${schema.invoicesOut.total}, 0) as text)`, `%${invoiceQ}%`),
						like(schema.invoicesOut.date, `%${invoiceQ}%`),
						like(schema.invoicesOut.status, `%${invoiceQ}%`),
						like(sql`coalesce(${schema.customers.name}, '')`, `%${invoiceQ}%`)
					)!
				);
			}
		}

		const invoiceRows = await this.ctx.db
			.select({
				id: schema.invoicesOut.id,
				projectId: schema.invoicesOut.projectId,
				customerId: schema.invoicesOut.customerId,
				invoiceNo: schema.invoicesOut.invoiceNo,
				date: schema.invoicesOut.date,
				dueDate: schema.invoicesOut.dueDate,
				currency: schema.invoicesOut.currency,
				subtotal: schema.invoicesOut.subtotal,
				gstType: schema.invoicesOut.gstType,
				gstAmount: schema.invoicesOut.gstAmount,
				total: schema.invoicesOut.total,
				status: schema.invoicesOut.status,
				lineItems: schema.invoicesOut.lineItems,
				pdfUrl: schema.invoicesOut.pdfUrl,
				createdAt: schema.invoicesOut.createdAt,
				updatedAt: schema.invoicesOut.updatedAt,
				customerName: schema.customers.name
			})
			.from(schema.invoicesOut)
			.leftJoin(schema.customers, eq(schema.invoicesOut.customerId, schema.customers.id))
			.where(and(...conditions))
			.orderBy(desc(schema.invoicesOut.date), desc(schema.invoicesOut.createdAt));
		const countRows = await this.ctx.db
			.select({ projectId: schema.invoicesOut.projectId, total: sql<number>`count(*)` })
			.from(schema.invoicesOut)
			.where(isNull(schema.invoicesOut.deletedAt))
			.groupBy(schema.invoicesOut.projectId);
		const projectPage = await this.getProjectPicker(
			projectFilters,
			countRows,
			invoiceRows.map((row) => row.projectId),
			'invoiceCount'
		);

		return {
			invoices: invoiceRows.map((row) => ({
				...row,
				projectName: row.projectId ? projectPage.projectMap.get(row.projectId) ?? row.projectId : row.projectId
			})),
			projects: projectPage.projectsWithStats,
			selectedProject: projectPage.selectedProject,
			filters: { ...projectPage.filters, invoiceQ, listMode, invoiceField },
			pagination: projectPage.pagination
		};
	}

	async getCustomerInvoiceGeneratePage(params: URLSearchParams) {
		const preselectProjectId = params.get('projectId')?.trim() ?? '';
		const invoiceId = params.get('invoiceId')?.trim() ?? '';
		const projects = await this.ctx.db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				customerId: schema.projects.customerId,
				customerName: schema.customers.name,
				customerAddress: schema.customers.address
			})
			.from(schema.projects)
			.leftJoin(schema.customers, eq(schema.customers.id, schema.projects.customerId))
			.where(isNull(schema.projects.deletedAt))
			.orderBy(asc(schema.projects.name))
			.limit(500);

		let editingInvoice: null | {
			id: string;
			projectId: string | null;
			customerId: string | null;
			invoiceNo: string;
			date: string;
			dueDate: string | null;
			currency: string;
			gstType: 'standard' | 'zero' | 'exempt';
			lines: Array<{ desc: string; qty: number; price: number }>;
			generator: Record<string, unknown> | undefined;
		} = null;

		if (invoiceId) {
			const [invoice] = await this.ctx.db
				.select({
					id: schema.invoicesOut.id,
					projectId: schema.invoicesOut.projectId,
					customerId: schema.invoicesOut.customerId,
					invoiceNo: schema.invoicesOut.invoiceNo,
					date: schema.invoicesOut.date,
					dueDate: schema.invoicesOut.dueDate,
					currency: schema.invoicesOut.currency,
					gstType: schema.invoicesOut.gstType,
					lineItems: schema.invoicesOut.lineItems
				})
				.from(schema.invoicesOut)
				.where(and(eq(schema.invoicesOut.id, invoiceId), isNull(schema.invoicesOut.deletedAt)))
				.limit(1);
			if (invoice) {
				const parsed = parseStoredInvoiceLineItems(invoice.lineItems);
				editingInvoice = {
					id: invoice.id,
					projectId: invoice.projectId,
					customerId: invoice.customerId,
					invoiceNo: invoice.invoiceNo,
					date: invoice.date,
					dueDate: invoice.dueDate,
					currency: invoice.currency,
					gstType: invoice.gstType,
					lines: parsed.lines,
					generator: parsed.generator
				};
			}
		}

		return {
			projects,
			preselectProjectId: editingInvoice?.projectId ?? preselectProjectId,
			editingInvoice
		};
	}

	private async getProjectPicker(
		input: ProjectFilterInput,
		countRows: Array<{ projectId: string | null; total: number }>,
		itemProjectIds: Array<string | null>,
		statKey: string
	) {
		const projectConditions: SQL[] = [isNull(schema.projects.deletedAt)];
		if (input.q) {
			projectConditions.push(
				or(
					like(schema.projects.name, `%${input.q}%`),
					like(schema.projects.id, `%${input.q}%`),
					like(schema.customers.name, `%${input.q}%`)
				)!
			);
		}
		if (input.status) projectConditions.push(eq(schema.projects.status, input.status));
		if (input.startedAfter) projectConditions.push(gte(schema.projects.startDate, input.startedAfter));

		const projectCountRows = await this.ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(schema.projects)
			.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
			.where(and(...projectConditions));
		const total = Number(projectCountRows[0]?.total ?? 0);
		const totalPages = Math.max(1, Math.ceil(total / DOC_HUB_PROJECT_PAGE_SIZE));
		const safePage = Math.min(input.page, totalPages);
		const safeOffset = (safePage - 1) * DOC_HUB_PROJECT_PAGE_SIZE;

		const projects = await this.ctx.db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				customerName: schema.customers.name,
				status: schema.projects.status,
				startDate: schema.projects.startDate,
				endDate: schema.projects.endDate
			})
			.from(schema.projects)
			.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
			.where(and(...projectConditions))
			.orderBy(desc(schema.projects.startDate), desc(schema.projects.updatedAt))
			.limit(DOC_HUB_PROJECT_PAGE_SIZE)
			.offset(safeOffset);

		const countMap = new Map(countRows.map((row) => [row.projectId, Number(row.total ?? 0)]));
		const projectsWithStats: DocHubProjectWithStats[] = projects.map((project) => ({
			...project,
			[statKey]: countMap.get(project.id) ?? 0
		}));

		const fallbackProjectIds = Array.from(
			new Set(
				itemProjectIds.filter(
					(id): id is string => Boolean(id) && !projectsWithStats.some((project) => project.id === id)
				)
			)
		);
		const fallbackProjects =
			fallbackProjectIds.length > 0
				? await this.ctx.db
						.select({ id: schema.projects.id, name: schema.projects.name })
						.from(schema.projects)
						.where(inArray(schema.projects.id, fallbackProjectIds))
				: [];
		const projectMap = new Map([
			...projectsWithStats.map((project) => [project.id, project.name] as const),
			...fallbackProjects.map((project) => [project.id, project.name] as const)
		]);

		let selectedProject: DocHubProjectWithStats | null =
			projectsWithStats.find((project) => project.id === input.projectId) ?? null;
		if (!selectedProject && input.projectId) {
			const [fallbackProject] = await this.ctx.db
				.select({
					id: schema.projects.id,
					name: schema.projects.name,
					customerName: schema.customers.name,
					status: schema.projects.status,
					startDate: schema.projects.startDate,
					endDate: schema.projects.endDate
				})
				.from(schema.projects)
				.leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
				.where(and(isNull(schema.projects.deletedAt), eq(schema.projects.id, input.projectId)))
				.limit(1);
			if (fallbackProject) {
				selectedProject = {
					...fallbackProject,
					[statKey]: countMap.get(fallbackProject.id) ?? 0
				};
			}
		}

		return {
			projectsWithStats,
			selectedProject,
			projectMap,
			filters: {
				projectId: input.projectId,
				q: input.q,
				status: input.status,
				startedAfter: input.startedAfter,
				page: safePage
			},
			pagination: {
				page: safePage,
				pageSize: DOC_HUB_PROJECT_PAGE_SIZE,
				total,
				totalPages,
				hasPrev: safePage > 1,
				hasNext: safePage < totalPages
			}
		};
	}
}

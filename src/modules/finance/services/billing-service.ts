import { and, asc, desc, eq, isNull, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { parseStoredInvoiceLineItems } from '$lib/invoice-line-items';
import { objectExists } from '$lib/server/r2';
import type { ModuleContext } from '../../../lib/server/modules/types';
import { ConflictError, NotFoundError } from '../../../lib/server/modules/errors';
import { createEvent } from '../../../platform/events';
import { customers, invoicesOut, projects } from '../../../infrastructure/db/schema';
import { BillingRepository } from '../repositories';
import { getDocHubProjectPicker, parseProjectFilters, textParam } from './doc-hub-shared';

function escPdfText(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimpleInvoicePdf(params: {
	invoiceNo: string;
	date: string;
	dueDate: string | null;
	currency: string | null;
	customerName: string;
	total: number;
	lines: Array<{ desc: string; qty: number; price: number }>;
}) {
	const rows = params.lines.slice(0, 18);
	const textLines = [
		'SmartFin Invoice',
		`Invoice No: ${params.invoiceNo}`,
		`Date: ${params.date}`,
		`Due: ${params.dueDate ?? '-'}`,
		`Customer: ${params.customerName}`,
		'',
		'Description | Qty | Unit | Amount'
	];
	for (const row of rows) {
		const amount = row.qty * row.price;
		textLines.push(
			`${row.desc || '-'} | ${row.qty} | ${params.currency} ${row.price.toFixed(2)} | ${params.currency} ${amount.toFixed(2)}`
		);
	}
	textLines.push('', `Total: ${params.currency} ${params.total.toFixed(2)}`);

	const streamParts: string[] = ['BT', '/F1 12 Tf', '50 790 Td', '14 TL'];
	textLines.forEach((line, index) => {
		if (index > 0) streamParts.push('T*');
		streamParts.push(`(${escPdfText(line)}) Tj`);
	});
	streamParts.push('ET');
	const stream = streamParts.join('\n');

	const objects: string[] = [];
	objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
	objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
	objects.push(
		'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj'
	);
	objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
	objects.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);

	let pdf = '%PDF-1.4\n';
	const xref: number[] = [0];
	for (const obj of objects) {
		xref.push(pdf.length);
		pdf += `${obj}\n`;
	}
	const xrefStart = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += '0000000000 65535 f \n';
	for (let index = 1; index <= objects.length; index++) {
		pdf += `${String(xref[index]).padStart(10, '0')} 00000 n \n`;
	}
	pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

	return new TextEncoder().encode(pdf);
}

function calculateGst(subtotal: number, gstType: string) {
	const rate = gstType === 'standard' ? 0.09 : 0;
	const gstAmount = Math.round(subtotal * rate * 100) / 100;
	const total = Math.round((subtotal + gstAmount) * 100) / 100;
	return { gstAmount, total };
}

function nowIso() {
	return new Date().toISOString();
}

export function createFinanceBillingApi(ctx: ModuleContext) {
	const billingRepository = new BillingRepository(ctx.db);

	const createCustomerInvoice = async (data: {
		projectId: string;
		customerId: string;
		invoiceNo: string;
		date: string;
		dueDate?: string;
		currency?: string;
		subtotal: number;
		gstType?: string;
		lineItems?: string;
		status?: string;
	}) => {
		const existing = await billingRepository.findByInvoiceNo(data.invoiceNo);
		if (existing) throw new ConflictError(`Invoice number "${data.invoiceNo}" already exists`);

		const gstType: 'standard' | 'zero' | 'exempt' =
			data.gstType === 'zero' || data.gstType === 'exempt' || data.gstType === 'standard'
				? data.gstType
				: 'standard';
		const { gstAmount, total } = calculateGst(data.subtotal, gstType);
		const now = nowIso();
		const created = {
			id: crypto.randomUUID(),
			projectId: data.projectId,
			customerId: data.customerId,
			invoiceNo: data.invoiceNo,
			date: data.date,
			dueDate: data.dueDate,
			currency: data.currency,
			subtotal: data.subtotal,
			gstType,
			gstAmount,
			total,
			lineItems: data.lineItems,
			status: data.status ?? 'draft',
			createdAt: now,
			updatedAt: now
		};

		await ctx.db.insert(invoicesOut).values(created);
		await ctx.eventBus.emit(
			createEvent('invoice.created', 'ar', {
				invoiceId: created.id,
				projectId: data.projectId,
				type: 'customer',
				amount: total
			})
		);

		return created;
	};

	const updateCustomerInvoiceDraft = async (
		id: string,
		data: {
			projectId?: string;
			customerId?: string;
			date?: string;
			dueDate?: string;
			currency?: string;
			gstType?: 'standard' | 'zero' | 'exempt';
			lineItems?: Array<{ desc: string; qty: number; price: number } & Record<string, unknown>>;
			invoiceNo?: string;
			generatorMeta?: Record<string, unknown>;
		}
	) => {
		const [existing] = await ctx.db
			.select({ id: invoicesOut.id })
			.from(invoicesOut)
			.where(and(eq(invoicesOut.id, id), isNull(invoicesOut.deletedAt)))
			.limit(1);
		if (!existing) throw new NotFoundError('Invoice');

		const desiredNo = typeof data.invoiceNo === 'string' ? data.invoiceNo.trim() : '';
		if (desiredNo) {
			const [collision] = await ctx.db
				.select({ id: invoicesOut.id })
				.from(invoicesOut)
				.where(
					and(eq(invoicesOut.invoiceNo, desiredNo), isNull(invoicesOut.deletedAt), ne(invoicesOut.id, id))
				)
				.limit(1);
			if (collision) throw new ConflictError('This invoice number is already in use.');
		}

		const lineItems = data.lineItems ?? [];
		const subtotal = lineItems.reduce(
			(sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0),
			0
		);
		const gstRate = data.gstType === 'standard' || !data.gstType ? 0.09 : 0;
		const gstAmount = subtotal * gstRate;
		const total = subtotal + gstAmount;

		const storedLineItems =
			data.generatorMeta && typeof data.generatorMeta === 'object'
				? JSON.stringify({ version: 2, lines: lineItems, generator: data.generatorMeta })
				: JSON.stringify(lineItems);

		await ctx.db
			.update(invoicesOut)
			.set({
				projectId: data.projectId,
				customerId: data.customerId,
				invoiceNo: desiredNo || undefined,
				date: data.date,
				dueDate: data.dueDate,
				currency: data.currency ?? 'SGD',
				gstType: data.gstType ?? 'standard',
				subtotal,
				gstAmount,
				total,
				lineItems: storedLineItems,
				updatedAt: nowIso()
			})
			.where(eq(invoicesOut.id, id));

		return { id, invoiceNo: desiredNo || null };
	};

	const getCustomerInvoiceDocHubPage = async (params: URLSearchParams) => {
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

		const conditions: SQL[] = [isNull(invoicesOut.deletedAt)];
		if (listMode === 'selected') {
			conditions.push(projectFilters.projectId ? eq(invoicesOut.projectId, projectFilters.projectId) : sql`1 = 0`);
		}
		if (invoiceQ) {
			if (invoiceField === 'invoiceNo') conditions.push(like(invoicesOut.invoiceNo, `%${invoiceQ}%`));
			else if (invoiceField === 'total')
				conditions.push(like(sql`cast(coalesce(${invoicesOut.total}, 0) as text)`, `%${invoiceQ}%`));
			else if (invoiceField === 'date') conditions.push(like(invoicesOut.date, `%${invoiceQ}%`));
			else if (invoiceField === 'status') conditions.push(like(invoicesOut.status, `%${invoiceQ}%`));
			else if (invoiceField === 'customer')
				conditions.push(like(sql`coalesce(${customers.name}, '')`, `%${invoiceQ}%`));
			else if (invoiceField === 'id') conditions.push(like(invoicesOut.id, `%${invoiceQ}%`));
			else {
				conditions.push(
					or(
						like(invoicesOut.id, `%${invoiceQ}%`),
						like(invoicesOut.invoiceNo, `%${invoiceQ}%`),
						like(sql`cast(coalesce(${invoicesOut.total}, 0) as text)`, `%${invoiceQ}%`),
						like(invoicesOut.date, `%${invoiceQ}%`),
						like(invoicesOut.status, `%${invoiceQ}%`),
						like(sql`coalesce(${customers.name}, '')`, `%${invoiceQ}%`)
					)!
				);
			}
		}

		const invoiceRows = await ctx.db
			.select({
				id: invoicesOut.id,
				projectId: invoicesOut.projectId,
				customerId: invoicesOut.customerId,
				invoiceNo: invoicesOut.invoiceNo,
				date: invoicesOut.date,
				dueDate: invoicesOut.dueDate,
				currency: invoicesOut.currency,
				subtotal: invoicesOut.subtotal,
				gstType: invoicesOut.gstType,
				gstAmount: invoicesOut.gstAmount,
				total: invoicesOut.total,
				status: invoicesOut.status,
				lineItems: invoicesOut.lineItems,
				pdfUrl: invoicesOut.pdfUrl,
				createdAt: invoicesOut.createdAt,
				updatedAt: invoicesOut.updatedAt,
				customerName: customers.name
			})
			.from(invoicesOut)
			.leftJoin(customers, eq(invoicesOut.customerId, customers.id))
			.where(and(...conditions))
			.orderBy(desc(invoicesOut.date), desc(invoicesOut.createdAt));
		const countRows = await ctx.db
			.select({ projectId: invoicesOut.projectId, total: sql<number>`count(*)` })
			.from(invoicesOut)
			.where(isNull(invoicesOut.deletedAt))
			.groupBy(invoicesOut.projectId);
		const projectPage = await getDocHubProjectPicker(
			ctx.db,
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
	};

	const getCustomerInvoiceGeneratePage = async (params: URLSearchParams) => {
			const preselectProjectId = params.get('projectId')?.trim() ?? '';
			const invoiceId = params.get('invoiceId')?.trim() ?? '';
			const projectRows = await ctx.db
				.select({
					id: projects.id,
					name: projects.name,
					customerId: projects.customerId,
					customerName: customers.name,
					customerAddress: customers.address
				})
				.from(projects)
				.leftJoin(customers, eq(customers.id, projects.customerId))
				.where(isNull(projects.deletedAt))
				.orderBy(asc(projects.name))
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
				const [invoice] = await ctx.db
					.select({
						id: invoicesOut.id,
						projectId: invoicesOut.projectId,
						customerId: invoicesOut.customerId,
						invoiceNo: invoicesOut.invoiceNo,
						date: invoicesOut.date,
						dueDate: invoicesOut.dueDate,
						currency: invoicesOut.currency,
						gstType: invoicesOut.gstType,
						lineItems: invoicesOut.lineItems
					})
					.from(invoicesOut)
					.where(and(eq(invoicesOut.id, invoiceId), isNull(invoicesOut.deletedAt)))
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
				projects: projectRows,
				preselectProjectId: editingInvoice?.projectId ?? preselectProjectId,
				editingInvoice
			};
		};

	const getCustomerInvoicePreview = async (id: string) => {
		const [invoice] = await ctx.db.select().from(invoicesOut).where(eq(invoicesOut.id, id)).limit(1);
		if (!invoice) return null;

		const parsed = parseStoredInvoiceLineItems(invoice.lineItems);
		return {
			id: invoice.id,
			invoiceNo: invoice.invoiceNo,
			date: invoice.date,
			dueDate: invoice.dueDate,
			currency: invoice.currency,
			gstType: invoice.gstType,
			subtotal: invoice.subtotal,
			gstAmount: invoice.gstAmount,
			total: invoice.total,
			lineItems: parsed.lines,
			generatorMeta: parsed.generator ?? null
		};
	};

	const issueCustomerInvoicePdf = async (id: string, uploadedKey = '') => {
		const [invoice] = await ctx.db
			.select({
				id: invoicesOut.id,
				invoiceNo: invoicesOut.invoiceNo,
				date: invoicesOut.date,
				dueDate: invoicesOut.dueDate,
				currency: invoicesOut.currency,
				total: invoicesOut.total,
				lineItems: invoicesOut.lineItems,
				customerName: customers.name,
				customerId: invoicesOut.customerId
			})
			.from(invoicesOut)
			.leftJoin(customers, eq(invoicesOut.customerId, customers.id))
			.where(eq(invoicesOut.id, id))
			.limit(1);
		if (!invoice) return { status: 'invoice-not-found' as const };

		const keyFromUpload = uploadedKey.trim();
		if (keyFromUpload) {
			if (!(await objectExists(ctx.env, keyFromUpload))) {
				return { status: 'uploaded-pdf-not-found' as const };
			}
			await ctx.db
				.update(invoicesOut)
				.set({ pdfUrl: keyFromUpload, status: 'issued', updatedAt: nowIso() })
				.where(eq(invoicesOut.id, invoice.id));
			return { status: 'ok' as const, id: invoice.id, pdfUrl: keyFromUpload };
		}

		const parsed = parseStoredInvoiceLineItems(invoice.lineItems);
		const invoiceCurrency = invoice.currency ?? 'SGD';
		const pdfBytes = buildSimpleInvoicePdf({
			invoiceNo: invoice.invoiceNo,
			date: invoice.date,
			dueDate: invoice.dueDate,
			currency: invoiceCurrency,
			customerName: invoice.customerName ?? invoice.customerId ?? 'Unknown customer',
			total: invoice.total,
			lines: parsed.lines
		});

		const generatedKey = `invoices/out/${invoice.id}.pdf`;
		await ctx.env.R2.put(generatedKey, pdfBytes, {
			httpMetadata: { contentType: 'application/pdf' }
		});

		await ctx.db
			.update(invoicesOut)
			.set({ pdfUrl: generatedKey, status: 'issued', updatedAt: nowIso() })
			.where(eq(invoicesOut.id, invoice.id));

		return { status: 'ok' as const, id: invoice.id, pdfUrl: generatedKey };
	};

	const importContractLinesToCustomerInvoice = async (id: string) => {
			const invoice = await billingRepository.findById(id);
			if (!invoice) return null;

			const contract = await billingRepository.findContractByProject(invoice.projectId);
			if (!contract) {
				return { imported: 0, lineItems: [] };
			}

			const lineItems = [
				{
					desc: 'Imported from contract',
					qty: 1,
					price: contract.amount ?? 0
				}
			];
			const subtotal = lineItems.reduce((sum, line) => sum + line.qty * line.price, 0);
			const gstAmount = invoice.gstType === 'standard' ? subtotal * 0.09 : 0;

			await ctx.db
				.update(invoicesOut)
				.set({
					lineItems: JSON.stringify(lineItems),
					subtotal,
					gstAmount,
					total: subtotal + gstAmount,
					updatedAt: nowIso()
				})
				.where(eq(invoicesOut.id, invoice.id));

			return { imported: lineItems.length, lineItems };
		};

	const getCustomerInvoicesByProject = async (projectId: string) =>
		billingRepository.findCustomerInvoicesByProject(projectId);

	const getSupplierInvoicesByProject = async (projectId: string) =>
		billingRepository.findSupplierInvoicesByProject(projectId);

	const getProjectRevenue = async (projectId: string) =>
		billingRepository.getProjectRevenue(projectId);

	const getProjectPurchaseCost = async (projectId: string) =>
		billingRepository.getProjectPurchaseCost(projectId);

	return {
		createCustomerInvoice,
		updateCustomerInvoiceDraft,
		getCustomerInvoiceDocHubPage,
		getCustomerInvoiceGeneratePage,
		getCustomerInvoicePreview,
		issueCustomerInvoicePdf,
		importContractLinesToCustomerInvoice,
		getCustomerInvoicesByProject,
		getSupplierInvoicesByProject,
		getProjectRevenue,
		getProjectPurchaseCost
	};
}

export type FinanceBillingApi = ReturnType<typeof createFinanceBillingApi>;

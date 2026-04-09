import { and, asc, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

import { parseStoredInvoiceLineItems } from '$lib/invoice-line-items';
import { getDb, schema } from '$lib/server/modules/legacy-db';

export const load: PageServerLoad = async ({ platform, url }) => {
	const preselectProjectId = url.searchParams.get('projectId')?.trim() ?? '';
	const invoiceId = url.searchParams.get('invoiceId')?.trim() ?? '';

	if (!platform) {
		return { projects: [] as const, preselectProjectId, editingInvoice: null };
	}

	const db = getDb(platform.env);
	const projects = await db
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
		projectId: string;
		customerId: string;
		invoiceNo: string;
		date: string;
		dueDate: string | null;
		currency: string;
		gstType: 'standard' | 'zero' | 'exempt';
		lines: Array<{ desc: string; qty: number; price: number }>;
		generator: Record<string, unknown> | undefined;
	} = null;

	if (invoiceId) {
		const [invoice] = await db
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
};

import { and, desc, eq, isNull } from 'drizzle-orm';
import { resolveSgdEquivalentForWrite } from '$lib/server/fx/resolve-sgd-equivalent';
import { parseDocumentMetadata } from '$lib/server/document-metadata';
import { resolveExpenseFilePreview } from '$lib/server/expense-file-preview';
import type { ModuleContext } from '../../../lib/server/modules/types';
import { invoicesOut, revenue } from '../../../infrastructure/db/schema';
import { RevenueRepository } from '../repositories';

type FinanceRevenueCreateInput = {
	projectId?: string | null;
	invoiceType: 'standard' | 'zero_rate' | 'tax_invoice';
	invoiceNumber?: string | null;
	clientName?: string | null;
	date: string;
	amount: number;
	currency?: string;
	gstAmount?: number;
	notes?: string | null;
};

export function createFinanceRevenueApi(ctx: ModuleContext) {
	const revenueRepository = new RevenueRepository(ctx.db);

	const getProjectRevenuePage = async (projectId: string) => {
		const revenueRecords = await revenueRepository.findByProject(projectId);

		let invoices: Array<{
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

		try {
			invoices = await ctx.db
				.select({
					id: invoicesOut.id,
					invoiceNo: invoicesOut.invoiceNo,
					date: invoicesOut.date,
					dueDate: invoicesOut.dueDate,
					currency: invoicesOut.currency,
					subtotal: invoicesOut.subtotal,
					gstType: invoicesOut.gstType,
					gstAmount: invoicesOut.gstAmount,
					total: invoicesOut.total,
					status: invoicesOut.status
				})
				.from(invoicesOut)
				.where(and(eq(invoicesOut.projectId, projectId), isNull(invoicesOut.deletedAt)))
				.orderBy(desc(invoicesOut.date));
		} catch {
			invoices = [];
		}

		const revenueTotal = await revenueRepository.getProjectRevenueTotal(projectId);
		return {
			revenueRecords,
			invoices,
			totals: {
				total: revenueTotal,
				revenue: revenueTotal,
				invoiced: revenueTotal
			}
		};
	};

	const createRevenue = async (data: FinanceRevenueCreateInput) => {
		const currency = (data.currency ?? 'SGD').trim().toUpperCase();
		const sgdEquivalent = await resolveSgdEquivalentForWrite({
			amount: data.amount,
			currency,
			dateYmd: data.date
		});

		return revenueRepository.create({
			...data,
			currency,
			sgdEquivalent,
			gstAmount: data.gstAmount ?? 0
		});
	};

	const getProjectRevenueDocumentDetail = async (projectId: string, revenueId: string) => {
		const [revenueRecord] = await ctx.db
			.select()
			.from(revenue)
			.where(
				and(eq(revenue.id, revenueId), eq(revenue.projectId, projectId), isNull(revenue.deletedAt))
			)
			.limit(1);

		if (!revenueRecord) return null;

		const docMeta = parseDocumentMetadata(null);
		const { fileViewUrl, fileDownloadUrl, previewDisplay } = await resolveExpenseFilePreview(
			ctx.db,
			revenueRecord.documentRef,
			docMeta
		);

		return { revenue: revenueRecord, docMeta, fileViewUrl, fileDownloadUrl, previewDisplay };
	};

	return {
		getProjectRevenuePage,
		createRevenue,
		getProjectRevenueDocumentDetail
	};
}

export type FinanceRevenueApi = ReturnType<typeof createFinanceRevenueApi>;

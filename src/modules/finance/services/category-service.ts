import type { ModuleContext } from '$platform/modules/types';
import { AuditService } from '$platform/audit/audit-service';
import {
	ExpenseCategoryRepository,
	type CategoryRow,
	type CreateCategoryInput,
	type UpdateCategoryInput
} from '../repositories/expense-repository';
import { FINANCE_CATEGORY_CATALOG } from '../workflows/financial-document-intake/categories';

// ---------------------------------------------------------------------------
// Singapore SFRS-aligned chart of accounts groupings
// Maps the existing expense/revenue categories into a standard hierarchy.
// ---------------------------------------------------------------------------

const SG_ACCOUNT_GROUPS = [
	{ id: 'sg.revenue', name: 'Revenue', parentId: null },
	{ id: 'sg.cogs', name: 'Cost of Goods Sold', parentId: null },
	{ id: 'sg.opex', name: 'Operating Expenses', parentId: null },
	{ id: 'sg.opex.staff', name: 'Staff Costs', parentId: 'sg.opex' },
	{ id: 'sg.opex.travel', name: 'Travel & Entertainment', parentId: 'sg.opex' },
	{ id: 'sg.opex.admin', name: 'Administrative Expenses', parentId: 'sg.opex' },
	{ id: 'sg.opex.tech', name: 'Technology & Subscriptions', parentId: 'sg.opex' },
	{ id: 'sg.archive', name: 'Document Archive', parentId: null }
] as const;

function mapCategoryToGroup(categoryId: string): string | null {
	if (categoryId.startsWith('revenue.')) return 'sg.revenue';
	if (categoryId.startsWith('document_only.')) return 'sg.archive';
	if (categoryId === 'expense.sales_cost.invoice' || categoryId === 'expense.sales_cost.receipt')
		return 'sg.cogs';
	if (categoryId === 'expense.opex.transport' || categoryId === 'expense.opex.accommodation')
		return 'sg.opex.travel';
	if (categoryId === 'expense.opex.meal' || categoryId === 'expense.opex.gift')
		return 'sg.opex.travel';
	if (categoryId === 'expense.opex.allowance') return 'sg.opex.staff';
	if (categoryId === 'expense.opex.ai_subscription') return 'sg.opex.tech';
	if (
		categoryId === 'expense.opex.logistics' ||
		categoryId === 'expense.opex.purchase' ||
		categoryId === 'expense.opex.others'
	)
		return 'sg.opex.admin';
	return null;
}

export function buildSyncCatalog() {
	const entries: Array<{ id: string; name: string; parentId?: string | null; isSystem: boolean }> =
		[];

	for (const group of SG_ACCOUNT_GROUPS) {
		entries.push({
			id: group.id,
			name: group.name,
			parentId: group.parentId,
			isSystem: true
		});
	}

	for (const cat of FINANCE_CATEGORY_CATALOG) {
		entries.push({
			id: cat.id,
			name: cat.label,
			parentId: mapCategoryToGroup(cat.id),
			isSystem: true
		});
	}

	return entries;
}

export function createCategoryService(ctx: ModuleContext) {
	const repo = new ExpenseCategoryRepository(ctx.db);
	const audit = new AuditService(ctx);

	const list = async () => repo.listAll();
	const getHierarchy = async () => repo.getHierarchy();
	const getById = async (id: string) => repo.findById(id);
	const getChildren = async (parentId: string) => repo.listChildren(parentId);
	const search = async (query: string) => repo.search(query);

	const create = async (input: CreateCategoryInput): Promise<CategoryRow> => {
		if (input.parentId) {
			const parent = await repo.findById(input.parentId);
			if (!parent) throw new Error(`Parent category not found: ${input.parentId}`);
		}

		const row = await repo.create(input);
		await audit.writeLog({
			action: 'category.created',
			entityType: 'expense_category',
			entityId: row.id,
			metadata: { name: row.name, parentId: row.parentId }
		});
		return row;
	};

	const update = async (id: string, input: UpdateCategoryInput): Promise<boolean> => {
		const existing = await repo.findById(id);
		if (!existing) return false;

		if (input.parentId !== undefined && input.parentId !== null) {
			if (input.parentId === id) throw new Error('Category cannot be its own parent');
			const parent = await repo.findById(input.parentId);
			if (!parent) throw new Error(`Parent category not found: ${input.parentId}`);
		}

		const updated = await repo.update(id, input);
		if (updated) {
			await audit.writeLog({
				action: 'category.updated',
				entityType: 'expense_category',
				entityId: id,
				metadata: {
					changes: input,
					previous: { name: existing.name, parentId: existing.parentId }
				}
			});
		}
		return updated;
	};

	const deactivate = async (id: string): Promise<boolean> => {
		const existing = await repo.findById(id);
		if (!existing) return false;
		if (existing.isSystem === 'true') {
			throw new Error('Cannot deactivate system category');
		}

		const children = await repo.listChildren(id);
		if (children.length > 0) {
			throw new Error('Cannot deactivate category with active children');
		}

		const result = await repo.deactivate(id);
		if (result) {
			await audit.writeLog({
				action: 'category.deactivated',
				entityType: 'expense_category',
				entityId: id,
				metadata: { name: existing.name }
			});
		}
		return result;
	};

	const reactivate = async (id: string): Promise<boolean> => {
		const result = await repo.reactivate(id);
		if (result) {
			await audit.writeLog({
				action: 'category.reactivated',
				entityType: 'expense_category',
				entityId: id
			});
		}
		return result;
	};

	const syncFromCatalog = async () => {
		const catalog = buildSyncCatalog();
		const result = await repo.syncFromCatalog(catalog);
		if (result.created > 0 || result.updated > 0) {
			await audit.writeLog({
				action: 'category.catalog_synced',
				entityType: 'expense_category',
				metadata: result
			});
		}
		return result;
	};

	return {
		list,
		getHierarchy,
		getById,
		getChildren,
		search,
		create,
		update,
		deactivate,
		reactivate,
		syncFromCatalog
	};
}

export type CategoryServiceApi = ReturnType<typeof createCategoryService>;

import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '$modules/finance';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { categories } = createFinanceApi(ctx);

		const view = event.url.searchParams.get('view');
		const query = event.url.searchParams.get('q');
		const parentId = event.url.searchParams.get('parentId');

		if (view === 'hierarchy') {
			return ok(await categories.getHierarchy());
		}
		if (query) {
			return ok(await categories.search(query));
		}
		if (parentId) {
			return ok(await categories.getChildren(parentId));
		}
		return ok(await categories.list());
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { categories } = createFinanceApi(ctx);
		const body = await event.request.json() as Record<string, unknown>;

		if (body.action === 'sync') {
			const result = await categories.syncFromCatalog();
			return ok(result);
		}

		if (!body.name || typeof body.name !== 'string') {
			return fail('name is required', 400);
		}

		const row = await categories.create({
			name: body.name as string,
			parentId: (body.parentId as string) ?? null,
			isSystem: false
		});
		return ok(row, 201);
	} catch (e) {
		return fail((e as Error).message, 400);
	}
};

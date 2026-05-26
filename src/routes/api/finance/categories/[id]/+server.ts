import type { RequestHandler } from './$types';
import { createModuleContext } from '$platform/modules';
import { createFinanceApi } from '$modules/finance';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { categories } = createFinanceApi(ctx);
		const row = await categories.getById(event.params.id);
		if (!row) return fail('Category not found', 404);
		return ok(row);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const { categories } = createFinanceApi(ctx);
		const body = await event.request.json();

		if (body.action === 'deactivate') {
			const result = await categories.deactivate(event.params.id);
			if (!result) return fail('Category not found', 404);
			return ok({ deactivated: true });
		}

		if (body.action === 'reactivate') {
			const result = await categories.reactivate(event.params.id);
			if (!result) return fail('Category not found', 404);
			return ok({ reactivated: true });
		}

		const updated = await categories.update(event.params.id, {
			name: body.name,
			parentId: body.parentId
		});
		if (!updated) return fail('Category not found', 404);
		return ok({ updated: true });
	} catch (e) {
		return fail((e as Error).message, 400);
	}
};

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createCoreApi } from '$platform/core';
import { createModuleContext } from '$platform/modules';
import { createProjectApi } from '$modules/project';
import { createFinanceApi } from '$modules/finance';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent } = event;
	await parent();
	if (!platform) {
		throw error(500, 'Cloudflare platform bindings are required');
	}

	const ctx = await createModuleContext(event);
	const { insights } = createFinanceApi(ctx);
	return insights.getProjectFinancialDetail(params.id);
};

export const actions: Actions = {
	update: async (event) => {
		const { params, request, platform, locals } = event;
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const status = String(form.get('status') ?? '');
		const startDate = String(form.get('startDate') ?? '');
		const endDate = String(form.get('endDate') ?? '');
		const description = String(form.get('description') ?? '').trim();

		if (!name) {
			return fail(400, { message: 'Project name cannot be empty.' });
		}

		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);
		await project.update(params.id, {
			name,
			status: status || 'active',
			startDate: startDate || null,
			endDate: endDate || null,
			description: description || null
		});

		await createCoreApi(ctx).writeAuditLog({
			action: 'project.update',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id,
			module: 'project',
			actionType: 'update',
			metadata: { status: status || 'active', name }
		});

		return { ok: true };
	},
	archive: async (event) => {
		const { params, platform, locals } = event;
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);
		await project.update(params.id, { status: 'archived' });

		await createCoreApi(ctx).writeAuditLog({
			action: 'project.archive',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id,
			module: 'project',
			actionType: 'update'
		});

		return { ok: true };
	},
	remove: async (event) => {
		const { params, platform, locals } = event;
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const now = new Date().toISOString();
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);
		await project.update(params.id, { deletedAt: now });

		await createCoreApi(ctx).writeAuditLog({
			action: 'project.remove',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id,
			module: 'project',
			actionType: 'delete'
		});

		throw redirect(303, '/projects');
	}
};


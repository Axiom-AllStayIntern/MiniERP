import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { createModuleContext } from '$lib/server/modules';
import { createProjectApi } from '$lib/server/modules/project/api';
import { createReportingApi } from '$lib/server/modules/reporting/api';

export const load: PageServerLoad = async (event) => {
	const { params, platform, parent } = event;
	await parent();
	if (!platform) {
		throw error(500, 'Cloudflare platform bindings are required');
	}

	const ctx = await createModuleContext(event);
	const reporting = createReportingApi(ctx);
	return reporting.getProjectFinancialDetail(params.id);
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

		await writeAuditLog(platform, locals.user, {
			action: 'project.update',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id,
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

		await writeAuditLog(platform, locals.user, {
			action: 'project.archive',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id
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

		await writeAuditLog(platform, locals.user, {
			action: 'project.remove',
			entityType: 'project',
			entityId: params.id,
			projectId: params.id
		});

		throw redirect(303, '/projects');
	}
};

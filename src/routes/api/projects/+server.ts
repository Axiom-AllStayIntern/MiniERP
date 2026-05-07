import type { RequestHandler } from './$types';

import { createModuleContext } from '$platform/modules';
import { createProjectApi } from '../../../modules/project';
import { fail, ok } from '$platform/http';

export const GET: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);

		const q = event.url.searchParams.get('q') ?? undefined;
		const status = event.url.searchParams.get('status') ?? undefined;

		const projects = await project.list({ q, status });
		return ok(projects);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const ctx = await createModuleContext(event);
		const project = createProjectApi(ctx);

		const body = (await event.request.json()) as {
			businessPartnerId?: string;
			customerId?: string; // legacy alias accepted for backward-compat callers
			name?: string;
			status?: string;
			description?: string;
			startDate?: string;
			endDate?: string;
		};

		const businessPartnerId = body.businessPartnerId ?? body.customerId;
		if (!body.name) {
			return fail('Missing required fields: name');
		}

		const result = await project.create({
			businessPartnerId,
			name: body.name,
			status: body.status,
			description: body.description,
			startDate: body.startDate,
			endDate: body.endDate
		});

		return ok({ id: result.id }, 201);
	} catch (e) {
		return fail((e as Error).message, 500);
	}
};


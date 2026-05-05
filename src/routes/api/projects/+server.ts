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
			customerId?: string;
			name?: string;
			status?: string;
			description?: string;
			startDate?: string;
			endDate?: string;
		};

		if (!body.customerId || !body.name) {
			return fail('Missing required fields: customerId, name');
		}

		const result = await project.create({
			customerId: body.customerId,
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


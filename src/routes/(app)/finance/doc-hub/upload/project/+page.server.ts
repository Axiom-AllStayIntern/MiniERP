import type { PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
import { createProjectApi } from '../../../../../../modules/project';

export const load: PageServerLoad = async (event) => {
	const { platform, url } = event;
	const initialDocType = url.searchParams.get('docType')?.trim() || 'contract';
	const projectIdParam = url.searchParams.get('projectId')?.trim() ?? '';

	let preselectedProject: {
		id: string;
		name: string;
		customerName: string | null;
		status: string;
		startDate: string | null;
		endDate: string | null;
	} | null = null;

	if (platform && projectIdParam) {
		try {
			const ctx = await createModuleContext(event);
			const project = createProjectApi(ctx);
			const row = await project.getWithCustomer(projectIdParam);
			preselectedProject = {
				id: row.project.id,
				name: row.project.name,
				customerName: row.customerName ?? null,
				status: row.project.status,
				startDate: row.project.startDate,
				endDate: row.project.endDate
			};
		} catch {
			preselectedProject = null;
		}
	}

	return {
		platformReady: !!platform,
		initialDocType,
		preselectedProject
	};
};


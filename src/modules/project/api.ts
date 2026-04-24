import type { ModuleContext } from '../../lib/server/modules/types';
import { createProjectLegacySource } from './adapters';
import type { ProjectSource } from './contracts';

export type ProjectApi = ReturnType<typeof createProjectPublicApi>;

export function createProjectPublicApi(source: ProjectSource) {
	return {
		getById: source.getById,
		getWithCustomer: source.getWithCustomer,
		list: source.list,
		getProjectListPage: source.getProjectListPage,
		getListCounts: source.getListCounts,
		getProjectShell: source.getProjectShell,
		create: source.create,
		update: source.update,
		archive: source.archive,
		softDelete: source.softDelete,
		getMembers: source.getMembers,
		addMember: source.addMember,
		removeMember: source.removeMember,
		getProjectFinancials: source.getProjectFinancials
	};
}

export function createProjectApi(ctx: ModuleContext) {
	return createProjectPublicApi(createProjectLegacySource(ctx));
}

import { ProjectService } from '$modules/project/services/legacy-project-service';

type ProjectServiceMethods = InstanceType<typeof ProjectService>;

export interface ProjectSource {
	getById: ProjectServiceMethods['getById'];
	getWithCustomer: ProjectServiceMethods['getWithCustomer'];
	list: ProjectServiceMethods['list'];
	getProjectListPage: ProjectServiceMethods['getProjectListPage'];
	getListCounts: ProjectServiceMethods['getListCounts'];
	getProjectShell: ProjectServiceMethods['getProjectShell'];
	create: ProjectServiceMethods['create'];
	update: ProjectServiceMethods['update'];
	archive: ProjectServiceMethods['archive'];
	softDelete: ProjectServiceMethods['softDelete'];
	getMembers: ProjectServiceMethods['getMembers'];
	addMember: ProjectServiceMethods['addMember'];
	removeMember: ProjectServiceMethods['removeMember'];
	getProjectFinancials: ProjectServiceMethods['getProjectFinancials'];
}

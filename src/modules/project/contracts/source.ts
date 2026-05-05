import { ProjectService } from '$modules/legacy/server-modules/project/service';

type LegacyProjectService = InstanceType<typeof ProjectService>;

export interface ProjectSource {
	getById: LegacyProjectService['getById'];
	getWithCustomer: LegacyProjectService['getWithCustomer'];
	list: LegacyProjectService['list'];
	getProjectListPage: LegacyProjectService['getProjectListPage'];
	getListCounts: LegacyProjectService['getListCounts'];
	getProjectShell: LegacyProjectService['getProjectShell'];
	create: LegacyProjectService['create'];
	update: LegacyProjectService['update'];
	archive: LegacyProjectService['archive'];
	softDelete: LegacyProjectService['softDelete'];
	getMembers: LegacyProjectService['getMembers'];
	addMember: LegacyProjectService['addMember'];
	removeMember: LegacyProjectService['removeMember'];
	getProjectFinancials: LegacyProjectService['getProjectFinancials'];
}

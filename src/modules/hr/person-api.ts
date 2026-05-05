import type { ModuleContext } from '$platform/modules/types';
import { createHrPeopleLegacySource } from './adapters';
import type { HrPeopleSource } from './contracts';

export type PersonApi = ReturnType<typeof createHrPeopleApi>;

export function createHrPeopleApi(source: HrPeopleSource) {
	return {
		getPersonById: source.getPersonById,
		getPersonWithRoles: source.getPersonWithRoles,
		createPerson: source.createPerson,
		updatePerson: source.updatePerson,
		getEmployeeById: source.getEmployeeById,
		updateEmployee: source.updateEmployee,
		softDeleteEmployee: source.softDeleteEmployee
	};
}

export function createPersonApi(ctx: ModuleContext) {
	return createHrPeopleApi(createHrPeopleLegacySource(ctx));
}

import type { PageServerLoad } from './$types';

import { createModuleContext } from '$platform/modules';
import { createEmployeeApi } from '../../../modules/hr';

export const load: PageServerLoad = async (event) => {
	if (!event.platform) {
		return { employees: [] };
	}

	const ctx = await createModuleContext(event);
	const employee = createEmployeeApi(ctx);
	const employees = await employee.listEmployees();

	return { employees };
};


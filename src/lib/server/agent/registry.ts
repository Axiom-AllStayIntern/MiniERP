import type { AgentAction } from '$lib/server/agent/types';
import { arActions } from '$lib/server/modules/ar';
import { employeeActions } from '$lib/server/modules/employee';
import { expenseActions } from '$lib/server/modules/expense';
import { projectActions } from '$lib/server/modules/project';
import { reportingActions } from '$lib/server/modules/reporting';
import { taxActions } from '$lib/server/modules/tax';

const ALL_ACTIONS: AgentAction[] = [
	...arActions,
	...projectActions,
	...expenseActions,
	...taxActions,
	...employeeActions,
	...reportingActions
];

export function getActionsForRole(userRole: AgentAction['required_roles'][number]): AgentAction[] {
	return ALL_ACTIONS.filter((action) => action.required_roles.includes(userRole));
}

export function getActionById(id: string): AgentAction | undefined {
	return ALL_ACTIONS.find((a) => a.id === id);
}

import type { AgentAction } from '../../lib/server/agent/types';
import { arActions } from '../../lib/server/modules/ar';
import { expenseActions } from '../../lib/server/modules/expense';
import { taxActions } from '../../lib/server/modules/tax';
import { reportingActions } from '../../lib/server/modules/reporting';

export interface FinanceAgentActionSets {
	ar: AgentAction[];
	expense: AgentAction[];
	tax: AgentAction[];
	reporting: AgentAction[];
}

export const financeAgentActionSets: FinanceAgentActionSets = {
	ar: arActions,
	expense: expenseActions,
	tax: taxActions,
	reporting: reportingActions
};

export const financeAllAgentActions = [
	...financeAgentActionSets.ar,
	...financeAgentActionSets.expense,
	...financeAgentActionSets.tax,
	...financeAgentActionSets.reporting
];

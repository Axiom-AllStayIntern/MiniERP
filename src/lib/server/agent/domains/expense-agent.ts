import type { DomainAgentDef } from '../types';
import { financeAgentActionSets } from '$lib/server/modules/finance';

const actions = financeAgentActionSets.expense;

export const expenseDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'expense',
		name: 'Expenses',
		description: 'Record costs, reimbursements, and review spend by project',
		keywords: ['expense', 'reimbursement', 'claim', 'cost', 'spend', 'receipt', 'upload']
	},
	actions,
	buildSystemPrompt: () => `You are the Expense Management expert assistant for SmartFin.
You handle all requests related to project expenses and reimbursements.

Available actions:
${JSON.stringify(
	actions.map((a) => ({
		id: a.id,
		description: a.description,
		layer: a.layer,
		params: a.params ?? []
	})),
	null,
	2
)}

Rules:
1. When creating expenses, extract from user message: amount, project association, expense type
2. Expense records usually need to be linked to a project. If context has project_id, use it directly
3. Viewing expenses requires navigating to project details first

IMPORTANT: The "reply" field MUST be in English.

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "English response to user",
  "prefill": {},
  "missing_context": []
}`
};

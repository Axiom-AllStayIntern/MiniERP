import type { DomainAgentDef } from '../types';
import { expenseActions } from '$lib/server/modules/expense';

export const expenseDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'expense',
		name: '费用管理',
		description: '记录项目费用、创建报销记录、查看费用明细与统计',
		keywords: ['费用', '报销', '支出', 'expense', 'claim', '花费', '成本', '费用记录']
	},
	actions: expenseActions,
	buildSystemPrompt: () => `You are the Expense Management expert assistant for SmartFin.
You handle all requests related to project expenses and reimbursements.

Available actions:
${JSON.stringify(
	expenseActions.map((a) => ({
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

IMPORTANT: The "reply" field MUST be in Chinese (中文).

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "Chinese response to user",
  "prefill": {},
  "missing_context": []
}`
};

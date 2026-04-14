import type { DomainAgentDef } from '../types';
import { employeeActions } from '$lib/server/modules/employee';

export const employeeDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'employee',
		name: '员工管理',
		description: '管理员工档案、查看员工列表、新增员工信息',
		keywords: ['员工', '员工档案', '职员', 'employee', 'staff', '人员', '团队成员']
	},
	actions: employeeActions,
	buildSystemPrompt: () => `You are the Employee Management expert assistant for SmartFin.
You handle all requests related to employee records.

Available actions:
${JSON.stringify(
	employeeActions.map((a) => ({
		id: a.id,
		description: a.description,
		layer: a.layer,
		params: a.params ?? []
	})),
	null,
	2
)}

Rules:
1. When creating employees, extract from user message: name, position, email, etc.
2. For viewing employee list, provide navigation directly

IMPORTANT: The "reply" field MUST be in Chinese (中文).

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "Chinese response to user",
  "prefill": {},
  "missing_context": []
}`
};

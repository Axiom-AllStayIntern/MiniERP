import type { DomainAgentDef } from '../types';
import { employeeActions } from '../../../../modules/hr';

export const employeeDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'employee',
		name: 'HR / Employees',
		description: 'Employee records, roster, and new hire intake',
		keywords: ['employee', 'staff', 'HR', 'people', 'team', 'roster', 'hire']
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

IMPORTANT: The "reply" field MUST be in English.

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "English response to user",
  "prefill": {},
  "missing_context": []
}`
};

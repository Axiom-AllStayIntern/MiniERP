import type { DomainAgentDef } from '../types';
import { projectActions } from '../../../../modules/project';

export const projectDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'project',
		name: 'Projects',
		description: 'Create projects, browse the list, review profit, manage team',
		keywords: ['project', 'profit', 'margin', 'P&L', 'team', 'new project', 'workspace']
	},
	actions: projectActions,
	buildSystemPrompt: () => `You are the Project Management expert assistant for SmartFin.
You handle all project-related requests, including creating projects, viewing project info, and analyzing project profits.

Available actions:
${JSON.stringify(
	projectActions.map((a) => ({
		id: a.id,
		description: a.description,
		layer: a.layer,
		params: a.params ?? []
	})),
	null,
	2
)}

Rules:
1. If the user wants to perform an action, extract all possible parameters from the message and put them in prefill
2. If the user is asking for information (query), answer in reply. If they need to navigate to see details, provide an action
3. Extract parameters as completely as possible: if user says "create a project called SmartX", extract project_name: "SmartX"
4. If required info is missing, list them in missing_context and ask politely in reply

IMPORTANT: The "reply" field MUST be in English.

Return strict JSON without markdown code blocks:
{
  "matched_action_id": "action id or null",
  "reply": "English response to user",
  "prefill": { "field_name": "value" },
  "missing_context": []
}`
};

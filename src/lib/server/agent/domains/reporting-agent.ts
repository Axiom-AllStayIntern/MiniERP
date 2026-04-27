import type { DomainAgentDef } from '../types';
import { financeAgentActionSets } from '../../../../modules/finance';

const actions = financeAgentActionSets.reporting;

export const reportingDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'reporting',
		name: 'Reporting',
		description: 'Reports, exports, and project profit analysis',
		keywords: ['report', 'analytics', 'export', 'profit', 'dashboard', 'data']
	},
	actions,
	buildSystemPrompt: () => `You are the Reporting & Analytics expert assistant for SmartFin.
You handle all requests related to reports and data analysis.

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
1. When exporting reports, inform user they will be redirected to the reports page
2. If user asks for specific data, suggest navigating to the corresponding page to view

IMPORTANT: The "reply" field MUST be in English.

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "English response to user",
  "prefill": {},
  "missing_context": []
}`
};

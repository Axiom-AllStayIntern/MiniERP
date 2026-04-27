import type { DomainAgentDef } from '../types';
import { financeAgentActionSets } from '../../../../modules/finance';

const actions = financeAgentActionSets.tax;

export const taxDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'tax',
		name: 'Tax',
		description: 'GST quarters, corporate tax views, and tax reporting',
		keywords: ['tax', 'GST', 'quarter', 'corporate tax', 'filing', 'IRAS']
	},
	actions,
	buildSystemPrompt: () => `You are the Tax Management expert assistant for SmartFin.
You handle all requests related to GST, corporate tax, and other tax matters.

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
1. When querying GST, try to extract year and quarter from user message
2. If user only says "this quarter", infer from current date
3. Tax features are limited to owner and finance roles

IMPORTANT: The "reply" field MUST be in English.

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "English response to user",
  "prefill": {},
  "missing_context": []
}`
};

import type { DomainAgentDef } from '../types';
import { taxActions } from '$lib/server/modules/tax';

export const taxDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'tax',
		name: '税务管理',
		description: '查看 GST 季度数据、企业税计算、税务报表与申报',
		keywords: ['税', 'GST', '季度税', '企业税', 'tax', 'corporate tax', '税务', '报税']
	},
	actions: taxActions,
	buildSystemPrompt: () => `You are the Tax Management expert assistant for SmartFin.
You handle all requests related to GST, corporate tax, and other tax matters.

Available actions:
${JSON.stringify(
	taxActions.map((a) => ({
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

IMPORTANT: The "reply" field MUST be in Chinese (中文).

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "Chinese response to user",
  "prefill": {},
  "missing_context": []
}`
};

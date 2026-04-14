import type { DomainAgentDef } from '../types';
import { reportingActions } from '$lib/server/modules/reporting';

export const reportingDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'reporting',
		name: '报表分析',
		description: '查看报表、导出项目利润报表、数据分析与可视化',
		keywords: ['报表', '报告', '分析', 'report', 'analytics', '导出', '统计', '数据']
	},
	actions: reportingActions,
	buildSystemPrompt: () => `You are the Reporting & Analytics expert assistant for SmartFin.
You handle all requests related to reports and data analysis.

Available actions:
${JSON.stringify(
	reportingActions.map((a) => ({
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

IMPORTANT: The "reply" field MUST be in Chinese (中文).

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "Chinese response to user",
  "prefill": {},
  "missing_context": []
}`
};

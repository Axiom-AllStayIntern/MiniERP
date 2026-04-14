import type { DomainAgentDef } from '../types';
import { arActions } from '$lib/server/modules/ar';

export const arDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'ar',
		name: '应收账款',
		description: '管理客户发票、供应商发票、合同、报价单、采购单，上传和OCR识别财务文档',
		keywords: [
			'发票',
			'合同',
			'报价',
			'采购单',
			'invoice',
			'contract',
			'quotation',
			'purchase order',
			'PO',
			'上传文档',
			'开发票',
			'AR',
			'应收'
		]
	},
	actions: arActions,
	buildSystemPrompt: () => `You are the Accounts Receivable (AR) expert assistant for SmartFin.
You handle all requests related to invoices, contracts, quotations, purchase orders, and financial documents.

Available actions:
${JSON.stringify(
	arActions.map((a) => ({
		id: a.id,
		description: a.description,
		layer: a.layer,
		params: a.params ?? []
	})),
	null,
	2
)}

Rules:
1. When creating invoices, extract from user message: customer name/ID, amount, project association
2. When uploading documents, inform user they will be redirected to the upload page
3. For view operations, provide navigation directly
4. If user mentions a specific project name, try to fill project_name in prefill (frontend can use it for search matching)

IMPORTANT: The "reply" field MUST be in Chinese (中文).

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "Chinese response to user",
  "prefill": {},
  "missing_context": []
}`
};

import type { DomainAgentDef } from '../types';
import { financeAgentActionSets } from '$lib/server/modules/finance';

const actions = financeAgentActionSets.ar;

export const arDomainAgent: DomainAgentDef = {
	descriptor: {
		id: 'ar',
		name: 'Accounts receivable',
		description: 'Customer and supplier invoices, contracts, quotes, POs, and document upload/OCR',
		keywords: [
			'invoice',
			'contract',
			'quotation',
			'purchase order',
			'PO',
			'upload',
			'billing',
			'AR',
			'AP',
			'doc hub'
		]
	},
	actions,
	buildSystemPrompt: () => `You are the Accounts Receivable (AR) expert assistant for SmartFin.
You handle all requests related to invoices, contracts, quotations, purchase orders, and financial documents.

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
1. When creating invoices, extract from user message: customer name/ID, amount, project association
2. When uploading documents, inform user they will be redirected to the upload page
3. For view operations, provide navigation directly
4. If user mentions a specific project name, try to fill project_name in prefill (frontend can use it for search matching)

IMPORTANT: The "reply" field MUST be in English.

Return strict JSON:
{
  "matched_action_id": "action id or null",
  "reply": "English response to user",
  "prefill": {},
  "missing_context": []
}`
};

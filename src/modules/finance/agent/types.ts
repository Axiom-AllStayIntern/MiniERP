export type FinanceIntent =
	| 'record_supplier_invoice'
	| 'record_expense'
	| 'record_receipt'
	| 'record_allowance'
	| 'record_revenue'
	| 'query_expense_summary'
	| 'query_revenue_summary'
	| 'query_profit_summary'
	| 'prepare_gst_review'
	| 'explain_finance_record'
	| 'detect_possible_duplicate'
	| 'suggest_next_finance_task'
	| 'unknown';

export type FinanceOwnedDomain =
	| 'expense'
	| 'revenue'
	| 'supplier_invoice'
	| 'customer_invoice'
	| 'receipt'
	| 'gst_summary'
	| 'profit_summary'
	| 'finance_task';

export type FinanceForbiddenAction =
	| 'delete_record'
	| 'execute_payment'
	| 'submit_tax_return'
	| 'change_permission'
	| 'change_bank_account'
	| 'bypass_workflow'
	| 'bypass_validation';

export type FinanceRiskLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export type FinanceAgentStatus =
	| 'answered'
	| 'workflow_started'
	| 'workflow_resumed'
	| 'needs_user_input'
	| 'needs_manual_review'
	| 'permission_denied'
	| 'failed';

export type FinanceAgentActionType =
	| 'start_workflow'
	| 'resume_workflow'
	| 'call_capability'
	| 'ask_user_confirmation'
	| 'create_draft'
	| 'confirmed_write'
	| 'open_main_workspace'
	| 'show_review_panel';

export type FinanceEvidenceType =
	| 'document_text'
	| 'ocr_result'
	| 'extracted_field'
	| 'matched_record'
	| 'user_confirmation'
	| 'validation_rule'
	| 'system_record';

export interface FinanceAgentRequest {
	userId: string;
	tenantId: string;
	message?: string;
	intentHint?: FinanceIntent;
	activeWorkflowId?: string;
	documentId?: string;
	contextRefs?: {
		projectId?: string;
		employeeId?: string;
		supplierId?: string;
		poId?: string;
	};
}

export interface FinanceIntentResult {
	intent: FinanceIntent;
	confidence: number;
	reason: string;
	requiredInputs: string[];
	suggestedWorkflow: string | null;
	riskLevel: FinanceRiskLevel;
}

export interface FinanceAgentAction {
	id: string;
	type: FinanceAgentActionType;
	label: string;
	riskLevel: FinanceRiskLevel;
	requiresConfirmation: boolean;
	payload?: unknown;
}

export interface FinanceEvidence {
	type: FinanceEvidenceType;
	refId: string;
	summary: string;
}

export interface FinanceAgentResponse {
	status: FinanceAgentStatus;
	message: string;
	workflowId?: string;
	workflowStep?: string;
	result?: unknown;
	actions?: FinanceAgentAction[];
	evidence?: FinanceEvidence[];
	auditRef?: string;
}

export interface FinanceValidationIssue {
	field: string;
	message: string;
	code?: string;
}

export interface FinanceUserDecisionRequest {
	prompt: string;
	options: Array<{ id: string; label: string }>;
	expectedShape?: 'single_choice' | 'free_text' | 'confirm_cancel';
}

export interface FinanceAgentState {
	activeWorkflowId?: string;
	activeIntent?: FinanceIntent;
	activeDocumentId?: string;
	extractedFields?: Record<string, unknown>;
	candidateMatches?: {
		supplier?: unknown[];
		po?: unknown[];
		project?: unknown[];
		employee?: unknown[];
	};
	validationIssues?: FinanceValidationIssue[];
	pendingUserDecision?: FinanceUserDecisionRequest;
	lastAgentAction?: string;
}

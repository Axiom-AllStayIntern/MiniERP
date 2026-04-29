import type { WorkflowDefinition, WorkflowId } from './types';

/**
 * Workflow registry. Phase 1B holds a single workflow — document-intake —
 * which covers all five paths (revenue / expense invoice / expense receipt /
 * contract / PO or quotation archive) behind one bubble flow.
 *
 * The five paths share the same shape: drop → read → confirm bucket →
 * confirm fields → save. Classification decides which fields render in
 * step 4 and which save endpoint step 5 calls.
 */

const registry = new Map<WorkflowId, WorkflowDefinition>();

export function registerWorkflow(def: WorkflowDefinition): void {
	registry.set(def.id, def);
}

export function getWorkflow(id: WorkflowId): WorkflowDefinition | undefined {
	return registry.get(id);
}

export function listWorkflows(): WorkflowDefinition[] {
	return Array.from(registry.values());
}

registerWorkflow({
	id: 'document-intake',
	title: 'Record a document',
	shortTitle: 'Intake',
	description: 'Drop anything — invoice, receipt, contract. I read it, classify, and file it correctly.',
	entryLabel: 'Record',
	icon: 'upload-cloud',
	steps: [
		{ id: 'upload', label: 'Drop file', hint: 'PDF, photo, or email' },
		{ id: 'read', label: 'I read it', hint: 'OCR + classify' },
		{ id: 'bucket', label: 'Where?', hint: 'Revenue / Expense / Archive' },
		{ id: 'kind', label: 'What kind?', hint: 'Invoice, receipt, transport…' },
		{ id: 'project', label: 'Which project?', hint: 'Or company overhead' },
		{ id: 'review', label: 'Review & save', hint: 'Check, fix, commit' }
	]
});

/**
 * Vendor invoice intake — the Phase 1 reference flow for the Finance Agent.
 * Steps map onto the server-side workflow definition in
 * `src/modules/finance/workflows/vendor-invoice-intake/definition.ts`:
 *   client 0 → server document_intake
 *   client 1 → server invoice_field_extraction
 *   client 2 → display extraction (no server call)
 *   client 3 → server matching
 *   client 4 → server user_confirmation
 *   client 5 → server record_creation + completion (Stage 5)
 */
registerWorkflow({
	id: 'vendor-invoice-intake',
	title: 'Record supplier invoice',
	shortTitle: 'Invoice',
	description:
		'Drop a supplier invoice — I extract the fields, match the PO, and prep a record for your confirmation.',
	entryLabel: 'Record invoice',
	icon: 'receipt',
	steps: [
		{ id: 'drop', label: 'Drop file', hint: 'PDF or photo' },
		{ id: 'extract', label: 'Extract', hint: 'Mock fields' },
		{ id: 'review-fields', label: 'Review fields', hint: 'Confidence + edit' },
		{ id: 'match', label: 'Match PO', hint: 'Supplier + PO + duplicate' },
		{ id: 'confirm', label: 'Confirm', hint: 'Final summary' },
		{ id: 'done', label: 'Done', hint: 'Recorded' }
	]
});

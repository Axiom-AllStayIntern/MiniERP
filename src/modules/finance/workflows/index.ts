import { expenseRecordingWorkflow } from './expense-recording';
import { financeDocumentIntakeWorkflow } from './finance-document-intake';
import { vendorInvoiceIntakeWorkflow } from './vendor-invoice-intake';

export const financeWorkflows = [
	financeDocumentIntakeWorkflow,
	vendorInvoiceIntakeWorkflow,
	expenseRecordingWorkflow
] as const;

export const financeWorkflowIds = financeWorkflows.map((workflow) => workflow.id);

import type {
	EventContract,
	FailureSemantics,
	InboundContract,
	OutboundContract
} from '$platform/registry/contracts';
import type { OcrQueueMessage } from '$platform/ai/ocr/types';

export type DocumentIntakeBucket = 'revenue' | 'expense' | 'document_only';
export type DocumentIntakeReferenceDocType = 'contract' | 'po' | 'bom' | 'quotation' | 'other';
export type DocumentIntakeDocHubType = 'contract' | 'quotation' | 'purchase_order';
export type DocumentIntakeExpenseType = 'opex' | 'sales_cost';
export type DocumentIntakeCategoryDocType = 'invoice' | 'receipt' | 'po';

export interface DocumentStatusView {
	documentId: string;
	ocrStatus: string | null;
	ocrResult: unknown;
	ocrConfidence: number | null;
	docType: string | null;
	purpose: string | null;
	expenseId: string | null;
	updatedAt: string | null;
}

export interface SupplierInvoiceOcrStatusView {
	id: string;
	status: string | null;
	confidence: number | null;
	result: unknown;
}

export interface ConfirmSupplierInvoiceOcrInput {
	supplierName?: string;
	invoiceDate?: string;
	amount?: number;
	currency?: string;
	gstAmount?: number;
	dueDate?: string;
	poNumber?: string;
}

export interface UploadReferenceDocumentInput {
	key: string;
	fileName: string;
	fileType: string;
	projectId: string;
	docType: DocumentIntakeReferenceDocType;
	notes?: string | null;
	triggerOcr?: boolean;
	uploadedBy?: string | null;
}

export interface ConfirmUploadedObjectInput {
	key: string;
	fileType: string;
	projectId: string;
	entityType: OcrQueueMessage['entityType'];
	entityId?: string;
	triggerOcr?: boolean;
	skipObjectCheck?: boolean;
}

export interface SaveDocHubUploadInput {
	key?: string;
	fileName?: string;
	fileType?: string;
	projectId?: string | null;
	docType?: DocumentIntakeDocHubType;
	status?: string | null;
	notes?: string | null;
	extracted?: Record<string, unknown> | null;
	uploadedBy?: string | null;
}

export interface SavePanelIntakeInput {
	fileKey?: string;
	fileName?: string;
	fileType?: string;
	bucket?: DocumentIntakeBucket;
	docType?: string;
	category?: string | null;
	expenseType?: DocumentIntakeExpenseType | null;
	categoryDocType?: DocumentIntakeCategoryDocType | null;
	fields?: Record<string, unknown>;
	projectId?: string | null;
	uploadedBy?: string | null;
}

export interface DocumentIntakeFailureResult {
	ok: false;
	status: number;
	message: string;
}

export interface DocumentIntakeSuccessResult {
	ok: true;
	status?: string;
	message?: string;
	documentId?: string;
	entityId?: string | null;
	entityType?: string | null;
}

export type DocumentIntakeCommandResult =
	| DocumentIntakeSuccessResult
	| DocumentIntakeFailureResult;

export interface DocumentIntakeSource {
	getDocumentStatus(documentId: string): Promise<DocumentStatusView | null>;
	uploadReferenceDocument(input: UploadReferenceDocumentInput): Promise<DocumentIntakeCommandResult>;
	saveDocHubUpload(input: SaveDocHubUploadInput): Promise<DocumentIntakeCommandResult>;
	savePanelIntake(input: SavePanelIntakeInput): Promise<DocumentIntakeCommandResult>;
}

export const DOCUMENT_INTAKE_FAILURE_CODES = [
	'unavailable',
	'timeout',
	'not_found',
	'permission_denied',
	'invalid_response'
] as const satisfies readonly FailureSemantics[];

export const documentIntakeInboundContracts: InboundContract[] = [
	{
		id: 'document-intake.status',
		description: 'Query document OCR and intake status',
		mode: 'sync',
		input: { name: 'document-status-query', version: 'v1' },
		output: { name: 'document-status-view', version: 'v1' },
		requiredPermissions: ['finance:view']
	},
	{
		id: 'document-intake.upload',
		description: 'Confirm uploaded files and store document intake records',
		mode: 'sync',
		input: { name: 'document-upload-confirmation', version: 'v1' },
		output: { name: 'document-intake-command-result', version: 'v1' },
		requiredPermissions: ['finance:edit']
	},
	{
		id: 'document-intake.pipeline',
		description: 'Classify, extract, and save AI-panel intake results',
		mode: 'sync',
		input: { name: 'document-intake-pipeline-input', version: 'v1' },
		output: { name: 'document-intake-command-result', version: 'v1' },
		requiredPermissions: ['finance:edit']
	}
];

export const documentIntakeOutboundContracts: OutboundContract[] = [
	{
		id: 'document-intake.file_storage',
		provider: 'platform',
		providerId: 'files',
		strength: 'strong',
		description: 'Uploaded document object existence and storage access',
		failurePolicy: 'block',
		failures: ['not_found', 'unavailable', 'timeout']
	},
	{
		id: 'document-intake.ocr_queue',
		provider: 'platform',
		providerId: 'workflow',
		strength: 'weak',
		description: 'Optional asynchronous OCR queue dispatch',
		failurePolicy: 'retry',
		failures: ['unavailable', 'timeout']
	},
	{
		id: 'document-intake.finance_recording',
		provider: 'module',
		providerId: 'finance',
		strength: 'weak',
		description: 'Optional handoff from intake result to finance record creation',
		failurePolicy: 'block',
		failures: ['not_found', 'permission_denied', 'unavailable', 'invalid_response']
	},
	{
		id: 'document-intake.project_lookup',
		provider: 'module',
		providerId: 'project',
		strength: 'weak',
		description: 'Project match suggestions for extracted document text',
		failurePolicy: 'degrade',
		failures: ['not_found', 'unavailable', 'timeout']
	}
];

export const documentIntakeEventContracts: EventContract[] = [
	{
		type: 'document-intake.document.received',
		payload: { name: 'document-intake-received-event', version: 'v1' },
		emittedWhen: 'A document upload is accepted by the intake module',
		retryable: true
	},
	{
		type: 'document-intake.document.classified',
		payload: { name: 'document-intake-classified-event', version: 'v1' },
		emittedWhen: 'A document classification result is produced',
		retryable: true
	},
	{
		type: 'document-intake.document.failed',
		payload: { name: 'document-intake-failed-event', version: 'v1' },
		emittedWhen: 'Document extraction or classification cannot complete',
		retryable: false
	}
];

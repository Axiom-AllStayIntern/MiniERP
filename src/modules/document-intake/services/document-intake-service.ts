import type { DBClient } from '../../../infrastructure/db';
import { appendAgentAuditEntry } from '../../../platform/audit/audit-log';
import {
	buildArtifactStorageKey,
	createFileService,
	type FileServiceContract,
	type StoredFileRef
} from '../../../platform/files/file-service';
import { extractTextFromBlob } from '../../../platform/ai/text-extraction';
import { classifyDocumentCapability } from '../capabilities/classify-document';
import { DocumentArtifactRepository } from '../repositories/document-artifact-repository';
import type {
	DocumentArtifact,
	DocumentClassificationResult,
	DocumentProcessingStatus,
	TextExtractionResult
} from '../schemas/document-artifact.schema';

export const DOCUMENT_INTAKE_AGENT_ID = 'document-intake';
const DOCUMENT_INTAKE_VERSION = '0.1.0';
const MIN_CLASSIFICATION_CONFIDENCE = 0.5;

const SUPPORTED_MIME_PATTERNS = [
	/^application\/pdf$/i,
	/^image\//i,
	/^application\/zip$/i // tolerate, but extraction will mark it failed
];

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface DocumentIntakeServiceContext {
	db: DBClient;
	env: Env;
	user?: App.Locals['user'];
}

export interface CreateDocumentFromUploadInput {
	tenantId?: string;
	uploadedBy: string;
	uploadedFrom?: 'ai_panel' | 'finance_workspace' | 'task_mode';
	fileName: string;
	mimeType: string;
	body: ArrayBuffer | Uint8Array;
	sizeBytes?: number;
}

export interface ProcessDocumentInput {
	tenantId?: string;
	documentId: string;
	mode?: 'sync';
	useMock?: boolean;
}

export interface DocumentArtifactView {
	id: string;
	tenantId: string;
	source: DocumentArtifact['source'];
	processingStatus: DocumentProcessingStatus;
	documentType?: DocumentArtifact['documentType'];
	originalFile: {
		fileId: string;
		fileName: string;
		mimeType: string;
		sizeBytes: number;
		// storageRef intentionally omitted
	};
	textExtraction?: {
		method: TextExtractionResult['method'];
		status: TextExtractionResult['status'];
		confidence?: number;
		language?: string;
		provider?: string;
		// raw `text` intentionally omitted from the view-model
		error?: TextExtractionResult['error'];
	};
	classification?: DocumentClassificationResult;
	securityFlags?: DocumentArtifact['securityFlags'];
	createdAt: string;
	updatedAt: string;
}

function toView(artifact: DocumentArtifact): DocumentArtifactView {
	return {
		id: artifact.id,
		tenantId: artifact.tenantId,
		source: artifact.source,
		processingStatus: artifact.processingStatus,
		documentType: artifact.documentType,
		originalFile: {
			fileId: artifact.originalFile.fileId,
			fileName: artifact.originalFile.fileName,
			mimeType: artifact.originalFile.mimeType,
			sizeBytes: artifact.originalFile.sizeBytes
		},
		textExtraction: artifact.textExtraction
			? {
					method: artifact.textExtraction.method,
					status: artifact.textExtraction.status,
					confidence: artifact.textExtraction.confidence,
					language: artifact.textExtraction.language,
					provider: artifact.textExtraction.provider,
					error: artifact.textExtraction.error
				}
			: undefined,
		classification: artifact.classification,
		securityFlags: artifact.securityFlags,
		createdAt: artifact.createdAt,
		updatedAt: artifact.updatedAt
	};
}

export interface DocumentIntakeService {
	createDocumentFromUpload(
		input: CreateDocumentFromUploadInput
	): Promise<DocumentArtifact>;
	processDocument(input: ProcessDocumentInput): Promise<DocumentArtifact>;
	getDocumentArtifact(input: {
		tenantId?: string;
		documentId: string;
	}): Promise<DocumentArtifact | null>;
	toView: typeof toView;
}

export interface CreateServiceOptions {
	repo?: DocumentArtifactRepository;
	fileService?: FileServiceContract;
}

export function createDocumentIntakeService(
	ctx: DocumentIntakeServiceContext,
	opts: CreateServiceOptions = {}
): DocumentIntakeService {
	const repo = opts.repo ?? new DocumentArtifactRepository(ctx.db);
	const fileService = opts.fileService ?? createFileService(ctx.env);

	async function audit(
		artifact: { id: string; tenantId: string; processingStatus?: DocumentProcessingStatus },
		event: string,
		status: 'ok' | 'failed' | 'denied' = 'ok',
		extra?: { errorCode?: string; outputRefs?: unknown }
	) {
		await appendAgentAuditEntry(ctx.db, {
			agentId: DOCUMENT_INTAKE_AGENT_ID,
			agentVersion: DOCUMENT_INTAKE_VERSION,
			userId: ctx.user?.id ?? null,
			userEmail: ctx.user?.email ?? null,
			tenantId: artifact.tenantId,
			workflowId: artifact.id,
			workflowStep: artifact.processingStatus,
			riskLevel: 'R1',
			permissionResult: 'allowed',
			confirmationRequired: false,
			finalAction: event,
			status,
			errorCode: extra?.errorCode,
			outputRefs: extra?.outputRefs
		});
	}

	function validateFile(input: CreateDocumentFromUploadInput) {
		const bodyLength =
			input.body instanceof Uint8Array
				? input.body.byteLength
				: input.body.byteLength;
		const size = input.sizeBytes ?? bodyLength;
		if (size <= 0) throw new Error('File body is empty.');
		if (size > MAX_FILE_BYTES) {
			throw new Error(`File too large (${size} bytes, max ${MAX_FILE_BYTES}).`);
		}
		const mimeOk = SUPPORTED_MIME_PATTERNS.some((re) => re.test(input.mimeType));
		if (!mimeOk) {
			throw new Error(`Unsupported file type: ${input.mimeType || 'unknown'}.`);
		}
		return size;
	}

	async function createDocumentFromUpload(
		input: CreateDocumentFromUploadInput
	): Promise<DocumentArtifact> {
		const tenantId = input.tenantId ?? 'default';
		const sizeBytes = validateFile(input);

		const id = crypto.randomUUID();
		const storageKey = buildArtifactStorageKey({
			tenantId,
			fileName: input.fileName,
			artifactId: id
		});

		let stored: StoredFileRef;
		try {
			stored = await fileService.putBlob({
				key: storageKey,
				body: input.body,
				contentType: input.mimeType
			});
		} catch (err) {
			throw new Error(
				`File storage failed: ${err instanceof Error ? err.message : 'unknown error'}`
			);
		}

		const artifact = await repo.create({
			id,
			tenantId,
			source: 'manual_upload',
			sourceMetadata: {
				manualUpload: {
					uploadedBy: input.uploadedBy,
					uploadedFrom: input.uploadedFrom ?? 'ai_panel'
				}
			},
			processingStatus: 'stored',
			originalFile: {
				fileId: id,
				fileName: input.fileName,
				mimeType: input.mimeType,
				sizeBytes: stored.sizeBytes,
				storageRef: stored.key,
				checksum: stored.checksum
			},
			securityFlags: ['untrusted_external_content']
		});

		await audit(artifact, 'document.received');
		await audit(artifact, 'document.stored');
		return artifact;
	}

	async function processDocument(
		input: ProcessDocumentInput
	): Promise<DocumentArtifact> {
		const tenantId = input.tenantId ?? 'default';
		const artifact = await repo.findById(input.documentId, tenantId);
		if (!artifact) {
			throw new Error(`Document artifact not found: ${input.documentId}`);
		}

		if (artifact.processingStatus !== 'stored' &&
			artifact.processingStatus !== 'received' &&
			artifact.processingStatus !== 'needs_manual_review' &&
			artifact.processingStatus !== 'failed') {
			// Already further along; don't re-run.
			return artifact;
		}

		try {
			await repo.setStatus(artifact.id, 'text_extraction_pending');

			const useMock = input.useMock ?? !ctx.env.AI;
			const extraction = await extractTextFromBlob({
				fileRef: {
					key: artifact.originalFile.storageRef,
					mimeType: artifact.originalFile.mimeType,
					fileName: artifact.originalFile.fileName,
					sizeBytes: artifact.originalFile.sizeBytes
				},
				fileService,
				env: ctx.env,
				useMock
			});
			await repo.setTextExtraction(artifact.id, extraction);

			if (extraction.status === 'failed') {
				await repo.setStatus(artifact.id, 'failed');
				const failed = await repo.findById(artifact.id, tenantId);
				await audit(failed!, 'document.failed', 'failed', {
					errorCode: extraction.error?.code ?? 'extraction_failed'
				});
				return failed!;
			}

			if (extraction.status === 'partial' || !extraction.text) {
				await repo.addSecurityFlag(artifact.id, 'low_ocr_confidence');
				await repo.setStatus(artifact.id, 'needs_manual_review');
				const partial = await repo.findById(artifact.id, tenantId);
				await audit(partial!, 'document.needs_manual_review', 'failed', {
					errorCode: extraction.error?.code ?? 'low_text_yield'
				});
				return partial!;
			}

			await repo.setStatus(artifact.id, 'text_extracted');
			const afterText = await repo.findById(artifact.id, tenantId);
			await audit(afterText!, 'document.text_extracted', 'ok', {
				outputRefs: {
					method: extraction.method,
					confidence: extraction.confidence,
					provider: extraction.provider
				}
			});

			await repo.setStatus(artifact.id, 'classification_pending');
			const classification = await classifyDocumentCapability.execute(
				{
					text: extraction.text,
					fileName: artifact.originalFile.fileName,
					mimeType: artifact.originalFile.mimeType
				},
				{ tenantId, userId: ctx.user?.id, useMock: true }
			);
			await repo.setClassification(artifact.id, classification);

			const afterClass = await repo.findById(artifact.id, tenantId);
			await audit(afterClass!, 'document.classified', 'ok', {
				outputRefs: {
					documentType: classification.documentType,
					confidence: classification.confidence
				}
			});

			if (classification.confidence < MIN_CLASSIFICATION_CONFIDENCE) {
				await repo.addSecurityFlag(artifact.id, 'low_ocr_confidence');
				await repo.setStatus(artifact.id, 'needs_manual_review');
				const review = await repo.findById(artifact.id, tenantId);
				await audit(review!, 'document.needs_manual_review', 'failed', {
					errorCode: 'low_classification_confidence'
				});
				return review!;
			}

			await repo.setStatus(artifact.id, 'ready_for_workflow');
			const ready = await repo.findById(artifact.id, tenantId);
			await audit(ready!, 'document.ready_for_workflow');
			return ready!;
		} catch (err) {
			await repo.setStatus(artifact.id, 'failed');
			const failed = await repo.findById(artifact.id, tenantId);
			await audit(failed!, 'document.failed', 'failed', {
				errorCode: 'processing_exception'
			});
			throw err;
		}
	}

	async function getDocumentArtifact(input: {
		tenantId?: string;
		documentId: string;
	}): Promise<DocumentArtifact | null> {
		return repo.findById(input.documentId, input.tenantId ?? 'default');
	}

	return { createDocumentFromUpload, processDocument, getDocumentArtifact, toView };
}

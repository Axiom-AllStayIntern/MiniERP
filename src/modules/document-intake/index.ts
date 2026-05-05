import type { ModuleDefinition } from '$platform/modules/types';
import { registerDocumentIntakeHandlers } from './handlers';

export const documentIntakeModule: ModuleDefinition = {
	manifest: {
		id: 'document-intake',
		name: 'Document Intake',
		layer: 'feature',
		dependencies: ['core', 'ar', 'expense']
	},
	registerHandlers: registerDocumentIntakeHandlers
};

export { createDocumentIntakeApi, type DocumentIntakeApi } from './api';
export type { DocumentIntakeSource } from './contracts';

// --- Document Artifact public surface (Phase 2 onwards) ---
export {
	createDocumentIntakeService,
	type DocumentIntakeService,
	type DocumentIntakeServiceContext,
	type CreateDocumentFromUploadInput,
	type ProcessDocumentInput,
	type DocumentArtifactView,
	DOCUMENT_INTAKE_AGENT_ID
} from './services/document-intake-service';
export {
	classifyDocumentCapability,
	type ClassifyDocumentInput,
	type ClassifyDocumentOutput
} from './capabilities/classify-document';
export {
	DocumentArtifactRepository,
	type CreateDocumentArtifactInput
} from './repositories/document-artifact-repository';
export { documentArtifacts } from './repositories/document-artifact.schema';
export {
	documentArtifactSchema,
	documentSourceSchema,
	documentTypeSchema,
	documentProcessingStatusSchema,
	documentSecurityFlagSchema,
	documentClassificationResultSchema,
	textExtractionResultSchema,
	originalFileMetaSchema,
	documentSourceMetadataSchema
} from './schemas/document-artifact.schema';
export type {
	DocumentArtifact,
	DocumentSource,
	DocumentType,
	DocumentProcessingStatus,
	DocumentSecurityFlag,
	DocumentClassificationResult,
	TextExtractionResult,
	OriginalFileMeta,
	DocumentSourceMetadata
} from './schemas/document-artifact.schema';

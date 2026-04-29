import { and, eq } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import type {
	DocumentArtifact,
	DocumentClassificationResult,
	DocumentProcessingStatus,
	DocumentSecurityFlag,
	DocumentSource,
	DocumentSourceMetadata,
	DocumentType,
	OriginalFileMeta,
	TextExtractionResult
} from '../schemas/document-artifact.schema';
import { documentArtifacts } from './document-artifact.schema';

export interface CreateDocumentArtifactInput {
	id?: string;
	tenantId: string;
	source: DocumentSource;
	originalFile: OriginalFileMeta;
	sourceMetadata?: DocumentSourceMetadata;
	documentType?: DocumentType;
	processingStatus?: DocumentProcessingStatus;
	textExtraction?: TextExtractionResult;
	classification?: DocumentClassificationResult;
	normalizedMetadata?: Record<string, unknown>;
	securityFlags?: DocumentSecurityFlag[];
}

function nowIso(): string {
	return new Date().toISOString();
}

function toJsonOrNull<T>(value: T | undefined): string | null {
	return value === undefined ? null : JSON.stringify(value);
}

function fromJson<T>(value: string | null): T | undefined {
	if (value === null || value === undefined) return undefined;
	try {
		return JSON.parse(value) as T;
	} catch {
		return undefined;
	}
}

interface DocumentArtifactRow {
	id: string;
	tenantId: string;
	source: DocumentSource;
	processingStatus: DocumentProcessingStatus;
	documentType: DocumentType | null;
	originalFile: string;
	sourceMetadata: string | null;
	textExtraction: string | null;
	classification: string | null;
	normalizedMetadata: string | null;
	securityFlags: string | null;
	sizeBytes: number | null;
	createdAt: string;
	updatedAt: string;
}

function rowToArtifact(row: DocumentArtifactRow): DocumentArtifact {
	const originalFile = fromJson<OriginalFileMeta>(row.originalFile);
	if (!originalFile) {
		throw new Error(`Document artifact ${row.id} has invalid originalFile JSON`);
	}
	return {
		id: row.id,
		tenantId: row.tenantId,
		source: row.source,
		processingStatus: row.processingStatus,
		documentType: row.documentType ?? undefined,
		originalFile,
		sourceMetadata: fromJson<DocumentSourceMetadata>(row.sourceMetadata),
		textExtraction: fromJson<TextExtractionResult>(row.textExtraction),
		classification: fromJson<DocumentClassificationResult>(row.classification),
		normalizedMetadata: fromJson<Record<string, unknown>>(row.normalizedMetadata),
		securityFlags: fromJson<DocumentSecurityFlag[]>(row.securityFlags),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export class DocumentArtifactRepository {
	constructor(private db: DBClient) {}

	async create(input: CreateDocumentArtifactInput): Promise<DocumentArtifact> {
		const id = input.id ?? crypto.randomUUID();
		const now = nowIso();
		const row = {
			id,
			tenantId: input.tenantId,
			source: input.source,
			processingStatus: input.processingStatus ?? ('received' as const),
			documentType: input.documentType ?? null,
			originalFile: JSON.stringify(input.originalFile),
			sourceMetadata: toJsonOrNull(input.sourceMetadata),
			textExtraction: toJsonOrNull(input.textExtraction),
			classification: toJsonOrNull(input.classification),
			normalizedMetadata: toJsonOrNull(input.normalizedMetadata),
			securityFlags: toJsonOrNull(input.securityFlags),
			sizeBytes: input.originalFile.sizeBytes,
			createdAt: now,
			updatedAt: now
		};
		await this.db.insert(documentArtifacts).values(row);
		return rowToArtifact(row);
	}

	async findById(id: string, tenantId: string): Promise<DocumentArtifact | null> {
		const rows = await this.db
			.select()
			.from(documentArtifacts)
			.where(and(eq(documentArtifacts.id, id), eq(documentArtifacts.tenantId, tenantId)))
			.limit(1);
		const row = rows[0];
		if (!row) return null;
		return rowToArtifact(row as DocumentArtifactRow);
	}

	async setStatus(id: string, status: DocumentProcessingStatus): Promise<void> {
		await this.db
			.update(documentArtifacts)
			.set({ processingStatus: status, updatedAt: nowIso() })
			.where(eq(documentArtifacts.id, id));
	}

	async setTextExtraction(id: string, result: TextExtractionResult): Promise<void> {
		await this.db
			.update(documentArtifacts)
			.set({ textExtraction: JSON.stringify(result), updatedAt: nowIso() })
			.where(eq(documentArtifacts.id, id));
	}

	async setClassification(id: string, result: DocumentClassificationResult): Promise<void> {
		await this.db
			.update(documentArtifacts)
			.set({
				classification: JSON.stringify(result),
				documentType: result.documentType,
				updatedAt: nowIso()
			})
			.where(eq(documentArtifacts.id, id));
	}

	async addSecurityFlag(id: string, flag: DocumentSecurityFlag): Promise<void> {
		const rows = await this.db
			.select({ securityFlags: documentArtifacts.securityFlags })
			.from(documentArtifacts)
			.where(eq(documentArtifacts.id, id))
			.limit(1);
		const current = fromJson<DocumentSecurityFlag[]>(rows[0]?.securityFlags ?? null) ?? [];
		if (current.includes(flag)) return;
		const next = [...current, flag];
		await this.db
			.update(documentArtifacts)
			.set({ securityFlags: JSON.stringify(next), updatedAt: nowIso() })
			.where(eq(documentArtifacts.id, id));
	}

	async update(
		id: string,
		patch: Partial<{
			processingStatus: DocumentProcessingStatus;
			documentType: DocumentType;
			textExtraction: TextExtractionResult;
			classification: DocumentClassificationResult;
			normalizedMetadata: Record<string, unknown>;
			securityFlags: DocumentSecurityFlag[];
		}>
	): Promise<void> {
		const update: Record<string, unknown> = { updatedAt: nowIso() };
		if (patch.processingStatus !== undefined) update.processingStatus = patch.processingStatus;
		if (patch.documentType !== undefined) update.documentType = patch.documentType;
		if (patch.textExtraction !== undefined)
			update.textExtraction = JSON.stringify(patch.textExtraction);
		if (patch.classification !== undefined) {
			update.classification = JSON.stringify(patch.classification);
			update.documentType = patch.classification.documentType;
		}
		if (patch.normalizedMetadata !== undefined)
			update.normalizedMetadata = JSON.stringify(patch.normalizedMetadata);
		if (patch.securityFlags !== undefined)
			update.securityFlags = JSON.stringify(patch.securityFlags);
		await this.db.update(documentArtifacts).set(update).where(eq(documentArtifacts.id, id));
	}
}

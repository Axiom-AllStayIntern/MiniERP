import { createR2FileService } from '../../infrastructure/storage/r2-storage-provider';
import type { FileServiceContract } from './file.types';

export type { FileBlob, FileServiceContract, HeadResult, StoredFileRef } from './file.types';

/**
 * Build a FileService for the running environment. Phase 2 always returns
 * the R2-backed adapter; future phases can pick alternatives based on env or
 * tenant config (S3, local FS for tests, etc.) without touching call sites.
 */
export function createFileService(env: Env): FileServiceContract {
	if (!env.R2) {
		throw new Error('FileService requires an R2 binding (env.R2 is missing).');
	}
	return createR2FileService(env.R2);
}

/**
 * Build the canonical storage key for a Document Intake artifact. Mirrors the
 * existing legacy upload key shape (`uploads/<entityType>/<scope>/<date>/...`)
 * so artifacts and legacy doc-hub files can coexist in the same R2 bucket
 * without collisions.
 */
export function buildArtifactStorageKey(input: {
	tenantId: string;
	fileName: string;
	artifactId: string;
}): string {
	const datePart = new Date().toISOString().slice(0, 10);
	const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
	return `uploads/document_artifact/${input.tenantId}/${datePart}/${input.artifactId}-${safeName}`;
}
